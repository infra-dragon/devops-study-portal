# Background jobs and process control

## Foreground and background

A command run normally takes over the terminal. It is connected to your keyboard, its output goes to your screen, and the shell steps aside and waits — no prompt comes back until the command is done. That is the **foreground**: one command at a time, and it has your terminal.

Running a command in the **background** means the shell starts it and then immediately takes the prompt back, without waiting for it to finish. The command keeps running, but it no longer receives what you type; you are free to run other commands while it works. Both the command and your shell exist at once, which is why a long task no longer blocks you.

The shell tracks each background command as a **job** — its own numbered list, separate from the system-wide PIDs of the previous pages. A job belongs to one shell, and one job may contain several processes if the command was a pipeline.

## `&` — start a command in the background

Appending **`&`** to a command runs it in the background. The shell prints the job number and the PID, then returns the prompt:

```bash
$ sleep 100 &
[1] 563
```

`[1]` is the job number, `563` the PID.

### `$!` — the PID of the last background command

**`$!`** is a special variable holding the PID of the most recent command started with `&`. It exists because the PID printed above goes to the screen, not into anything a script can use — `$!` is how a script captures the PID so it can check or signal that process later:

```bash
$ sleep 100 &
[1] 563
$ echo $!
563
$ kill $!            # signal the job just started
```

### Keeping output off your terminal

A background job still writes to the same terminal as your shell, so its output appears in the middle of whatever you are doing. Redirecting it to a file avoids that:

```bash
$ long_task > task.log 2>&1 &
```

Each part of that line:

| Part | Meaning |
|---|---|
| `long_task` | the command to run |
| `> task.log` | send its normal output (stdout) to the file `task.log`, replacing the file's contents |
| `2>&1` | send its error output (stderr, file descriptor 2) to the same place stdout is going — so errors land in the file too, instead of on your screen |
| `&` | run the whole thing in the background |

The order matters: `2>&1` means "make stderr point wherever stdout currently points", so it has to come *after* `> task.log`. Use `>>` instead of `>` to append to the log rather than overwrite it.

## `jobs` — list the shell's jobs

**`jobs`** lists the jobs of the current shell, with their numbers and states.

```
jobs [-l] [-p] [%n]
```

```bash
$ jobs
[1]-  Running                 sleep 100 &
[2]+  Running                 sleep 200 &
```

The two markers are `+` and `-`. **`+` marks the *current* job and `-` the *previous* one.** "Current" here has nothing to do with which jobs are running — all of them may be running at once. It means only *which job the shell will act on by default*: `fg` and `bg` with no argument operate on the `+` job. It is the shell's idea of "the one you most recently touched", normally the job started or stopped last, and it moves to another job when that one finishes or when you resume a different one.

Jobs are referred to as **`%n`** — `%1` is job 1. `%` alone or `%+` means the current job, `%-` the previous.

`-l` adds the PID, and `-p` prints only PIDs, which makes it usable in a command substitution:

```bash
$ jobs -l
[1]-   563 Running                 sleep 100 &
[2]+   564 Running                 sleep 200 &
$ kill $(jobs -p)          # signal every job of this shell
```

## Stopping and resuming: `Ctrl-Z`, `fg`, `bg`

**`Ctrl-Z`** stops the foreground job. It sends `SIGSTOP`, and the process freezes exactly where it is — keeping its memory, its open files, and its network connections — doing nothing at all until you resume it. ("Stopped" and "suspended" are the same thing here; the shell says **Stopped**, so that is the word used from now on.) Stopped is a real process state, shown as `T` in `ps`:

```bash
$ jobs
[1]+  Stopped                 sleep 100
$ ps -o stat= -p 563
T
```

A stopped job makes no progress until you resume it, in one of two places:

**`bg [%n]`** resumes it in the background — it continues while you keep the prompt:

```bash
$ bg %1
[1]+ sleep 100 &
$ jobs
[1]+  Running                 sleep 100 &
```

**`fg [%n]`** brings it back to the foreground — it takes over the terminal again and the prompt waits for it:

```bash
$ fg %1
sleep 100
```

With no `%n`, both act on the current (`+`) job. Together these give the everyday recovery: you start something long in the foreground by mistake, press `Ctrl-Z` to freeze it, then `bg` to let it finish out of the way.

### Does this work with downloads and network connections?

