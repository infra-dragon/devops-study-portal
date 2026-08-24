# Processes

## What a process is

A **process** is a running instance of a program. The program is the file on disk; the process is that file loaded into memory and executing, with its own memory, its own open files, and an identity of its own.

The same program can be running many times at once — three shells are three processes from one `/bin/bash` — so the system identifies each by number rather than by name.

Every process carries:

- a **PID** (process ID) — a unique number identifying it while it runs.
- a **PPID** (parent process ID) — the PID of the process that started it.
- an **owner** — the user it runs as, which decides what it may access, and who may signal it.
- a **state** — what it is currently doing.

The kernel keeps processes in system memory and exposes them **dynamically** through the virtual `/proc` filesystem.

### The `/proc` Virtual Directory

Every active process gets a folder named after its Process ID (PID) inside `/proc` (for example, `/proc/615/`). Inside each PID folder, files like `cmdline` show the command used to start it, and `cwd` links to its working directory. These are not real files on a disk; reading them extracts live data straight from the kernel memory.

### `ps` — a snapshot of processes

**`ps`** prints the processes running at the instant you run it. It is a still photograph, not a live view.

`ps` accepts two different option styles for historical reasons, which is why you will see two unrelated-looking invocations that do nearly the same thing:

```
ps aux      # BSD style (no dash)
ps -ef      # UNIX style (with dash)
```

**`ps aux`** — `a` all users' processes, `u` user-oriented columns, `x` including those with no terminal:

```bash
$ ps aux | head -3
USER   PID %CPU %MEM   VSZ  RSS TTY STAT START  TIME COMMAND
root     1  0.0  0.1 19304 5372 ?   Ss   01:45  0:01 /sbin/init
root     2  0.0  0.0     0    0 ?   S    01:45  0:00 [kthreadd]
```

The columns worth knowing: **`%CPU`** and **`%MEM`** are shares of the machine; **`RSS`** is resident memory, the physical RAM actually in use, in kilobytes — the number to judge memory by, unlike `VSZ`, which is address space reserved and usually much larger. **`TTY`** is the terminal the process is attached to, `?` meaning none — the mark of a background service. **`STAT`** is the state letter above, sometimes with suffixes (`s` session leader, `+` foreground, `l` multi-threaded).

**`ps -ef`** — `-e` every process, `-f` full format. Same information, different columns; it shows **`PPID`**, which `aux` does not:

```bash
$ ps -ef | head -3
UID   PID PPID C STIME TTY   TIME     CMD
root    1    0 0 01:45 ?     00:00:01 /sbin/init
root    2    0 0 01:45 ?     00:00:00 [kthreadd]
```

Use `aux` when you care about resource use, `-ef` when you care about parentage.

You can also ask for exactly the columns you want with **`-o`**, and sort with **`--sort`**:

```bash
$ ps -eo pid,ppid,user,%cpu,%mem,stat,comm --sort=-%mem | head -4
  PID  PPID USER  %CPU %MEM STAT COMMAND
  506     1 root   4.6  0.8 Ssl  rclone
    1     0 root   4.1  0.1 Ss   systemd
```

A leading `-` in `--sort` means descending, so `--sort=-%mem` puts the biggest memory consumers first — the fastest way to find what is filling RAM. **`--forest`** draws the hierarchy instead of a flat list:

```bash
$ ps -e --forest -o pid,comm
    2 kthreadd
    3  \_ pool_workqueue_release
    4  \_ kworker/R-rcu_gp
```

## The process hierarchy

Processes are not a flat list: every process is started by another, so they form a tree. A process that starts another is the **parent**; the one it starts is the **child**, and the child records its parent's PID as its PPID.

```bash
$ echo $$              # this shell's PID
551
$ sleep 5 &            # start a child
$ ps -o pid,ppid,comm -p 552
  PID  PPID COMMAND
  552   551 sleep
```

The child's PPID (`551`) is the shell's PID: the shell started it.

At the root of the tree is **PID 1**, the first process the kernel starts at boot; every other process descends from it. On a modern distribution PID 1 is **systemd**, which is why the services page is the natural sequel to this one — services are simply processes that systemd manages.

```bash
$ ps -p 1 -o pid,comm
  PID COMMAND
    1 systemd
```

PID 1 has a second job: **adopting orphans**. If a parent exits while its child is still running, the child is not killed — it is reparented to PID 1, which becomes its new parent:

```bash
$ ps -o ppid= -p 4812      # this process's parent has exited
1
```

This is exactly what happened with background jobs surviving a closed shell, in the multiplexer page.

## Process states

At any moment a process is in one of a few states. `ps` shows these as a single letter:

| Letter | State | Meaning |
|---|---|---|
| `R` | Running | executing on a CPU, or ready and waiting for one |
| `S` | Sleeping | waiting for something — input, a timer, a network reply |
| `D` | Uninterruptible sleep | waiting on disk or hardware; cannot be interrupted, not even by `kill -9` |
| `T` | Stopped | suspended, typically by `Ctrl-Z` or a stop signal |
| `Z` | Zombie | finished, but its exit status has not yet been collected |

