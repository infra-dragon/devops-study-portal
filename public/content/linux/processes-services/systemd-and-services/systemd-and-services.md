# systemd and services

## What a service is

A **service** is a program meant to run in the background for as long as the machine is up, rather than being started by a person and watched at a terminal — a web server, a database, an SSH daemon. Such a program is also called a **daemon**.

Running one is more than just starting a process. Something has to start it at boot, in the right order relative to other services; restart it if it crashes; give it the right user and environment; collect its output somewhere readable; and stop it cleanly on shutdown. **systemd** is the program that does all of this.

## What systemd is

**systemd** is the **init system** and service manager on modern Linux distributions: the first process the kernel starts at boot (PID 1), and the parent of everything else. Its job is to bring the system up and to manage the services running on it for as long as it is up.

```bash
$ ps -p 1 -o pid,comm
  PID COMMAND
    1 systemd
```

Before systemd, this job belonged to **SysV init**, which started services by running shell scripts from `/etc/init.d/` one at a time, in an order fixed by numbers in their filenames. Two of its limitations explain how systemd works today: because scripts ran one after another, boot was slow, so **systemd starts services in parallel** and works out the order from dependencies each unit declares. And because each service was a long shell script, systemd replaced them with **short configuration files** — the unit files in the next section.

Every current distribution — Debian, Ubuntu, RHEL, Fedora, SUSE — uses systemd, so it is what you will administer. A handful of `/etc/init.d/` scripts may still linger on a system, but they are leftovers.

## Units

systemd does not manage only services. It manages **units** — the general name for anything it can control — and a service is one kind of unit. The type is the filename suffix:

