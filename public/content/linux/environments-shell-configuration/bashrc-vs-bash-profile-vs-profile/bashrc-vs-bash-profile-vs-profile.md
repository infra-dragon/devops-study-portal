# Shell startup files

## The problem these files solve

A new shell starts with nothing of your own in it: no `PATH` addition for your own scripts, no shortcuts, no prompt of your choosing. Typing that setup by hand in every shell is not workable, so bash reads it from files on disk instead.

A **startup file** is an ordinary file of shell commands that bash runs automatically when it starts. Whatever you write in it is executed as if you had typed it — so the settings it contains are in place before you get your first prompt.

## Why there is more than one startup file

If every shell needed the same setup, one file would be enough. Two facts make that false.

**First, settings differ in whether they are inherited.** From the inheritance rules covered earlier:

- **Exported variables** (`PATH`, `EDITOR`) are copied into every process the shell starts. Setting them once, in the first shell of your session, is enough — everything you launch afterwards receives them.
- **Aliases, functions, the prompt, and shell options** are not exported. They exist inside one shell process and are never passed to another. Every new shell must define them again for itself.

These two kinds of setting therefore need to run at different moments: the first once per session, the second in every single shell.

**Second, not every shell has a person at it.** A shell running a script has no keyboard and no screen to serve. Personal setup there is useless and actively harmful — a script must do the same thing no matter whose account runs it, so it must not inherit one user's shortcuts. Bash enforces this: in a non-interactive shell there is no prompt, and aliases are not even expanded.

```bash
$ bash -c 'alias ll="ls -al"; ll'    # in a script-like shell, the alias does not apply
bash: ll: command not found
```

So bash must answer two questions about every shell it starts: *is this the first shell of the session?* and *is a person typing at it?* The answers are the two terms below, and they decide which files run.

## The two questions, named

A **login shell** is the first shell of a session — the one bash gives you at the moment you log in. This is where once-per-session setup belongs. You get a login shell when you connect over SSH, log in at a text console, or run `su -`, and explicitly with `bash -l`.

An **interactive shell** is a shell that prints a prompt and reads commands that a person types. This is where person-facing setup belongs. Every terminal window or tab you open is interactive. A shell that is executing a script is not interactive, because it reads its commands from the file rather than from a person.

These are two separate questions about one shell, not two kinds of shell — so a single shell can be login, interactive, both, or neither:

| The shell you get | Login? | Interactive? | Example |
|---|---|---|---|
| An SSH session | yes | yes | `ssh server` |
| A terminal window on a running desktop | no | yes | opening a new tab |
| A script | no | no | `./deploy.sh` |
| A remote command over a login shell | yes | no | `bash -l -c 'make'` (rare) |

To check which you are in, `shopt -q login_shell` succeeds only in a login shell (`shopt` reads and sets shell options, covered later in this chapter):

```bash
$ shopt -q login_shell && echo login || echo "not login"
not login
```

and `$-`, a special variable holding the option letters of the current shell, contains `i` when the shell is interactive:

```bash
$ echo "$-"
himBHs
```

## Which files each shell reads

Each of the two questions has its own set of files. A **login** shell reads the *profile* files; an **interactive** shell reads the *rc* files.

| Shell type | Files read, in order |
|---|---|
| **Login** (interactive or not) | `/etc/profile`, then the **first one that exists** of `~/.bash_profile`, `~/.bash_login`, `~/.profile` |
| **Interactive but not login** | `/etc/bash.bashrc` (Debian/Ubuntu; `/etc/bashrc` on RHEL), then `~/.bashrc` |
| **Neither** (a script) | none |

Files under `/etc/` are system-wide and apply to every user on the machine; files under `~/` are personal and apply to you alone. The system-wide file runs first, so your personal file can override what it set.

Two details in that table cause most real problems.

**A login shell reads only the first of the three personal files that exists.** The three are alternatives, not a sequence: bash looks for `~/.bash_profile`, and if it finds it, the other two are never read. A setting written in `~/.profile` while `~/.bash_profile` exists simply never runs.

**A login shell does not read `~/.bashrc`.** Read the table again: `~/.bashrc` belongs to the interactive-but-not-login row only. An SSH session is a login shell, so on its own it gets none of your aliases or your prompt. This gap is the reason for the pattern below.

Alongside these, `~/.bash_logout` runs when a **login** shell exits, for cleanup such as clearing the screen.

## The four files, individually

- **`~/.bash_profile`** — your login file. Read by bash only.
- **`~/.bash_login`** — an alternative name for the same role, kept for historical compatibility and rarely used.
- **`~/.profile`** — the original login file of the Bourne shell. Other shells (`sh`, `dash`) read it too, so it is the place for settings that must apply whichever shell logs in. Bash ignores it whenever `~/.bash_profile` exists.
- **`~/.bashrc`** — your interactive file, read by every interactive bash shell you open.

## What to put in each

The division follows directly from the two kinds of setting described at the top.

**Exported variables go in the login file** (`~/.bash_profile`, or `~/.profile`). They are inherited, so setting them once at the start of the session covers every shell and program you run afterwards:

```bash
# ~/.bash_profile
export PATH="$HOME/bin:$PATH"
export EDITOR=vim
```

**Aliases, functions, the prompt, and shell options go in `~/.bashrc`.** They are not inherited, so each new interactive shell has to create them for itself:

```bash
# ~/.bashrc
alias ll='ls -alh'
PS1='\u@\h:\w\$ '
```

## Closing the gap between them

A login shell reads the login file but not `~/.bashrc`, so an SSH session would arrive without your aliases or prompt. The fix is to have the login file read `~/.bashrc` itself, by adding this line to it:

```bash
# at the end of ~/.bash_profile
[ -f ~/.bashrc ] && . ~/.bashrc
```

`[ -f ~/.bashrc ]` checks that the file exists, so nothing fails if it does not, and `.` runs the file in the current shell (the next topic). Ubuntu already ships this line in its default `~/.profile`.

With it in place the arrangement is simple to reason about: `~/.bashrc` holds everything you want in every interactive shell, the login file holds your exported variables and pulls in `~/.bashrc`, and scripts continue to read neither.

## Applying changes

A shell reads its startup files once, at startup, so editing a file changes nothing in shells that are already running. The new content applies to the next shell you open, or to the current one if you re-run the file with `source ~/.bashrc`.