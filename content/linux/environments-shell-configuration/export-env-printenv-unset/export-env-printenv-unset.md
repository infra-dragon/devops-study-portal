# Managing the environment

## `export`

**`export`** marks a shell variable so that it becomes part of the environment, and is therefore included in the environment passed to every child process started afterward. Forms:

- `export NAME=value` — assign and export in one step.
- `export NAME` — export a variable that already exists (or is set later).
- `export -n NAME` — remove the export attribute; `NAME` stays a shell variable but leaves the environment.
- `export -p` — prints a complete list of all environment variables currently exported in your active shell session. The primary purpose of the `-p` (print) flag is to display these variables and their assigned values in a POSIX-compliant format (usually prefixed with `declare -x` or `export`) so the output can be easily copied, saved, or reused as shell input in another script or session.

```bash
$ export GREETING=hello
$ bash -c 'echo "[$GREETING]"'    # a child inherits it
[hello]
$ export -n GREETING              # strip the export attribute
$ bash -c 'echo "[$GREETING]"'    # the child no longer receives it
[]
$ echo "[$GREETING]"              # still a shell variable, though
[hello]
```

`export` affects children started after it; a process already running is unaffected, since it holds its own copy of the environment, made when it started. you can read any process's copy at `/proc/<pid>/environ`.

## `env`

**`env`** runs a command with a modified environment; with no command, it prints the current environment. Forms:

- `env` — print the environment, one `NAME=value` per line.
- `env NAME=value command [args]` — run `command` with the assignments added to its environment, leaving the shell's own environment unchanged.
- `env -i command` — run `command` with an empty environment.
- `env -u NAME command` — run `command` with `NAME` removed from its environment.

```bash
$ env EXTRA=xyz bash -c 'echo "[$EXTRA]"'   # added for this command only
[xyz]
$ echo "[$EXTRA]"                            # the shell itself is unchanged
[]
$ export GREETING=hello
$ env -i bash -c 'echo "[$GREETING]"'        # empty environment: nothing inherited
[]
```

## `printenv`

**`printenv`** prints environment variables — the whole environment, or the value of a named one. Forms:

- `printenv` — print the whole environment.
- `printenv NAME` — print the value of `NAME`; the exit status is non-zero if `NAME` is not in the environment.

```bash
$ printenv HOME
/home/dev
$ printenv MISSING          # not in the environment: no output, non-zero exit
$ echo $?
1
```

Unlike `echo "$NAME"`, which prints any shell variable, `printenv NAME` reads the environment specifically — reporting a value only when `NAME` is exported, which makes it a direct check of whether a variable is in the environment.

## `unset`

**`unset`** removes a variable from the shell entirely. Forms:

- `unset NAME` — remove the variable; if it was exported, it also leaves the environment, so children no longer receive it.
- `unset -f NAME` — remove a shell function instead of a variable.

```bash
$ export GREETING=hello
$ unset GREETING
$ echo "[$GREETING]"             # removed from this shell
[]
$ printenv GREETING; echo $?    # and gone from the environment
1
```

`unset` removes the variable outright; `export -n NAME` only strips the export attribute, keeping the variable in the shell.

## `declare`

A variable has a name and a value; it can also carry **attributes** — properties that change how it behaves, independent of its value. Being *exported* (in the environment) is one such property; others make a variable readonly, an integer, or an array.

**`declare`** (a bash builtin; `typeset` is a synonym) sets these attributes and displays variables together with them. General form:

```
declare [±attribute ...] [NAME[=value] ...]
```

Each attribute has a one-letter code, turned on with `-LETTER` and off with `+LETTER`. With no attribute, `declare` just declares or assigns a variable; `-p` prints a variable back with the attribute letters it carries — `--` meaning none:

```bash
$ declare COLOR=blue
$ declare -p COLOR
declare -- COLOR="blue"     # no attribute; standard, untyped variable
```

If a variable has never been declared (neither in shell nor in env) the command will print an error message and exit with status 1:

```bash
$ declare -p TOKEN
declare: TOKEN: not found
$ echo $?
1
```

**`-x`** — export: place the variable in the environment (identical to `export`); `+x` removes it.

```bash
$ declare -x TOKEN=abc
$ declare -p TOKEN
declare -x TOKEN="abc"
$ declare +x TOKEN
$ declare -p TOKEN
declare -- TOKEN="abc"
```

This is also how you tell whether a variable is exported: `declare -p NAME` shows `x` when the variable is in the environment, and `--` (no `x`) when it is a shell variable only.

**`-r`** — readonly: the variable can no longer be reassigned or unset.

```bash
$ declare -r MAX=100
$ MAX=200
bash: MAX: readonly variable
```

**`-i`** — integer: assignments are evaluated as arithmetic.

```bash
$ declare -i N=3+4
$ echo "$N"
7
```

**`-a` / `-A`** — indexed array / associative array.

```bash
$ declare -a LIST=(a b c)
$ declare -p LIST
declare -a LIST=([0]="a" [1]="b" [2]="c")
```

**`-l` / `-u`** — force the value to lower- / upper-case on assignment.

```bash
$ declare -u NAME=John
$ echo "$NAME"
JOHN
```

**`-n`** — nameref: the variable resolves to the variable named by its value.

```bash
$ REAL=hello
$ declare -n REF=REAL
$ echo "$REF"
hello
```

Inside a function, `declare` makes the variable local to that function; `declare -g` forces a global instead.