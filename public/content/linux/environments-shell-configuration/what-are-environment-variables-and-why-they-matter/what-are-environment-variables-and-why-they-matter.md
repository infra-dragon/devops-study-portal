# Environment variables

Environment variables are the standard mechanism for passing configuration to a process without changing its code or its command-line arguments.

## The environment

The **environment** is a set of named values that every running process carries and that programs read to configure their behavior. Each entry binds a name to a string value. Formally it is a per-process array of `NAME=VALUE` strings. Listing it prints one entry per line:

```bash
$ env
HOME=/home/dev
PATH=/usr/local/bin:/usr/bin:/bin
SHELL=/bin/bash
LANG=en_US.UTF-8
...
```

## Environment variables

An **environment variable** is a single named value in the environment. Programs read them for settings that would otherwise have to be hard-coded or passed as arguments, and a value is read by prefixing its name with `$`. Two kinds are common.

Standard variables that the shell and most programs consult: `PATH` is the list of directories searched for executables, `HOME` is the user's home directory:

```bash
$ echo "$HOME"
/home/dev
$ echo "$PATH"
/usr/local/bin:/usr/bin:/bin
```

Application and deployment settings supplied at run time — connection strings, credentials, log levels, feature flags — kept out of source code and injected by the shell, a container runtime, or a CI system:

```bash
$ echo "$DATABASE_URL"
postgres://localhost/app
```

## Shell variables

A **shell variable** is a named value that exists only within the shell process that defined it. It is created by writing the bare name, an `=`, and a string value, with no spaces around the `=`, and — like an environment variable — is read with `$`:

```bash
$ GREETING=hello
$ echo "$GREETING"
hello
```

A shell variable is not part of the environment: it is visible in the shell that set it, but the programs that shell runs never see it.

## Inheritance

Inheritance is the one behavioral difference between the two. **A child process receives a copy of its parent's environment, but none of the parent's shell variables.** When a process starts another — as the shell does whenever it runs a program — the new process is handed a copy of the environment alone, and the parent's shell variables stay behind. The `export` builtin moves a shell variable into the environment, promoting it to an environment variable, so that the programs the shell runs inherit it:

```bash
$ TOKEN=abc123               # shell variable: not in the environment
$ bash -c 'echo "$TOKEN"'    # the child does not receive it

$ export TOKEN               # now part of the environment
$ bash -c 'echo "$TOKEN"'    # the child inherits it
abc123
```

The inherited copy is independent, so a change a child makes is invisible to the parent — which is why a variable set inside a script does not persist in the shell that ran it:

```bash
$ export COLOR=red
$ bash -c 'COLOR=blue; echo "$COLOR"'   # child edits its own copy
blue
$ echo "$COLOR"                          # the parent is unchanged
red
```

A shell assignment does not create a second variable that hides an environment variable of the same name. Shell and environment variables share one namespace, separated only by the export flag, so `PATH=/home/` overwrites the single existing `PATH` (environment variable) in place, and it stays exported. Its previous value is then gone from this shell — and inherited as `/home/` by the programs it runs — until a new shell restores the default.

## Scope, inspection, and lifetime

**Lookup is local.** Reading `$VAR` is a single lookup in the process's own variables — it never walks up to a parent or to any global store. The apparent hierarchy (a login shell, its children, theirs) is built by *copying* the environment at each child's creation, not by a lookup chain, so a change in one process is never seen by one already running above or beside it.

**Inspecting.** A process's environment is the *exported* subset of its variables. `set` lists every shell variable, exported or not; `env` and `printenv` list only the environment — the part children receive.

**Reaching a child.** A variable reaches a child only by being in the environment handed to it. `export VAR` places it there for every later child; `VAR=value command` and `env VAR=value command` place it there for that one command alone, leaving the shell's own environment untouched.

**Lifetime.** A variable set at runtime exists only in that process. A new shell starts fresh from its parent and startup files, so the change is not remembered. A backgrounded child keeps its own snapshot of the environment from when it started and, if it outlives the shell, continues with that snapshot — reparented to `init`, and unaffected by any later shell.