Most processes on a healthy system are **`S`** — waiting for work, not consuming CPU. A long-lived **`D`** usually means a storage or hardware problem, and is the one state you cannot kill your way out of.

**Zombies** need explaining, since the name suggests something worse than it is. When a process exits, the kernel keeps a small record of it — just its PID and exit status — until the parent collects that status. In that window the process is a zombie: already dead, holding no memory and no CPU, kept only so the parent can learn how it ended.

```bash
$ ps -eo pid,ppid,stat,comm | grep ' Z '
  603   601 Z    zomb
$ ps aux | grep defunct
root  603  0.0  0.0   0   0 ?  Z  01:46  0:00 [zomb] <defunct>
```

Note the zeros: a zombie uses no memory. A few appearing and vanishing is normal. Many that persist indicate a buggy parent that is not collecting its children, and the fix is to restart or repair **the parent** — a zombie cannot be killed, as it is already dead.

## Live monitoring

`ps` gives a snapshot. To watch processes as they change — to see which one is consuming the CPU *now* — you need a display that refreshes itself. Two programs do this.

### `top` — the standard live monitor

**`top`** displays the processes using the most resources, redrawing every few seconds. It is present on essentially every Linux system, which makes it the one to know. Run it with no arguments; quit with `q`:

```bash
$ top
```

The screen has two parts. The **header** summarises the whole machine — uptime, load average, how many tasks are running or sleeping, and total CPU and memory use. Below it, one **row per process**, sorted by CPU use by default, with the same columns `ps` reports: PID, user, `%CPU`, `%MEM`, state, and command.

It is interactive; single keystrokes change what you see:

| Key | Effect |
|---|---|
| `P` | sort by CPU |
| `M` | sort by memory |
| `k` | kill a process — prompts for its PID |
| `u` | show only one user's processes |
| `1` | show each CPU core separately |
| `q` | quit |

### `htop` — the friendlier alternative

**`htop`** does the same job with a far better interface: colour-coded per-core meters, the full list scrollable with the arrow keys, and labelled function keys instead of memorised letters. Practical advantages over `top`:

- **`F5`** switches to a tree view, showing the parent/child hierarchy directly.
- **`F3`** searches for a process by name; **`F4`** filters the list.
- **`F9`** kills a selected process — you pick it from the list rather than typing a PID.
- Rows can be selected with the mouse.

```bash
$ htop
```

It is not installed by default on most distributions:

```bash
$ sudo apt install htop
```

Prefer `htop` where it is available; fall back to `top` on a machine you cannot install to.

## Finding processes by name

**`pgrep`** prints the PIDs of processes whose name matches a pattern — the direct way to answer "is it running, and what is its PID":

```
pgrep [-l] [-a] [-u USER] PATTERN
```

```bash
$ pgrep sleep
615
616
$ pgrep -l sleep          # -l adds the process name
615 sleep
616 sleep
$ pgrep -a sleep          # -a adds the full command line
615 sleep 300
$ pgrep -u alice ssh      # -u restricts to one user's processes
```

The **command line** is the program together with the arguments it was started with — what was actually typed to launch it. It is distinct from the process **name**, which is only the program itself. For a process started as `sleep 300`, the name is `sleep` while the command line is `sleep 300`:

```bash
$ ps -eo pid,comm --no-headers | grep sleep     # name only
  531 sleep
$ ps -eo pid,args --no-headers | grep '[s]leep' # full command line
  531 sleep 300
```

The distinction matters when several processes run the same program with different arguments — three `python3` processes running three different scripts share one name, and only the command line tells them apart. `pgrep -a` shows it, and **`-f`** makes `pgrep` *match* against it rather than against the name alone:

```bash
$ pgrep python3               # matches the name: all python processes
532
$ pgrep -f "time.sleep"       # matches the arguments too
532
```

**`pidof`** does much the same for an exact program name, printing all matching PIDs on one line:

```bash
$ pidof sleep
616 615
```

The difference: `pgrep` matches a **pattern** against the process name and takes filters like `-u`; `pidof` wants the **exact** name. `pgrep` is the more flexible of the two and the one to reach for by default.

Both are commonly used to feed a PID into another command, which is how the next page's `kill` is usually driven:

```bash
$ kill $(pgrep -f myapp)
```

Note the older habit of `ps aux | grep name`: it works, but it also matches the `grep` command itself, which is why `pgrep` exists and is preferable.

### `pstree` 

`pstree` - displays running processes as a tree structure.

For example:

```bash
$ pstree
systemd─┬─accounts-daemon───3*[{accounts-daemo}]
        ├─cron
        ├─networkd-dispat
        └─sshd───sshd───bash───pstree
```

`pstree username` - view tree for a precific user.

`pstree 615` - view tree for a specific PID.

**`-p`** - show process PID.

```bash
$ pstree -p
sshd(844)───sshd(1021)───bash(1022)───pstree(1540)
```

**`-a`** - show command arguments.

```bash
$ pstree -a
sshd -D
  └─sshd: user [priv]
      └─sshd: user@pts/0
          └─bash
              └─pstree -a
```

