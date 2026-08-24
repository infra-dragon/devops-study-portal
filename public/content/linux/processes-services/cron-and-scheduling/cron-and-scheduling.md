# Cron and scheduling

## What cron is

**cron** is a service that runs commands on a schedule. It starts at boot, wakes up every minute, checks which jobs are due, and runs them — without anyone logged in.

A **cron job** is one line: a schedule plus a command. That line lives in a **crontab** ("cron table"), a file listing the jobs belonging to one user.

Typical uses are the unglamorous ones: nightly backups, clearing out old files, rotating logs, sending a report every Monday, polling something every five minutes.

## The schedule syntax

Five fields, separated by spaces, then the command:

```
*  *  *  *  *  command
│  │  │  │  │
│  │  │  │  └── day of week   (0-6, Sunday = 0 or 7; or sun,mon,tue…)
│  │  │  └───── month         (1-12; or jan,feb,mar…)
│  │  └──────── day of month  (1-31)
│  └─────────── hour          (0-23)
└────────────── minute        (0-59)
```

Each field accepts four things:

| Form | Meaning | Example |
|---|---|---|
| `*` | every value | `*` in hour = every hour |
| a number | exactly that value | `30` in minute = at :30 |
| a list | several values | `8,20` in hour = 8am and 8pm |
| a range | a span | `1-5` in day of week = Mon–Fri |
| a step | every *n*th value | `*/15` in minute = every 15 minutes |

Read a line by asking "when do all five fields match?" — the job runs at every minute where they all agree.

```bash
*/15 * * * *      # every 15 minutes
0 2 * * *         # every day at 02:00
30 8,20 * * *     # every day at 08:30 and 20:30
0 9 * * 1-5       # weekdays at 09:00
0 0 1 * *         # the 1st of every month, midnight
```

The mistake to avoid is leaving a field as `*` when you meant to pin it. `* 2 * * *` is not "2am daily" — it is *every minute* during the 2am hour, sixty runs. The minute field almost always needs a number.

### Shortcuts

Cron accepts a few named schedules, which are clearer than the equivalent stars:

| Shortcut | Same as |
|---|---|
| `@hourly` | `0 * * * *` |
| `@daily` | `0 0 * * *` |
| `@weekly` | `0 0 * * 0` |
| `@monthly` | `0 0 1 * *` |
| `@reboot` | once, at every boot |

```bash
@daily /usr/local/bin/backup.sh
```

`@reboot` is the odd one out — not a schedule at all, but a way to run something once when the machine starts.

## `crontab` — managing your jobs

**`crontab`** is the command for a user's own cron jobs.

```
crontab -e      # edit
crontab -l      # list
crontab -r      # remove all
```

**`crontab -e`** opens your crontab in an editor and installs it when you save. Always use this rather than editing the file directly: `crontab -e` checks the syntax before installing, and tells cron to reload.

```bash
$ crontab -e
```

**`crontab -l`** prints what is currently installed:

```bash
$ crontab -l
# nightly backup
0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1
```

**`crontab -r`** deletes the whole crontab, with no confirmation — an easy way to lose everything. Check with `-l` first.

Each user has their own crontab, and jobs run **as that user**, with that user's permissions. `sudo crontab -e` edits root's, which is a different table from your own.

The files themselves live in `/var/spool/cron/crontabs/`, mode `600` and owned by the user, which is why you go through the `crontab` command instead of writing there:

```bash
$ sudo ls -l /var/spool/cron/crontabs/
-rw------- 1 root crontab 243 Jul 30 01:45 root
```

## System-wide cron

Beyond per-user crontabs there are places for jobs that belong to the system. The difference from a user crontab: these files have an **extra field for the user** to run the job as.

**`/etc/crontab`** is the main system table. Note the `root` column that a user crontab does not have:

```bash
17 *  * * *  root  cd / && run-parts --report /etc/cron.hourly
```

**`/etc/cron.d/`** holds separate files in the same format, one per package or purpose. This is the right place for jobs installed by configuration management or your own deployments — a self-contained file is easier to add and remove than an edit inside `/etc/crontab`.

**`/etc/cron.hourly/`, `.daily/`, `.weekly/`, `.monthly/`** work differently: they contain **executable scripts**, not crontab lines, and everything in them runs at that interval. You choose the frequency by picking the directory and get no control over the exact time.

```bash
$ sudo cp cleanup.sh /etc/cron.daily/
$ sudo chmod +x /etc/cron.daily/cleanup.sh
```

Those four are driven by the `/etc/crontab` lines above, via `run-parts`, which simply runs every executable in a directory.

## Why cron jobs fail

Nearly every broken cron job comes from the same two causes.

### The environment is not your shell's

A cron job does not run in your login shell. It gets a minimal environment: no startup files are read, so no `~/.bashrc`, no aliases, and a short `PATH`. `SHELL` is `/bin/sh`, not bash.

Here is a job that printed its own environment:

```
PATH  = /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SHELL = /bin/sh
HOME  = /root
```

The interactive shell on the same machine had extra directories in `PATH` that cron does not. So a command that works when you type it can fail under cron with `command not found`.

Two fixes, both simple:

**Use absolute paths** for every command in a cron job:

```bash
0 2 * * * /usr/local/bin/backup.sh      # not: backup.sh
```

**Or set the variables you need** at the top of the crontab, which applies to all jobs below:

```bash
PATH=/usr/local/bin:/usr/bin:/bin
SHELL=/bin/bash
0 2 * * * backup.sh
```

Also remember `SHELL=/bin/sh`: bash-only syntax in the command itself will not work unless you set `SHELL=/bin/bash` or run the logic inside a script with a bash shebang.

### The output goes nowhere you look

If a cron job prints anything, cron tries to email it to the user. On a machine with no mail configured — which is most machines — that output is simply lost. A job can fail every night for months in complete silence.

**Always redirect the output.** The standard form sends both normal output and errors to a log file:

```bash
0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1
```

`>>` appends, so the log accumulates; `2>&1` sends errors to the same file. Without that second part, error messages — the ones you actually want — go missing.

To discard output deliberately, be explicit, and still keep the errors:

```bash
0 * * * * /usr/local/bin/poll.sh > /dev/null 2>&1     # discard everything
0 * * * * /usr/local/bin/poll.sh > /dev/null          # discard normal output, keep errors emailed
```

Then check whether the job ran at all: cron logs each execution to the system journal.

```bash
$ journalctl -u cron --since today
$ grep CRON /var/log/syslog
```

## cron or systemd timers?

systemd has its own scheduler, the **timer** unit, which pairs with a `oneshot` service like the one from the previous page. A real example:

```ini
[Unit]
Description=Discard unused filesystem blocks once a week

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
```

The practical comparison:

| | cron | systemd timer |
|---|---|---|
| Setup | one line | two files (`.timer` + `.service`) |
| Logs | you must redirect them yourself | captured in the journal automatically |
| Missed runs (machine off) | skipped | `Persistent=true` runs it on next boot |
| Dependencies | none | can require other units be ready first |
| Checking status | read the crontab | `systemctl list-timers` |

**Use cron** for simple, self-contained jobs, and when you want something a colleague can read at a glance. **Use a timer** when the job matters enough to need reliable logging, must not be missed if the machine was off, or depends on another service being up.

Both are correct choices, and both are in wide use. Cron's advantage is that it is universal and takes one line; a timer's advantage is that it behaves like everything else systemd manages.

```bash
$ systemctl list-timers        # what is scheduled, and when it next runs
```