Mostly yes, and it is worth knowing why. A stopped process keeps everything it had, including open network connections — the kernel holds a TCP connection open on the process's behalf, not the process itself, so the connection does not close when the process freezes. Resume it and the transfer carries on. A download stopped mid-transfer and resumed a few seconds later completes normally.

The limit is time, not mechanism. While the process is stopped it reads nothing, so data stops being collected and the sender eventually has nowhere to put it. Stay stopped long enough and the other end gives up: a server with an idle timeout closes the connection, and your resumed process finds it dead. Seconds are safe; minutes are a gamble; hours will not work.

So `Ctrl-Z` and `bg` are fine for getting a download out of your way. For pausing something for a long time, stop the transfer and restart it later with a tool that can resume (`curl -C -`, `wget -c`, `rsync`) rather than leaving a frozen process holding a connection nobody is maintaining.

## Surviving the terminal: `nohup` and `disown`

Background jobs are still attached to the shell, and that matters when the terminal goes away. When a terminal closes, the kernel sends **`SIGHUP`** ("hang up") to the processes in its session, whose default action is to terminate. Anything still tied to the terminal dies with it — the problem the multiplexer page solved a different way.

Bash does not send `SIGHUP` to background jobs when you exit deliberately (`shopt huponexit` is `off` by default), but losing the terminal itself — a closed window, a dropped SSH connection — does deliver it. Two commands protect against that.

**`nohup`** starts a command that will keep running after the terminal closes. The name is short for "no hangup": it tells the command to ignore the `SIGHUP` signal, so when the terminal sends it, the command carries on instead of dying.

```
nohup COMMAND [args] &
```

```bash
$ nohup ./import.sh &
nohup: ignoring input and appending output to 'nohup.out'
```

It does two things for you.

**It makes the command ignore `SIGHUP`.** You can see the difference: a process started with `nohup` has `SIGHUP` in its list of ignored signals, and a plain background job does not.

**It sends the output to a file.** Once the terminal is gone there is no screen to print to, so `nohup` writes the output to a file named `nohup.out` in the current directory (or in your home directory if it cannot write there). That is what the message above is telling you. Better to name the file yourself, so you know where it went:

```bash
$ nohup ./import.sh > import.log 2>&1 &
```

**`disown`** applies to a job that is *already running*: it removes the job from the shell's job table, so the shell no longer regards it as its own and will not signal it on exit.

```
disown [-h] [%n]
```

```bash
$ sleep 100 &
[1] 563
$ disown %1
$ jobs
                        # the job list is now empty — but the process is still running
```

`-h` keeps the job listed while marking it not to receive `SIGHUP`. `disown -a` disowns every job.

The practical difference: **`nohup` is a decision made when starting**, `disown` is the **repair** for something already started that you now need to outlive the session. After `disown` the job is no longer in `jobs`, so `fg` and `bg` cannot reach it — track it by PID from then on.

For anything genuinely long-running, a multiplexer session is better than either, because it keeps the shell itself alive and lets you return to the work interactively.

## Priority: `nice` and `renice`

Every process has a **niceness** value from **−20 to 19** that biases how much CPU time the scheduler gives it. The name is literal: a *higher* number means the process is nicer to others, so it yields CPU. **−20** is the most aggressive, **19** the most yielding, and **0** is the default.

Niceness only matters under contention. On an idle machine a `nice 19` process runs at full speed; it gives way only when something else wants the CPU.

**`nice`** starts a command with a given niceness:

```
nice -n VALUE COMMAND
```

```bash
$ nice -n 10 ./batch_job.sh &
$ ps -o pid,ni,comm -p 608
  PID  NI COMMAND
  608  10 sleep
```

**`renice`** changes the niceness of a process that is already running:

```
renice -n VALUE -p PID
```

```bash
$ renice -n 15 -p 604
604 (process ID) old priority 0, new priority 15
```

**The change is one-way for ordinary users: you may raise niceness, never lower it.** Only root can set a negative value or reduce an existing one — otherwise any user could claim priority over everyone else:

```bash
$ nice -n -5 ./task           # as a normal user
nice: cannot set niceness: Permission denied
$ renice -n 5 -p 604          # lowering 15 back to 5, as a normal user
renice: failed to set priority for 604: Operation not permitted
```

The realistic use is being deliberately considerate: run a backup, a build, or a bulk import at `nice -n 10` so it uses whatever CPU is spare without slowing the work that matters. `renice` is the tool for when something already running turns out to be hogging the machine.