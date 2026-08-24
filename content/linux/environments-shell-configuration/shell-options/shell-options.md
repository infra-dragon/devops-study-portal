# Shell options

## What a shell option is

A **shell option** is a named on/off setting in the shell that changes how it behaves — whether it prints each command before running it, whether it stops at the first error, and so on. Every option is off by default; enabling one changes the behaviour for the rest of that shell.

Bash keeps these settings in two separate groups: the core options defined by POSIX, controlled by **`set`**, and options specific to bash, controlled by **`shopt`**. The two are not interchangeable — each command knows only its own options — so which command to use is fixed by the option itself, a point the sections below make concrete as they go.

## `set` — the core options

**`set`** controls the core, POSIX-defined options: it enables one with `-LETTER` and disables it with `+LETTER`. Each option also has a long name, used with `-o` and `+o`, and `set -o` on its own lists this group with each option's state:

```
set -LETTER      # enable      set -o longname
set +LETTER      # disable     set +o longname
```

`-` turns an option *on*, `+` turns an option *off*.
Three options matter most.

### `set -x` — trace commands

**`set -x`** prints each command to standard error, after all expansion has been applied, immediately before the command runs. Each trace line is marked with a leading `+`, keeping it distinct from the command's own output:

```bash
$ set -x
$ name=world
+ name=world
$ echo "hello $name"
+ echo 'hello world'
hello world
$ touch "$name.log"
+ touch world.log
```

The trace always shows the command *after* substitution: a variable — whether inside a string or standing alone as an argument — is printed as the text it expanded to (`world.log`), never as `$name`. That is the point of the option: it reveals what the shell is actually about to run, which the source text does not always make obvious. Disable it with `set +x`.

### `set -e` — exit on error

**`set -e`** makes the shell exit the moment a command returns a non-zero (failure) status, instead of running on to the next command. Without it a script continues after a failed step, often acting on data that step never produced.

```bash
$ set -e
$ echo one
one
$ false            # returns non-zero → the shell exits here
$ echo two         # never runs
```

A failure is deliberately ignored when the command is being *tested* rather than relied upon, which produces exceptions that surprise people:

- A command used as a condition — in `if` or `while`, or before `&&` / `||` — does not cause an exit; its success or failure is the thing being examined.
- In a pipeline, only the last command's status counts, so `false | grep x` does not trigger an exit. 

### `set -o pipefail` - makes a pipeline fail if any command in it does.

```bash
$ set -e
$ false || echo "handled"     # the failure is handled → no exit
handled
$ false | true                # pipeline status is 'true' → no exit
$ set -o pipefail
$ false | true                # now the pipeline fails → exit
```

### `set -u` — error on unset variables

**`set -u`** makes a reference to a variable that has never been set an error, instead of expanding it to an empty string. It catches misspelled variable names, which otherwise become silent empty values:

```bash
$ set -u
$ echo "[$UNDEFINED]"
bash: UNDEFINED: unbound variable
```

The kind of variable does not matter here. `set -u` triggers on a name that has no value at all — it makes no difference whether the name would be a shell variable or an environment variable, nor whether it was assigned in this shell or inherited from a parent. A name set either way is accepted; only a name that was never set, by any means, is the error.

The three are combined at the top of careful scripts, usually as `set -euo pipefail`: stop on error, treat unset variables as errors, and let a failure anywhere in a pipeline count. One caution: because `set -e` is switched off inside command substitutions and other contexts, a script that must be robust should treat it as a safety net, not a guarantee.

## `shopt` — bash's own options

**`shopt`** controls the second group: options that are part of bash itself rather than the POSIX set, so *bash* is the precise word — they change how bash in particular behaves. It uses its own flags — `-s` to set (enable), `-u` to unset (disable) — a bare name to query one, and no argument to list the group:

```
shopt -s NAME     # enable
shopt -u NAME     # disable
shopt NAME        # print its current state
shopt             # list every option with its state
```

These names belong to `shopt` alone: `set` does not recognise them, just as `shopt` does not recognise `errexit` or `xtrace`. Three you are likely to use:

**`nullglob`** governs what happens to a filename pattern that matches no file. By default the pattern is left untouched and passed along as literal text; with `nullglob` on, it expands to nothing instead:

```bash
$ echo *.md            # off (default): no match, so the pattern stays literal
*.md
$ shopt -s nullglob
$ echo *.md            # on: a non-match expands to nothing (an empty line)

```

**`globstar`** governs whether `**` matches across directory levels. By default `**` behaves like a single `*` and matches within one level; with `globstar` on, it matches files at any depth:

```bash
$ echo **/*.txt        # off (default): ** acts like *, so only one level down
sub/c.txt
$ shopt -s globstar
$ echo **/*.txt        # on: matches .txt files at every depth
a.txt b.txt sub/c.txt
```

**`expand_aliases`** governs whether the shell expands aliases at all. It is on in interactive shells and off in scripts — which is the reason an alias in a script is ignored — so a script that needs one must enable it first:

```bash
$ cat use_alias.sh
shopt -s expand_aliases
alias hi='echo hello'
hi
$ bash use_alias.sh
hello
```

## Where an option applies

An option set either way applies only to the shell that runs the command. Setting it at the prompt affects the current session; to have it on in every shell, put the command in a startup file; to have it on for a script, put it near the top of the script.