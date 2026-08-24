# Shell Types: `sh`, `csh`, `zsh`, `bash`

The shell is a program, and there's more than one to choose from. They fall into two families: the **Bourne family** (`sh`, `bash`, `zsh`), which share almost the same syntax, and the **C-shell family** (`csh`, `tcsh`), which don't. Here's what each one is and when you'd use it.

| Shell | Family | Where you'll meet it | Config file |
|---|---|---|---|
| `sh` | Bourne | portable scripts, system startup | (varies) |
| `bash` | Bourne | default on most Linux | `~/.bashrc` |
| `zsh` | Bourne | default on macOS; power users | `~/.zshrc` |
| `csh` / `tcsh` | C shell | BSD and older/legacy systems | `~/.cshrc` |

---

## Bourne shell — `sh`

**The original Unix shell, and today the name for a small, standard shell that runs almost anywhere.** On most Linux systems `/bin/sh` isn't the 1979 original — it's a lightweight stand-in (often `dash` on Debian/Ubuntu) that sticks to the common **POSIX** standard, so anything written for it works across systems.

```bash
$ ls -l /bin/sh
/bin/sh -> dash
```

Use it for scripts that must run on many different systems.

## Bash — `bash`

**The "Bourne Again Shell": an extended version of `sh`, and the default on almost every Linux distribution.** It keeps `sh`'s syntax but adds the conveniences you expect while typing — command history, tab completion, arrow-key editing — plus extra scripting features. Its settings live in `~/.bashrc`.

```bash
$ echo $BASH_VERSION
5.2.21(1)-release
```

Use it as your default, for both daily work and most scripts.

## Z shell — `zsh`

**A newer shell, mostly compatible with bash, focused on a nicer interactive experience.** Bash commands generally work unchanged, but `zsh` adds smarter tab completion, spelling correction, and popular add-on frameworks like **Oh My Zsh** for themes and plugins. It's the default shell on macOS. Its settings live in `~/.zshrc`.

```bash
# match every .log file underneath the current folder, at any depth
ls **/*.log
```

Use it if you want a more capable terminal for daily use — but still write shared scripts for `sh` or `bash`.

## C shell — `csh` (and `tcsh`)

**An older shell with a different, C-like syntax that isn't compatible with the others.** It was popular on early BSD Unix and introduced features like command history, but its scripting is widely avoided. `tcsh` is its improved, still-maintained version, found mainly on BSD and legacy systems.

```csh
# csh has its own syntax — note the 'set' and the spaces
set name = "world"
```

Use it only if you land on a system where it's already in place; don't choose it for new work.

---

## Which one to use

- **A script that must run anywhere** → start it with `#!/bin/sh`.
- **A normal script** → use `#!/bin/bash`.
- **Daily typing on Linux** → bash is fine and already there; try zsh if you want more polish.
- **On macOS** → zsh is already your default.
- **csh / tcsh** → only when a system hands it to you.

## Checking and changing your shell

```bash
echo $SHELL        # your default login shell
cat /etc/shells    # shells installed on this system
chsh -s /bin/zsh   # change your default shell (applies at next login)
```

`$SHELL` is the shell you log in with; to see the one running right now, use `ps -p $$`.