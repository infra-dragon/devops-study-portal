# Signals and kill

## What a signal is

A **signal** is a short notification the kernel delivers to a process, telling it that something has happened or asking it to do something. It carries no data beyond its own identity — the entire message is *which* signal it is.

Each **signal type** has a fixed name and a fixed number: `SIGTERM` is signal number 15, `SIGKILL` is 9, and those numbers are the same on every Linux system and for every process. The number identifies *which signal* is being sent, not which process receives it — sending signal 15 to two different processes sends both of them the same `SIGTERM`. Name and number are interchangeable when sending.

On receiving a signal, a process does one of three things:

- **runs a handler** — code the program registered for that signal, letting it react on its own terms.
- **is acted on by the kernel** — if there is no handler, each signal has a default action, usually terminating the process.
- **ignores it** — if the program chose to.

This is the mechanism behind things already seen: `Ctrl-C` sends a signal, closing a terminal sends a signal, and stopping a service sends a signal.

## The signals that matter

`kill -l` lists all of them, but a handful account for nearly everything:

| Signal | № | Default action | Sent by |
|---|---|---|---|
| `SIGTERM` | 15 | terminate | `kill` with no options — the polite request to exit |
| `SIGKILL` | 9 | terminate immediately | `kill -9` — cannot be caught or ignored |
| `SIGINT` | 2 | terminate | `Ctrl-C` at the terminal |
| `SIGHUP` | 1 | terminate | the terminal closing; also used to mean "reload config" |
| `SIGSTOP` | 19 | suspend | `Ctrl-Z`; cannot be caught or ignored |
| `SIGCONT` | 18 | resume | `fg` / `bg` |
| `SIGQUIT` | 3 | terminate + core dump | `Ctrl-\` |

```bash
$ kill -l TERM
15
$ kill -l 9
KILL
```

Two of these are exceptions to the three outcomes above: **`SIGKILL` and `SIGSTOP` cannot be handled or ignored.** A program may catch `SIGTERM` or `SIGINT` and decide what to do, but it gets no say in `SIGKILL` and `SIGSTOP` — the kernel enforces them directly, against the process's wishes. That property is what the next section is about.

## SIGTERM and SIGKILL

The difference between these two is the most important thing on this page.

**`SIGTERM` is a request.** It is deliverable to a handler, so a well-written program catches it and shuts down properly: finishing the current request, flushing buffers to disk, closing database connections, removing its lock file. The process decides when it has finished and then exits.

**`SIGKILL` is not a request.** It never reaches the process at all — the kernel destroys the process on the spot. No handler runs, because there is nothing left to run it.

The consequence is visible in a program that cleans up on `SIGTERM`:

```bash
$ kill $pid          # SIGTERM
[app] started, pid 564
[app] caught SIGTERM — cleaning up, saving state

$ kill -9 $pid       # SIGKILL
[app] started, pid 573
                     # no cleanup line: the process was destroyed outright
