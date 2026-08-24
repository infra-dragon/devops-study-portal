# Linux Course

## Table of Contents

| # | Chapter |
|---|---------|
| 0 | [Introduction to Linux](#0-introduction-to-linux) |
| 1 | [Files & Filesystem — Navigation & Viewing](#1-files--filesystem--navigation--viewing) |
| 2 | [Files & Filesystem — Operations & Search](#2-files--filesystem--operations--search) |
| 3 | [Text Processing](#3-text-processing) |
| 4 | [Environment & Shell Configuration](#4-environment--shell-configuration) |
| 5 | [Users & Permissions](#5-users--permissions) |
| 6 | [Processes & Services](#6-processes--services) |
| 7 | [Disk, Storage & Filesystems](#7-disk-storage--filesystems) |
| 8 | [Networking](#8-networking) |
| 9 | [Package Management](#9-package-management) |
| 10 | [Shell Scripting](#10-shell-scripting) |
| 11 | [System Internals, Monitoring & Troubleshooting](#11-system-internals-monitoring--troubleshooting) |

---

## 0. Introduction to Linux

- What is Linux — kernel, distros, why it's everywhere
- Linux vs Unix vs Windows — key differences
- Why Linux matters for DevOps and SWE
- What is a shell and CLI
- Why use CLI over GUI
- Shell types: Bourne (`sh`), C (`csh`), Z (`zsh`), Bash (`bash`) — differences and when to use each
- How to get a Linux environment — VM, WSL, cloud instance, Docker

---

## 1. Files & Filesystem — Navigation & Viewing

### 1.1 — How commands work

- Command structure: command, flags, arguments
- `man`, `--help`, `info` — reading documentation
- `echo`, `type`, `which`
- Command history: `history`, `!!`, `Ctrl+R`

### 1.2 — Filesystem structure

- Linux Filesystem Hierarchy Standard (FHS) — why it matters
- Key directories: `/`, `/etc`, `/var`, `/home`, `/tmp`, `/opt`, `/usr`, `/bin`, `/sbin`, `/proc`, `/sys`
- Absolute vs relative paths
- `pwd`, `cd`, `ls` (with useful flags: `-la`, `-lh`, `-lt`)

### 1.3 — Viewing file content

- `cat`, `less`, `more`
- `head`, `tail`, `tail -f` — following live logs
- `file` — identify file type without extension
- `stat` — metadata: size, permissions, timestamps

### 1.4 — Wildcards and globbing

- `*`, `?`, `[abc]`, `[a-z]`, `{a,b,c}`
- Where globbing happens (shell expansion, not the command)

### 1.5 — Redirection and pipes

- stdin, stdout, stderr — what they are, file descriptors (0, 1, 2)
- `>`, `>>`, `<` — output and input redirection
- `2>&1`, `2>` — redirecting stderr
- `/dev/null` — discarding output
- `|` — pipes: chaining commands
- `tee` — write to file and stdout simultaneously
- `;`, `&&`, `||`, `\` — command chaining and line continuation
- What `&` means at the end of a command (background)
- `xargs` — building argument lists from stdin

---

## 2. Files & Filesystem — Operations & Search

### 2.1 — File and directory operations

- `cp`, `mv`, `rm`, `rm -rf` — and why to be careful
- `mkdir`, `mkdir -p`, `rmdir`
- `touch` — create or update timestamps
- `rename` — batch renaming

### 2.2 — Archiving and compression

- Why archiving and compression are different operations
- `tar` — create, extract, list (`.tar`, `.tar.gz`, `.tar.bz2`, `.tar.xz`)
- `gzip`, `gunzip`, `bzip2`, `xz` — compression formats and tradeoffs
- `zip`, `unzip`

### 2.3 — Searching for files

- `find` — by name, type, size, modification time, permissions
- `find ... -exec` — acting on results
- `locate` / `mlocate` — fast indexed search
- `which`, `whereis` — locating binaries

### 2.4 — Links

- Inodes — what they are and why links work the way they do
- Hard vs symbolic links — differences, use cases, pitfalls
- `ln`, `ln -s`, `readlink`

---

## 3. Text Processing

### 3.1 — Basic text tools

- `wc` — count lines, words, bytes
- `cut` — extract fields and columns
- `tr` — translate, squeeze, delete characters
- `sort`, `uniq`
- `diff`, `patch` — comparing files and applying changes

### 3.2 — Pattern matching and extraction

- `grep` — basic regex, `-E` (extended), `-i`, `-r`, `-v`, `-l`, `-n`
- Regex fundamentals: anchors, character classes, quantifiers

### 3.3 — Stream editing and transformation

- `sed` — substitution, deletion, in-place editing (`-i`)
- `awk` — field processing, conditionals, arithmetic

### 3.4 — Structured data

- `jq` — JSON parsing, filtering, transformation
- `yq` — YAML parsing (used heavily in DevOps/K8s configs)
- Working with CSV using `awk` and `cut`

---

## 4. Environment & Shell Configuration

- What are environment variables and why they matter
- `export`, `env`, `printenv`, `unset`
- `PATH` — how command lookup works, how to extend it safely
- `.bashrc` vs `.bash_profile` vs `.profile` — login vs interactive shells, when each file runs
- `source` / `.` — reloading config in the current shell
- Aliases — defining, persisting, when not to use them
- Shell options: `set -x` (debug trace), `set -e`, `shopt`
- Terminal multiplexers: `tmux` / `screen` — keeping sessions alive over SSH

---

## 5. Users & Permissions

### 5.1 — Users and groups

- What are users and groups, UID/GID
- Where users, passwords, groups are stored: `/etc/passwd`, `/etc/shadow`, `/etc/group`
- `whoami`, `id`, `groups`
- `useradd`, `usermod`, `userdel`
- `passwd` — changing passwords
- `groupadd`, `groupmod`, `gpasswd`

### 5.2 — File permissions

- Permission model: owner, group, other
- Read, write, execute — meaning differs for files vs directories
- Octal notation vs symbolic notation
- `ls -l` — reading the permission string
- `chmod` — absolute and relative modes
- `chown`, `chgrp`
- `umask` — default permission mask

### 5.3 — Special permissions and privilege escalation

- Setuid, setgid, sticky bit — what they do and security implications
- `sudo`, `su`, `visudo`
- `/etc/sudoers` — structure, user rules, `NOPASSWD`

---

## 6. Processes & Services

### 6.1 — Processes

- What is a process — PID, PPID, states (running, sleeping, zombie, stopped)
- Process hierarchy: init/systemd as PID 1
- `ps aux`, `ps -ef` — process snapshots
- `top`, `htop` — live monitoring
- `pgrep`, `pidof` — finding processes by name

### 6.2 — Signals and kill

- What is a signal — common signals: SIGTERM, SIGKILL, SIGHUP, SIGINT
- `kill`, `kill -9`, `kill -HUP`, `pkill`, `killall`
- Why SIGKILL should be a last resort

### 6.3 — Background jobs and process control

- `&`, `jobs`, `fg`, `bg`
- `nohup`, `disown` — surviving terminal close
- `nice`, `renice` — process priority

### 6.4 — systemd and services

- What is systemd, why it replaced SysV init
- `systemctl start` / `stop` / `restart` / `reload` / `status`
- `systemctl enable` / `disable` / `mask` — boot behavior
- `systemctl list-units`, `list-unit-files`
- `journalctl` — reading logs: `-u`, `-f`, `--since`, `-n`, `-p`
- `service` — legacy alias, still seen in older scripts

### 6.5 — Creating your own systemd service

- Unit file anatomy: `[Unit]`, `[Service]`, `[Install]` sections
- Key directives: `ExecStart`, `Restart`, `User`, `WorkingDirectory`, `EnvironmentFile`
- Where service files live: `/etc/systemd/system/`
- `systemctl daemon-reload` after changes

### 6.6 — Cron and scheduling

- What cron is and when to use it vs systemd timers
- `crontab -e`, `crontab -l`, cron syntax `* * * * *`
- System-wide cron: `/etc/crontab`, `/etc/cron.d/`, `/etc/cron.daily/`
- Capturing cron output — avoiding silent failures

---

## 7. Disk, Storage & Filesystems

> Missing from every previous version. Critical for any DevOps work involving VMs, cloud instances, or containers with persistent storage.

### 7.1 — Disks and partitions

- How Linux sees disks: block devices, `/dev/sda`, `/dev/nvme0n1`
- `lsblk` — list block devices and their tree
- `fdisk`, `parted` — partition management
- Partition types: primary, extended, GPT vs MBR

### 7.2 — Filesystems

- What a filesystem is — how it sits on top of a partition
- Common types: `ext4`, `xfs`, `btrfs` — differences and defaults
- `mkfs` — formatting a partition with a filesystem
- `fsck` — filesystem check and repair

### 7.3 — Mounting

- What mounting means — the mount point concept
- `mount`, `umount`
- `/etc/fstab` — persistent mounts at boot, UUID vs device name
- `df -h` — disk space usage
- `du -sh` — directory size

### 7.4 — LVM (Logical Volume Management)

- Why LVM exists — the problem with fixed partitions
- Concepts: Physical Volume (PV) → Volume Group (VG) → Logical Volume (LV)
- `pvcreate`, `vgcreate`, `lvcreate`
- Extending a volume online (`lvextend`, `resize2fs` / `xfs_growfs`)
- LVM snapshots — instant backups for safe deployments

### 7.5 — Swap

- What swap is, when it's used, performance implications
- `swapon`, `swapoff`, `free -h`

---

## 8. Networking

### 8.1 — Interfaces and IP

- `ip addr`, `ip link`, `ip route`
- `ifconfig` — legacy, still seen
- How to check your own IP (local vs public)

### 8.2 — Connectivity testing

- `ping`, `traceroute`, `mtr`
- `nc` (netcat) — testing TCP/UDP connections

### 8.3 — DNS

- `dig`, `nslookup`, `host`
- `/etc/hosts` — local name overrides
- `/etc/resolv.conf` — DNS server configuration
- `/etc/nsswitch.conf` — resolution order

### 8.4 — Ports and sockets

- `ss -tlnp`, `netstat -tulnp`
- Difference between open, listening, established connections
- Well-known ports: 22, 80, 443, 3306, 5432, 6379…

### 8.5 — Firewall

- What a firewall does at the kernel level (netfilter)
- `ufw` — simple firewall for Ubuntu/Debian: allow, deny, status
- `firewalld` — zone-based firewall for RHEL/CentOS: `firewall-cmd`
- `iptables` — concepts: tables, chains (INPUT/OUTPUT/FORWARD), rules
- View current rules: `iptables -L -n -v`
- How `ufw` and `firewalld` sit on top of iptables/nftables

### 8.6 — SSH

- How SSH works — asymmetric keys, key exchange, why it's secure
- `ssh`, `ssh-keygen`, `ssh-copy-id`
- `~/.ssh/config` — aliases, jump hosts, key selection
- `~/.ssh/authorized_keys` — how key-based auth is set up server-side
- SSH agent: `ssh-agent`, `ssh-add`
- `scp` and `rsync` — remote file transfer

### 8.7 — Downloading and transferring files

- `curl` — HTTP requests, REST APIs, headers, auth
- `wget` — recursive download, mirroring

---

## 9. Package Management

### 9.1 — Concepts

- What is a package manager — packages, dependencies, repositories
- The two major ecosystems: rpm-based (RHEL/CentOS/Fedora) vs deb-based (Debian/Ubuntu)

### 9.2 — RPM-based (Red Hat / CentOS / Fedora)

- `rpm` — low-level: install, query, verify, remove
- `yum` — older but still common: install, update, remove, repolist
- `dnf` — modern replacement for yum: same commands, better dependency resolution

### 9.3 — DEB-based (Debian / Ubuntu)

- `apt` / `apt-get` — install, update, upgrade, remove, autoremove
- `apt-cache search`, `apt show`
- `dpkg` — low-level .deb tool

### 9.4 — Repository management

- How to add package repositories and import GPG keys
- `/etc/apt/sources.list` (Debian) vs `/etc/yum.repos.d/` (RHEL)
- Cleaning caches: `apt clean`, `dnf clean all` — why it matters

---

## 10. Shell Scripting

### 10.1 — Script basics

- Shebang line: `#!/bin/bash` vs `#!/usr/bin/env bash`
- Making scripts executable: `chmod +x`
- Script execution: `./script.sh` vs `bash script.sh` vs `source script.sh`

### 10.2 — Variables and data

- Variable assignment: `VAR=val` (no spaces)
- Quoting: `"$VAR"`, `'literal'`, `${VAR}`, `${VAR:-default}`
- Command substitution: `$(command)`
- Arithmetic: `$(( a + b ))`
- Arrays: `arr=(a b c)`, `${arr[@]}`

### 10.3 — Control flow

- Conditionals: `if [ condition ]; then…fi`
- Test operators: `-f`, `-d`, `-z`, `-n`, `-eq`, `-lt`, `==`
- `[[ ]]` vs `[ ]` — when to use each
- Loops: `for`, `while`, `until`, `break`, `continue`
- `case` statements

### 10.4 — Functions and arguments

- Functions: `myfunc() { ...; return 0; }`
- Positional arguments: `$1`, `$2`, `$@`, `$#`, `$0`
- `getopts` — parsing flags (`-v`, `-f file`) in scripts
- Here-docs: `<<EOF` — multi-line strings and stdin

### 10.5 — Robustness and error handling

- `set -e`, `set -u`, `set -o pipefail` — fail fast
- `set -x` — debug tracing
- `trap` — cleanup on exit or signal
- Exit codes: `$?`, meaning of 0 vs non-zero
- Logging in scripts: timestamps, levels, redirecting to files

---

## 11. System Internals, Monitoring & Troubleshooting

> Replaces the thin "Linux Internals" chapter. Combines kernel knowledge, performance tools, and the debugging skills that separate junior from senior engineers.

### 11.1 — The Linux kernel and boot process

- Kernel, hardware, userspace — the three layers
- Boot sequence: BIOS/UEFI → bootloader (GRUB) → kernel → initrd → systemd
- `uname -a`, `/etc/os-release` — kernel and distro version
- `dmesg` — kernel ring buffer, boot messages, hardware errors

### 11.2 — Virtual filesystems

- `/proc` — process info (`/proc/PID/`), kernel params (`/proc/sys/`), `/proc/meminfo`, `/proc/cpuinfo`
- `/sys` — hardware, driver, device information
- `/dev` — device files: block, character, null, zero, urandom

### 11.3 — System resource monitoring

- CPU: `top`, `htop`, `mpstat`, `sar`
- Memory: `free -h`, `vmstat`, understanding OOM killer
- Disk I/O: `iostat`, `iotop`
- Load average — what the three numbers mean
- `lscpu`, `lsmem`, `lshw` — hardware inventory

### 11.4 — Logging

- System logging architecture: `rsyslog` / `syslog` and journald
- Key log files: `/var/log/syslog`, `/var/log/auth.log`, `/var/log/kern.log`, `/var/log/messages`
- `logrotate` — automatic log rotation, why unconfigured logs fill disks
- Reading logs effectively with `grep`, `tail -f`, `journalctl`

### 11.5 — Performance tuning

- `nice`, `renice` — CPU scheduling priority
- `ulimit` — per-process resource limits (open files, processes)
- `sysctl` — kernel parameter tuning at runtime
- `/etc/security/limits.conf` — persistent limits

### 11.6 — Debugging and troubleshooting

- `strace` — trace system calls of a running process
- `lsof` — list open files and sockets by process
- `tcpdump` — capture and inspect network packets
- Practical troubleshooting workflow: is the process running? → is the port open? → are there errors in logs? → is disk/memory full?
