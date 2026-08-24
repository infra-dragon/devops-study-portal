# `source` and `.` — running a file in the current shell

## The problem

You edit `~/.bashrc` to add an alias. The shell you are sitting in does not change: it read its startup files once, when it started, and does not read them again.

The obvious repair — running the file the way you run any script — does not work either:

```bash
$ bash ~/.bashrc      # appears to do nothing
$ ll
bash: ll: command not found
```

The reason is inheritance. Running a file as a script starts a **new shell process** to execute it. That child shell defines the alias in itself, then exits, and everything it defined disappears with it. Changes made by a child never travel back to the parent, so your shell is untouched.

What is needed is a way to run the file's commands **in the shell you are already in**, rather than in a new one.

## `source`

**`source`** reads a file and executes the commands in it in the current shell, without starting a new process. General form:

```
source FILE [arguments]
.      FILE [arguments]
```

`.` and `source` are the same command. `.` is the standard name, defined by POSIX and available in every shell; `source` is a more readable synonym provided by bash. Use `.` in scripts that must run under any shell, `source` anywhere else.

The difference from executing a file is visible in a single comparison. Given this file:

```bash
$ cat config.sh
GREETING=hello
cd /tmp
```

Executing it changes nothing, because the changes happened in a child that has since exited:

```bash
$ bash ./config.sh
$ echo "[$GREETING]"
[]
$ pwd
/home/dev
```

Sourcing it applies the same commands to the current shell:

```bash
$ source ./config.sh
$ echo "[$GREETING]"
[hello]
$ pwd
/tmp
```

## What follows from running in the current shell

Everything below is a consequence of that one fact: the commands are yours, not a child's.

**Variables, aliases, and functions defined in the file remain afterwards**, exported or not — they were created directly in your shell. This is what makes sourcing the way to reload configuration:

```bash
$ source ~/.bashrc     # your edits take effect immediately, in this shell
```

**Directory changes apply to you.** A `cd` in a sourced file moves your shell, as shown above.

**`exit` in a sourced file exits your shell.** `exit` terminates the shell that runs it, and when sourcing, that is your own — the terminal closes. Use `return` instead, which stops the sourced file and leaves the shell running:

```bash
$ cat lib.sh
echo "before"
return 0            # stops here; the shell survives
echo "never reached"
$ source ./lib.sh
before
$ echo "still here"
still here
```

**Arguments after the filename become the positional parameters** `$1`, `$2`, … inside the file, exactly as for a script:

```bash
$ cat args.sh
echo "$1 and $2"
$ source ./args.sh alpha beta
alpha and beta
```

## Where it is used

- **Reloading your configuration** after editing it: `source ~/.bashrc`.
- **Loading environment files**: a file of `export` lines, such as a project's `.env`, sourced to bring its variables into your session.
- **Loading libraries of functions**, so a script can keep shared functions in a separate file: `. ./lib/common.sh`.
- **Activating tools that must alter your shell.** A Python virtual environment is the standard example: `source venv/bin/activate` edits your `PATH` and prompt, which is only possible in your own shell — running it as a script would change a child and exit.

## Two things to watch

**A filename with no slash is looked up in `PATH`.** Like a command name, `source lib.sh` searches the `PATH` directories, so it can run a different file from the one in front of you. Write `./lib.sh` to name the local file unambiguously:

```bash
$ source lib.sh        # searches PATH — may run some other lib.sh
$ source ./lib.sh      # the file in the current directory, always
```

**Sourcing the same file repeatedly repeats its effects.** A line that prepends to `PATH` prepends again on every source, so the entry accumulates:

```bash
$ source ~/.bash_profile
$ source ~/.bash_profile
$ echo "$PATH"
/home/dev/bin:/home/dev/bin:/usr/bin:/bin
```

This is harmless in appearance but makes lookups misleading; opening a new shell gives a clean result instead.

Finally, sourcing runs whatever the file contains with your own privileges, in your own shell. Only source files you trust.