```

**This is why `kill -9` is a last resort.** Whatever the process was in the middle of stays that way: half-written files, unreleased locks, connections left open, a database with no chance to flush. Reach for it only when a process has ignored `SIGTERM` and has genuinely stopped responding — try `SIGTERM`, wait a few seconds, and escalate only if it is still there.

One case where `-9` will not help either: a process in state `D` (uninterruptible sleep, waiting on hardware or a stuck disk) cannot be killed at all, because signals are not delivered in that state. Only the underlying I/O completing, or a reboot, resolves it.

## `kill` — send a signal to a PID

**`kill`** sends a signal to a process identified by PID. Despite the name, its job is to send *any* signal; terminating is only its default.

```
kill [-SIGNAL] PID...
```

The signal may be given by name (with or without the `SIG` prefix) or by number — these are all identical:

```bash
$ kill 1234                # SIGTERM, the default
$ kill -TERM 1234
$ kill -SIGTERM 1234
$ kill -15 1234
```

The forms you will use:

```bash
$ kill 1234                # ask it to exit
$ kill -9 1234             # force it to die
$ kill -HUP 1234           # tell a service to reload its configuration
$ kill -STOP 1234          # suspend it
$ kill -CONT 1234          # resume it
```

`kill -HUP` deserves note: for daemons, `SIGHUP` is by convention "re-read your config file" rather than "quit", so it reloads a service without restarting it or dropping connections. Whether a program honours this depends on the program.

`SIGSTOP` and `SIGCONT` suspend and resume without ending anything — the state changes to `T` and back:

```bash
$ kill -STOP $pid && ps -o stat= -p $pid
T
$ kill -CONT $pid && ps -o stat= -p $pid
S
```

**`kill -0`** sends no signal at all; it only performs the checks that sending would require, and reports the result as an exit status:

- **`0`** — the process exists and you are allowed to signal it.
- **non-zero** — you cannot signal it, for one of two reasons: no process with that PID exists, or it exists but belongs to another user. Both return the same status, so the error message is what distinguishes them:

```bash
$ kill -0 542; echo $?           # own live process
0
$ kill -0 999999; echo $?        # no such PID
kill: (999999) - No such process
1
$ kill -0 530; echo $?           # exists, but owned by root
kill: (530) - Operation not permitted
1
```

This makes it the standard way for a script to test whether something is still running, since the common case — a PID from a file — is either alive or gone:

```bash
$ kill -0 $pid 2>/dev/null && echo "still running" || echo "not running"
still running
```

## `pkill` and `killall` — signal by name

Both send a signal to processes selected by name instead of PID, saving the `pgrep`-then-`kill` round trip.

**`pkill`** takes the same matching rules as `pgrep` from the previous page:

```
pkill [-SIGNAL] [-f] [-u USER] PATTERN
```

```bash
$ pkill nginx                    # SIGTERM to every process matching 'nginx'
$ pkill -9 nginx                 # SIGKILL instead
$ pkill -u alice firefox         # only alice's
$ pkill -f "python3 worker.py"   # match the full command line, not just the name
```

**`killall`** takes an **exact** program name:

```
killall [-SIGNAL] NAME...
```

```bash
$ killall sleep
$ killall -9 firefox
```

The distinction matters, because it decides what you hit:

```bash
$ killall slee
slee: no process found        # exact name required — no match
$ pkill slee                  # substring match — kills the running 'sleep'
```

So `pkill` matches a **pattern** and can hit more than you intended; `killall` requires the **whole name**. With either, check first with `pgrep -a` before sending anything — a mistyped pattern can terminate far more than you meant to.

## Who may signal what

The rule from the permissions chapter applies here in its own form: **you may signal a process only if you own it, or if you are root.** Execute permission on the program is irrelevant — what matters is the identity the process runs as:

```bash
$ kill 623                    # attempted by alice, on a root-owned process
kill: (623) - Operation not permitted
```

Root may signal anything. This is also why `sudo` is needed to restart most services: their processes belong to root or to a service account, not to you.

## Reading the exit status

Every process ends with an **exit status**, a number reporting how it finished — `0` for success, non-zero for a problem. When a *signal* is what ended it, that status follows a fixed rule: **128 plus the signal number.**

| Signal | Number | Exit status |
|---|---|---|
| `SIGTERM` | 15 | **143** |
| `SIGKILL` | 9 | **137** |
| `SIGINT` | 2 | **130** |

These numbers are worth recognising because they appear constantly in logs and container output, where they are often the only evidence of what happened.

You can see the rule directly. Two pieces of shell are needed: **`$?`** holds the exit status of the last finished command, and **`wait PID`** pauses until a background process finishes and then reports *its* status — necessary here because a process put in the background does not otherwise hand its status back to the shell.

```bash
$ sleep 30 & p=$!        # start a process, remember its PID in $p
$ kill -TERM $p          # ask it to stop
$ wait $p; echo $?       # wait for it to finish, then read its status
143                      # 128 + 15

$ sleep 30 & p=$!
$ kill -KILL $p
$ wait $p; echo $?
137                      # 128 + 9
```

**137** is the one to remember: a container or process that exited 137 was `SIGKILL`ed — typically by the out-of-memory killer when the machine ran out of RAM, or by an orchestrator whose shutdown grace period expired after `SIGTERM` went unanswered. **143** means it was asked to stop with `SIGTERM` and complied, which is a normal, clean shutdown. **130** is a program you stopped yourself with `Ctrl-C`.

(`&`, `$!`, and `wait` are the background-job mechanics covered properly in the next section; they appear here only to make the exit status observable.)