| Suffix | Manages |
|---|---|
| `.service` | a program or daemon — the kind you will use most |
| `.timer` | running something on a schedule (systemd's alternative to cron) |
| `.target` | a group of units, used to define a state such as "multi-user" |

Units are named in full, `ssh.service`, but `systemctl` lets you drop `.service` since it is the common case: `systemctl status ssh` and `systemctl status ssh.service` are the same command.

Unit files live in three directories, and which one a file is in decides who owns it:

| Directory | Contents |
|---|---|
| `/lib/systemd/system/` | shipped by packages — **do not edit**; upgrades overwrite it |
| `/etc/systemd/system/` | the administrator's own units and overrides — **this is where you write yours**; takes precedence |
| `/run/systemd/system/` | runtime units, created dynamically and gone at reboot |

### Reading and changing a unit file

**`systemctl cat`** prints the unit file a service is actually using, so you do not have to know which directory it came from:

```bash
$ systemctl cat ssh
# /lib/systemd/system/ssh.service
[Unit]
Description=OpenBSD Secure Shell server
After=network.target
[Service]
ExecStart=/usr/sbin/sshd -D
Restart=on-failure
```

To change a setting, do not edit the packaged file — your change would be lost at the next upgrade. **`systemctl edit`** does it correctly: it creates a small **override file** under `/etc/`, containing only the settings you want to change.

```bash
$ sudo systemctl edit ssh
```

You write just the section and the line you are overriding:

```ini
[Service]
Restart=always
```

which is saved as `/etc/systemd/system/ssh.service.d/override.conf`. systemd reads the packaged file first, then applies your override on top, so everything else stays as the package intended. `systemctl cat` afterwards shows both files, in the order they are applied.

## `systemctl` — controlling units

**`systemctl`** is the command for every interaction with systemd. Its general form is a subcommand plus a unit name:

```
systemctl SUBCOMMAND [UNIT]
```

Managing services needs root, so these are normally run with `sudo` — the exception being read-only queries like `status`, which any user may run.

### Running state

These four change what is running *now*, and none of them survive a reboot on their own:

```bash
$ sudo systemctl start nginx        # start it now
$ sudo systemctl stop nginx         # stop it now
$ sudo systemctl restart nginx      # stop, then start
$ sudo systemctl reload nginx       # re-read config without stopping
```

**`restart` versus `reload`** is a distinction worth getting right. `restart` kills the process and starts a new one, so the service is briefly unavailable and every connection drops. `reload` asks the running process to re-read its configuration while continuing to serve — no downtime, no dropped connections. Prefer `reload` after a config change, when the service supports it. `reload-or-restart` reloads where possible and falls back to restarting.

### `status` — what a unit is doing

```bash
$ systemctl status ssh
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Tue 2026-07-28 09:14:02 UTC; 1 day 4h ago
   Main PID: 812 (sshd)
      Tasks: 1 (limit: 4557)
     Memory: 5.8M
        CGroup: /system.slice/ssh.service
                └─812 "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups"

Jul 29 13:20:44 vm sshd[1042]: Accepted publickey for alice from 10.0.0.5
```

Two lines carry most of the information, and they answer two different questions:

- **`Loaded:`** — which file the unit came from, and whether it is **enabled** (starts at boot).
- **`Active:`** — whether it is running **right now**, and for how long.

So a unit can be `active (running)` but `disabled` — running now, but it will not come back after a reboot — or `inactive (dead)` but `enabled`, meaning it is stopped now but will start at next boot. The last few log lines are included, which is often enough to diagnose a failure without going to the journal.

### Boot behaviour: `enable`, `disable`, `mask`

Whether a service starts at boot is separate from whether it is running now:

```bash
$ sudo systemctl enable nginx       # start at boot
$ sudo systemctl disable nginx      # do not start at boot
$ sudo systemctl enable --now nginx # enable and start immediately
```

`enable` is not magic: it creates a **symlink** to the unit file inside a `.wants` directory, which is how systemd records "when reaching this target, start this unit". You can see the mechanism on any system:

```bash
$ ls -l /etc/systemd/system/multi-user.target.wants/
e2scrub_reap.service -> /lib/systemd/system/e2scrub_reap.service
```

**`mask`** goes further than `disable`. A disabled unit can still be started by hand or pulled in as another unit's dependency; a masked unit cannot be started at all, by anyone or anything:

```bash
$ sudo systemctl mask nginx
$ sudo systemctl unmask nginx
```

It works by symlinking the unit name to `/dev/null`, so nothing can load it:

```bash
$ ls -l /etc/systemd/system/nginx.service
nginx.service -> /dev/null
```

Use `mask` when a service must stay off — commonly to stop a package's service from starting itself after an upgrade, or to keep a conflicting service out of the way.

### Listing units

**`list-units`** shows units systemd has **loaded** — in practice, what is active now:

```bash
$ systemctl list-units --type=service
$ systemctl list-units --type=service --state=running
$ systemctl --failed                    # the useful one: what is broken
```

**`list-unit-files`** shows every unit file **installed on disk**, whether loaded or not, with its enabled/disabled state:

```bash
$ systemctl list-unit-files --type=service
UNIT FILE                    STATE     PRESET
apt-daily.service            static    enabled
ssh.service                  enabled   enabled
```

The difference: `list-units` answers "what is running", `list-unit-files` answers "what is installed and will it start at boot". Add `is-active` and `is-enabled` for scripts, which answer one question with an exit status:

```bash
$ systemctl is-active nginx
active
$ systemctl is-enabled nginx
enabled
```

## `journalctl` — reading the logs

systemd captures everything its services write to stdout and stderr into a central, indexed store called the **journal**. **`journalctl`** reads it. This replaces hunting through separate files in `/var/log/` for each service.

```
journalctl [OPTIONS] [-u UNIT]
```

The flags that do the work:

| Flag | Effect |
|---|---|
| `-u UNIT` | only this unit's messages |
| `-f` | follow — print new lines as they arrive, like `tail -f` |
| `-n N` | the last N lines (default 10) |
| `--since` / `--until` | limit by time |
| `-p LEVEL` | only this priority and worse |
| `-b` | only the current boot |
| `-k` | kernel messages only |
| `-r` | newest first |

```bash
$ journalctl -u nginx                        # everything from nginx
$ journalctl -u nginx -f                     # watch it live
$ journalctl -u nginx -n 50                  # the last 50 lines
$ journalctl -u nginx --since "10 min ago"   # recent only
$ journalctl -u nginx -p err                 # errors and worse
$ journalctl -u nginx --since today -p warning
```

`--since` and `--until` accept both plain dates and human phrasing: `"2026-07-29 14:00"`, `"1 hour ago"`, `yesterday`, `today`.

Priorities for `-p` run from most to least severe: `emerg`, `alert`, `crit`, `err`, `warning`, `notice`, `info`, `debug`. Naming one includes everything more severe, so `-p err` shows errors, criticals, and above.

The everyday debugging combination is a failing service plus its recent errors:

```bash
$ systemctl status myapp        # is it running, and why did it stop
$ journalctl -u myapp -n 50     # what it said before it stopped
```

By default the journal is stored under `/var/log/journal/` and survives reboots, letting `-b -1` reach the previous boot — useful for diagnosing a crash. If that directory does not exist, the journal is kept in memory only and is lost at reboot.

## `service` — the legacy command

**`service`** is the older SysV command, kept as a compatibility wrapper that forwards to `systemctl`:

```bash
$ sudo service nginx restart      # equivalent to: systemctl restart nginx
$ sudo service nginx status
```

It still works, and you will meet it in older documentation and scripts. Use `systemctl` in anything you write: `service` supports only the basic verbs and cannot express `enable`, `mask`, or any of the querying above.

The same applies to `/etc/init.d/` scripts, which on a systemd machine are either compatibility shims or leftovers from packages that never modernised.