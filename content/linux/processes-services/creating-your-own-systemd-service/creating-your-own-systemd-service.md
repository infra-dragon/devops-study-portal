# Creating your own systemd service

## The goal

You have a program — a script, an API server, a worker — and you want the system to treat it like any other service: start it at boot, restart it if it crashes, run it as the right user, and collect its logs. Doing that means writing one small file.

This page builds a complete service file line by line, then installs it.

## The three sections

A **unit file** is plain text, divided into sections with `Key=value` lines inside them. A service uses three:

| Section | Answers |
|---|---|
| `[Unit]` | What is this, and what must be ready before it starts? |
| `[Service]` | What exactly do you run, and how do you keep it running? |
| `[Install]` | When should it start at boot? |

Here is the whole file, `myapp.service`, before we take it apart:

```ini
[Unit]
Description=My application
After=network.target

[Service]
Type=simple
User=myapp
WorkingDirectory=/opt/myapp
EnvironmentFile=/etc/myapp/env
ExecStart=/opt/myapp/bin/server --port 8080
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Fifteen lines, and about half of them are optional. Now each part.

## Naming the file

The filename is not decoration — it *is* the service's name. A file called `myapp.service` creates a service you control as `systemctl start myapp`. The `Description=` line inside plays no part in this; only the filename does.

Two halves, with different rules.

**The suffix is required and must match the unit type.** `.service` for a service — that is what tells systemd which kind of unit this is. Anything else is refused outright:

```bash
$ systemd-analyze verify ./myapp          # no suffix
Failed to prepare filename ./myapp: Invalid argument
$ systemd-analyze verify ./myapp.svc      # wrong suffix
Failed to prepare filename ./myapp.svc: Invalid argument
```

**The base name is yours to choose.** Letters, digits, dashes, and underscores all work. The conventions that shipped units follow, and that you should too:

- **lowercase**, since you will type it constantly.
- **dashes between words** — `web-api.service`, not `webApi.service`.
- **the name of the thing, not what it does** — `myapp.service`, not `start-myapp.service`. You already say the verb: `systemctl start myapp`.
- **no `.service` in the base name** — `nginx.service`, never `nginx-service.service`.

So `myapp` in this page is a placeholder for your program's name; a real one would be `web-api.service`, `billing-worker.service`, `metrics-exporter.service`.

## `[Unit]` — description and ordering

```ini
[Unit]
Description=My application
After=network.target
```

**`Description=`** is a one-line human name. It is what appears in `systemctl status` and in log messages, so make it useful.

**`After=`** controls *ordering*: this service will not start until the listed unit has started. `network.target` is the usual one — a service that opens a socket or calls out to a database should not start before the network is up.

`After=` only orders; it does not require. If you need the other unit to actually be running, and want your service to fail when it is not, use **`Requires=`** as well. In practice `After=network.target` alone covers most cases.

## `[Service]` — what to run

This is the section that matters. Two lines are essential; the rest are there to make the service behave well.

### `ExecStart=` — the command

```ini
ExecStart=/opt/myapp/bin/server --port 8080
```

**`ExecStart=`** is the command systemd runs. Two rules:

**Use absolute paths.** There is no shell here, so `PATH` is not searched — `/opt/myapp/bin/server`, not `server`.

**The program must stay in the foreground.** systemd itself does the backgrounding; your program should just run and keep running, writing its output to stdout. A program that daemonises itself, or exits immediately, needs a different `Type=` (below).

Because there is no shell, shell features do not work here — no pipes, no `&&`, no `$VAR` expansion, no redirection. If you need them, run a script instead and put the shell logic inside it.

Two relatives you will meet:

- **`ExecStartPre=`** runs before `ExecStart` — a migration, a permission fix, a check.
- **`ExecReload=`** is the command `systemctl reload` sends, usually `/bin/kill -HUP $MAINPID`.

### `Type=` — how systemd knows it started

```ini
Type=simple
```

**`Type=`** tells systemd what to expect from the program, so it can tell when the service is up.

| Value | Use when |
|---|---|
| `simple` | the program runs in the foreground and does not exit — **the default, and correct for most services** |
| `oneshot` | the program does one job and exits, e.g. a backup script |
| `forking` | the program forks a background copy and the original exits — traditional daemons |
| `notify` | the program tells systemd itself when it is ready |

If unsure, use `simple` and make your program stay in the foreground. Getting `Type=` wrong is the most common reason a new service looks broken: with `simple`, a program that exits immediately makes systemd think it crashed.

### `User=` — who it runs as

```ini
User=myapp
```

Without this, the service runs as **root**, which it almost never needs. **`User=`** runs it as an ordinary account instead, so a flaw in your program cannot take the whole machine — the reasoning from the permissions chapter, applied.

Create a dedicated account for it: a system account with no login and no home directory.

```bash
$ sudo useradd --system --no-create-home --shell /usr/sbin/nologin myapp
$ getent passwd myapp
myapp:x:996:996::/home/myapp:/usr/sbin/nologin
```

`--system` puts the UID below 1000 (the system range), and `nologin` means nobody can log in as it. **`Group=`** works the same way if the group should differ from the user.

### `WorkingDirectory=` and the environment

```ini
WorkingDirectory=/opt/myapp
EnvironmentFile=/etc/myapp/env
```

**`WorkingDirectory=`** sets the directory the program starts in, which matters for any program that uses relative paths.

**`EnvironmentFile=`** points to a file of environment variables to pass to the service — the standard way to supply configuration and secrets without putting them in the unit file. The format is plain `KEY=value`, one per line, with no `export`:

```bash
$ cat /etc/myapp/env
PORT=8080
LOG_LEVEL=info
DATABASE_URL=postgres://localhost/demo
```

Because it holds secrets, restrict it so only the service can read it:

```bash
$ sudo chown root:myapp /etc/myapp/env
$ sudo chmod 640 /etc/myapp/env
```

For one or two values, **`Environment=`** sets them inline instead: `Environment=LOG_LEVEL=info`.

### `Restart=` — staying up

```ini
Restart=on-failure
RestartSec=5
```

**`Restart=`** is why running under systemd beats running by hand: it brings the service back automatically.

| Value | Behaviour |
|---|---|
| `no` | never restart (the default) |
| `on-failure` | restart if it crashes or exits non-zero — **the usual choice** |
| `always` | restart even after a clean exit, and after `systemctl stop`… only on reboot |

`on-failure` is right for most services: a crash is repaired, but a deliberate stop is respected. **`RestartSec=`** is how long to wait first — a few seconds avoids hammering a dependency that is also restarting.

## `[Install]` — starting at boot

```ini
[Install]
WantedBy=multi-user.target
```

This section is used only by `systemctl enable`. **`WantedBy=`** names the target that should pull your service in when the system reaches it.

A **target** is a named point in the boot process — a group of units that together mean "the system has reached this state". The system boots by moving through them in order, each requiring the one before it:

```
basic.target  →  multi-user.target  →  graphical.target
(filesystems,     (network, services,    (plus the desktop)
 devices ready)    a working server)
