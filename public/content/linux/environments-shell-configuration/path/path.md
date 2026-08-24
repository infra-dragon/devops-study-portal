# Command lookup and `PATH`

## What PATH is

**`PATH`** is an environment variable holding a colon-separated list of directories. Its purpose is to let you run a program by name alone: instead of typing a program's full location, `/usr/bin/ls`, you type `ls`, and the shell finds the file for you by searching the directories in `PATH`.

```bash
$ echo "$PATH"
/usr/local/bin:/usr/bin:/bin
```

When you type a command name, the shell walks these directories in order and runs the first executable file of that name it finds.

## How the shell resolves a command

The shell does not always search `PATH`. When you enter a command word, it resolves the word in this order and uses the first thing that matches:

1. **A name containing a slash** is treated as a file path and run directly — `PATH` is never consulted. `./build` runs the file `build` in the current directory; `/usr/bin/ls` runs exactly that file.
2. **A name with no slash** is first checked against four kinds of command the shell keeps in its own memory — an **alias**, a **keyword**, a **function**, then a **builtin** — and only if it matches none of them is it looked up as a file by searching `PATH`.

Those four live inside the running shell, so there is nothing on disk to search for them; only the last step, the file lookup, reads the disk — and that is what `PATH` is for. Each is:

- **alias** — a short name that stands in for a longer command, created with the `alias` builtin, e.g. `alias ll='ls -al'`. Aliases are kept in the shell's memory; `alias` with no argument lists them.
- **keyword** — a word that is part of the shell's own syntax: `if`, `for`, `while`, and so on.
- **function** — a named group of commands you define once and then call like a command; `declare -F` lists the defined ones.
- **builtin** — a command the shell implements itself instead of as a file on disk, such as `cd`, `export`, and `echo`; `compgen -b` lists them.

The slash rule in point 1 has a consequence that trips people up: a bare name and the same name with `./` are **not** the same thing.

```bash
$ ./my_script.sh     # has a slash → runs the file in the current directory
the script ran
$ my_script.sh       # no slash → searched in PATH, where it isn't found
bash: my_script.sh: command not found
```

Even though the file is right there, `my_script.sh` fails: with no slash the shell searches `PATH`, and the current directory is not on it. Adding `./` puts a slash in the name, so the shell runs the file directly. That is why scripts in the current directory are run as `./script`.

When the match is a file, `PATH` is searched left to right and the **first one found wins** — so the order of the directories decides which runs when the name exists in more than one.

## `type` — show how a name resolves

**`type`** reports how the shell would interpret a command name: as an alias, keyword, function, builtin, or a file — and, for a file, which one. General form:

```
type [-t|-p|-a] NAME ...
```

With no option, it describes the name:

```bash
$ type cd
cd is a shell builtin
$ type ls
ls is /usr/bin/ls
```

**`-t`** — print only the one-word category (`alias`, `keyword`, `function`, `builtin`, or `file`):

```bash
$ type -t if
keyword
$ type -t ls
file
```

**`-p`** — print the path of the file that would run, or nothing if the name resolves to a builtin, function, or keyword:

```bash
$ type -p ls
/usr/bin/ls
$ type -p cd        # a builtin has no file, so nothing is printed
```

**`-a`** — list every match, in the order they take precedence:

```bash
$ type -a ls
ls is /usr/bin/ls
ls is /bin/ls
```

The portable equivalent is `command -v NAME`, which prints the resolved path (or the name itself, when it is a builtin).

## Extending PATH

By default `PATH` contains the system directories where standard programs live (`/usr/bin` and the like). When you install a program somewhere else, or write your own scripts, the shell cannot find them by name — you would have to type the full path each time (`/opt/tools/bin/deploy`, `/home/you/bin/backup`). Extending `PATH` with that directory fixes this: the shell then finds those programs by name too, so `deploy` or `backup` works from anywhere.

The correct way to add a directory is to prepend or append it while **keeping the existing list through `$PATH`**, so you extend the list rather than replace it:

```bash
$ export PATH="$HOME/bin:$PATH"     # prepend — searched first, takes precedence
$ export PATH="$PATH:$HOME/bin"     # append  — searched last, a fallback
```

Order is precedence: prepend when you want this directory's programs to override same-named ones found elsewhere, append when you only want to add programs that aren't already found. A change made this way lasts only for the current shell; to apply it to every session, put the same line in a shell startup file (the next topic).

Two mistakes make `PATH` dangerous.

**Dropping `$PATH`** replaces the whole list instead of adding to it, which loses the standard directories — after which ordinary commands stop resolving:

```bash
$ PATH="$HOME/bin"          # replaces the entire list
$ ls
bash: ls: command not found
```

**Putting the current directory on `PATH`.** If the current directory is on `PATH`, the shell looks there for commands — so the programs you can run change depending on which directory you are standing in, and anyone who drops a file into a directory can have it run as a command. The current directory gets onto `PATH` in two ways: a literal `.` entry, or an **empty entry** — the gap left by a `:` at the very start, a `:` at the very end, or two colons in a row (`::`), each of which the shell reads as "the current directory." For example, if an attacker leaves a file named `ls` in `/tmp/shared` and your `PATH` starts with an empty entry, the current directory is searched first:

```bash
$ PATH=":/usr/bin:/bin"     # leading ':' is an empty entry → the current directory, searched first
$ cd /tmp/shared            # the attacker's fake 'ls' is here
$ ls                        # runs ./ls (the fake one), not the real /usr/bin/ls
```

Keep the current directory off `PATH`, and run local programs explicitly as `./name`.