```

**`multi-user.target`** is the one you want: the state of a fully working, network-capable, multi-user system without a graphical desktop. It is where servers stop, and where all normal server services are attached. Saying `WantedBy=multi-user.target` therefore means *"start my service once the system is up and running normally."*

You can confirm this is where services live:

```bash
$ ls /etc/systemd/system/multi-user.target.wants/
e2scrub_reap.service  remote-fs.target
```

That directory is exactly what `systemctl enable` writes into — the symlink from the previous page. Without an `[Install]` section a unit can still be started by hand, but it cannot be enabled, because nothing tells systemd when to want it.

## Installing it

Four steps, in order.

**1. Put the file in `/etc/systemd/system/`** — the administrator's directory, named after the service:

```bash
$ sudo nano /etc/systemd/system/myapp.service
```

**2. Tell systemd to re-read its files.** systemd does not notice new or changed unit files on its own:

```bash
$ sudo systemctl daemon-reload
```

**Forgetting this is the most common mistake.** Your edit exists on disk but systemd is still running the old version, so nothing you changed takes effect.

**3. Start it, and check it actually started:**

```bash
$ sudo systemctl start myapp
$ systemctl status myapp
```

**4. Enable it, so it comes back after a reboot:**

```bash
$ sudo systemctl enable myapp
```

Or do both at once with `sudo systemctl enable --now myapp`.

## Checking your work

Before starting a service, **`systemd-analyze verify`** parses the file and reports mistakes — including misspelled keys, which systemd would otherwise silently ignore:

```bash
$ systemd-analyze verify /etc/systemd/system/myapp.service
myapp.service:6: Unknown key name 'Restrt' in section 'Service', ignoring.
```

That "ignoring" is worth noticing: a typo does not produce an error at runtime, it just means your setting is not applied. Verifying catches it.

When a service will not start, two commands tell you almost everything:

```bash
$ systemctl status myapp        # what systemd thinks happened
$ journalctl -u myapp -n 50     # what the program itself said
```

Because `ExecStart` output goes to the journal, your program's own error messages are right there — usually a missing file, a permission denied, or a port already in use.

## What people actually use this for

Four patterns cover nearly every custom service you will write.

### 1. Running your own application

The most common case by far: you deployed an API, a worker, or a bot, and it needs to survive crashes and reboots. This is the `myapp.service` built above — `Type=simple`, a dedicated `User=`, `Restart=on-failure`.

Before systemd, people did this with `nohup ./server &` and hoped, or wrote init scripts. A unit file replaces all of it, and gives you `status`, logs, and automatic restart for free.

### 2. Wrapping a program that was never designed to be a service

A plain script — a queue consumer, a file watcher, a data sync loop — becomes a managed service with the same file. The only requirement is the foreground rule: the script must keep running rather than exit or background itself.

```ini
[Service]
Type=simple
ExecStart=/usr/local/bin/watch-queue.sh
Restart=always
RestartSec=10
```

`Restart=always` suits this one: a script with no clean-exit case should always come back.

### 3. A one-off job, usually on a schedule

Backups, log cleanups, report generation — things that run, finish, and exit. These use `Type=oneshot` and no `Restart=`:

```ini
[Unit]
Description=Nightly database backup

[Service]
Type=oneshot
User=backup
ExecStart=/usr/local/bin/backup.sh
```

On its own this runs only when you start it. Paired with a matching `.timer` unit it runs on a schedule — systemd's alternative to cron, which the next page covers. The advantage over a cron entry is that the job's output goes to the journal automatically, so a failed backup is visible in `journalctl` rather than lost.

### 4. Adjusting a service someone else shipped

You will change existing services more often than you write new ones — making `nginx` restart on failure, giving a database a higher file-descriptor limit, adding an environment variable. Do not edit the packaged unit file; use the override from the previous page:

```bash
$ sudo systemctl edit nginx
```

```ini
[Service]
Restart=always
RestartSec=3
```

Same directives, same rules — only the delivery differs, and the package's own file stays untouched through upgrades.