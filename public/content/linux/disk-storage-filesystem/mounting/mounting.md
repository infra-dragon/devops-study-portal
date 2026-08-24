# Mounting

## What mounting means

A formatted partition can hold files, but you still cannot reach them. There is no drive letter in Linux, no `D:` to open. Everything lives in one single tree that starts at `/`.

**Mounting** is attaching a filesystem to a directory in that tree, so its contents become reachable through that path. The directory it is attached to is the **mount point**.

Once `/dev/sdb1` is mounted on `/data`, opening `/data/report.txt` reads a file stored on that partition. The path is how you get there; the partition is where the bytes are. Nothing in the path tells you which disk is involved, and that is the point — programs work with directories and never need to know.

This is also why adding a disk to a Linux system does not give you a new letter to browse. You choose where it appears: mount it on `/data` and it is part of the tree at `/data`.

## A mount hides what was already there

A mount point is an ordinary directory. If it already contains files, mounting something on it **hides them** — they are not deleted, just covered, and they come back when you unmount.

```bash
$ ls /mnt/point
original.txt

$ sudo mount /dev/sdb1 /mnt/point
$ ls /mnt/point
lost+found                    # original.txt is no longer visible

$ sudo umount /mnt/point
$ ls /mnt/point
original.txt                  # back again
```

The usual practice is to mount onto an empty directory, created for the purpose. When a mount seems to have "lost" files, this is normally what happened: something is mounted over them, or a mount that should be there is missing and you are looking at the empty directory underneath.

## `mount` — attaching a filesystem

**`mount`** attaches a filesystem to a directory. It needs root.

```
mount [-t TYPE] [-o OPTIONS] DEVICE MOUNTPOINT
```

**`DEVICE`** is the formatted partition you want to attach — the block device from the disks page, now carrying a filesystem from the previous one. It is the same `/dev/sdb1` you created with `parted` and formatted with `mkfs`. If you are unsure which one you want, `lsblk` lists them:

```bash
$ lsblk
NAME   SIZE TYPE MOUNTPOINTS
sdb    512M disk
`-sdb1 511M part                 # formatted, not yet mounted
```

A partition with a blank `MOUNTPOINTS` column is one that exists but is not attached anywhere — a candidate for mounting.

**`MOUNTPOINT`** is the directory it should appear at. It must already exist, so create it first:

```bash
$ sudo mkdir -p /data
$ sudo mount /dev/sdb1 /data
```

The type is detected automatically, so `-t` is rarely needed. Run with no arguments, `mount` lists what is currently mounted:

```bash
$ mount | grep /data
/dev/sdb1 on /data type ext4 (rw,relatime)
```

**`findmnt`** shows the same information in a more readable form:

```bash
$ findmnt /data
TARGET SOURCE     FSTYPE OPTIONS
/data  /dev/sdb1  ext4   rw,relatime
```

### Mount options

**`-o`** sets how the filesystem is mounted. Options come in pairs — the permissive form and its `no` opposite:

| Option | Effect | In `defaults`? |
|---|---|---|
| `rw` / `ro` | read-write / read-only | `rw` |
| `suid` / `nosuid` | honour / ignore setuid bits (permissions chapter) | `suid` |
| `dev` / `nodev` | honour / ignore device files on this filesystem | `dev` |
| `exec` / `noexec` | allow / forbid running programs stored here | `exec` |
| `auto` / `noauto` | mount / do not mount when `mount -a` runs (so: at boot) | `auto` |
| `nouser` / `user` | only root may mount this / any user may | `nouser` |
| `async` / `sync` | write changes to disk in the background / immediately | `async` |
| `atime` / `noatime` | record / do not record file access times | `atime` |

**`defaults`** is shorthand for the seven permissive choices above: `rw,suid,dev,exec,auto,nouser,async`. Everything is allowed, and writes are buffered.

Two of those need a word, since they are less obvious than the rest:

- **`auto`** does not mean "detect the filesystem type" — it means "include this in `mount -a`", which is what runs at boot. Its opposite, `noauto`, is how you define a filesystem in `fstab` that should *not* mount automatically.
- **`async`** means writes are held in memory and flushed to disk shortly after, which is far faster. `sync` writes immediately and is much slower; it is rare, and generally unnecessary since Linux flushes buffers reliably on a clean shutdown.

`atime` is not part of `defaults` but is worth knowing, because turning it *off* is the one option people commonly add. By default, reading a file causes a write to update its access time. **`noatime`** stops that, removing a write for every read:

```bash
$ sudo mount -o defaults,noatime /dev/sdb1 /data
```

A read-only mount refuses writes outright:

```bash
$ sudo mount -o ro /dev/sdb1 /data
$ touch /data/newfile
touch: cannot touch '/data/newfile': Read-only file system
```

And `noexec` blocks execution, even for a file with the execute bit set:

```bash
$ sudo mount -o noexec /dev/sdb1 /data
$ /data/prog.sh
bash: /data/prog.sh: Permission denied
```

`noexec,nosuid,nodev` together are the standard hardening for a filesystem holding only data — uploads, backups, a shared volume — so nothing stored there can be run or gain privilege.

## `umount` — detaching

**`umount`** detaches a filesystem. Note the spelling: one `n`.

```
umount MOUNTPOINT
```

```bash
$ sudo umount /data
```

It takes either the mount point or the device; the mount point is clearer.

The error you will meet:

```bash
$ sudo umount /data
umount: /data: target is busy.
```

This means something is still using the filesystem — a shell sitting in that directory, a program with a file open, a running service. Linux refuses rather than pulling the filesystem out from under it.

The most common cause is your own shell:

```bash
$ cd /                 # leave the directory
$ sudo umount /data    # now it works
```

If leaving the directory does not help, something else is holding the filesystem. Two commands find it.

### `lsof` — list open files

**`lsof`** ("list open files") lists files currently open, and which process has each one open. Given a directory, it reports every open file beneath it.

```
lsof [PATH]
```

```bash
$ sudo lsof /data
COMMAND PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
sleep   831 root    1w   REG    7,0        0   12 /data/held.log
sleep   831 root    2w   REG    7,0        0   12 /data/held.log
```

The columns that matter: **`COMMAND`** and **`PID`** identify the process to deal with, **`USER`** shows who runs it, and **`NAME`** is the file being held. **`FD`** is the file descriptor — `1w` means it is open for writing on descriptor 1 (stdout, from the redirection page).

So this tells you: PID 831, a `sleep` command, is writing to `/data/held.log`. Stop that process and the filesystem is free.

`lsof` is a general tool, not a mounting one. It answers "who has this file open?" for any path, which also makes it the way to find what is holding a deleted file's space, or which process owns a port with `-i`.

### `fuser` — identify processes using a file or filesystem

**`fuser`** answers a narrower question — *which processes are using this?* — and answers it more compactly.

```
fuser [-v] [-m] PATH
```

**`-m`** means "treat the path as a mounted filesystem, and report anything using it", which is exactly the unmount question. **`-v`** makes the output readable rather than a bare list of PIDs.

```bash
$ sudo fuser -vm /data
                     USER        PID ACCESS COMMAND
/data:               root     kernel mount /data
                     root        831 F.... sleep
```

The **`ACCESS`** column codes how each process is using it: `f` an open file, `F` open for writing, `c` its current directory, `e` a running executable, `r` its root directory. Here `F` confirms PID 831 has a file open for writing.

**Which to use:** `fuser -vm` for the direct "what is blocking this unmount" question, since it is one line per process. `lsof` when you need to know *which files* are open, not just which processes.

Either way the fix is the same — stop the process, then unmount:

```bash
$ sudo kill 831
$ sudo umount /data
```

Resist `umount -l` (lazy unmount) as a habit. It detaches the filesystem from the tree while processes are still writing to it, which hides the problem rather than solving it.

## Naming a filesystem: device, UUID, or label

`/dev/sdb1` is not a reliable name. As covered in the disks page, device letters are assigned in order of detection, so adding a disk, moving one, or a slower boot can turn `sdb` into `sdc`. A permanent configuration that names a device by letter will eventually mount the wrong thing — or fail.

Every filesystem therefore has two stable identifiers, both created by `mkfs`:

- a **UUID**, generated automatically and unique to that filesystem
- a **LABEL**, if you set one

```bash
$ sudo blkid /dev/sdb1
/dev/sdb1: LABEL="testdata" UUID="300f1c5a-c3e7-493d-af05-a39b7f17409a" TYPE="ext4"
```

All three ways of naming work with `mount`:

```bash
$ sudo mount /dev/sdb1 /data                                    # by device
$ sudo mount UUID=300f1c5a-c3e7-493d-af05-a39b7f17409a /data    # by UUID
$ sudo mount -L testdata /data                                  # by label
```

Use the device name for a quick manual mount. Use the **UUID** for anything permanent, because it stays with the filesystem no matter how the disks are ordered or connected.

## `/etc/fstab` — mounting at boot

A `mount` command lasts until reboot. **`/etc/fstab`** is the file listing filesystems to mount automatically at boot.

Each line has six fields:

```
UUID=300f1c5a-c3e7-493d-af05-a39b7f17409a  /data  ext4  defaults,noatime  0  2
└──────────────── 1 ────────────────────┘  └─ 2 ┘ └ 3 ┘ └───── 4 ──────┘ └5┘└6┘
```

| # | Field | Meaning |
|---|---|---|
| 1 | device | what to mount — **use `UUID=`** |
| 2 | mount point | where to attach it |
| 3 | type | `ext4`, `xfs`, `swap`… |
| 4 | options | as with `-o`; `defaults` is the usual starting point |
| 5 | dump | backup flag for an obsolete tool — always `0` |
| 6 | pass | `fsck` order at boot: `0` skip, `1` root filesystem, `2` everything else |

Two options that belong here rather than on the command line:

- **`nofail`** — boot normally even if this filesystem is missing. Essential for external or network storage.
- **`noauto`** — do not mount at boot; the entry only defines *how* to mount it when asked.

### Test before you reboot

An error in `/etc/fstab` can stop a machine from booting: systemd waits for a filesystem that never appears, and you get an emergency shell instead of a login. This is a real way to lock yourself out of a server.

**`mount -a`** mounts everything in `fstab` that is not already mounted, which turns a boot-time disaster into an error message you can read now:

```bash
$ sudo mount -a
mount: /data: unknown filesystem type 'ext9'.
```

Always run `mount -a` after editing `fstab`, while you still have a working shell. Add `nofail` to anything non-essential, so a missing disk degrades the boot rather than stopping it.

## `df` and `du` — how much space

Two commands answer two different questions, and the difference matters when you are hunting for disk space.

**`df`** ("disk free") reports space per *filesystem*: how full each mounted filesystem is.

```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda        252G  8.6G   10G  47% /
/dev/sdb1       104M   21M   75M  22% /data
```

**`-h`** means human-readable units instead of blocks. `df -h` is the first command to run when something reports "no space left" — it tells you *which* filesystem is full, which may not be the one you assumed. (And remember from the previous page: if `df -h` shows free space but writes still fail, check `df -i` for inodes.)

**`du`** ("disk usage") reports space per *directory*: how much a directory and its contents occupy.

```bash
$ du -sh /data/a
21M	/data/a
```

**`-s`** summarises, giving one total instead of a line per subdirectory; **`-h`** is human-readable again.

The everyday combination for finding what filled a disk — largest first:

```bash
$ du -sh * | sort -rh
21M	a
16K	lost+found
```

Run that at `/`, then descend into whichever directory is largest, and repeat. It is the standard way to track down a full disk.

So: **`df` finds which filesystem is full; `du` finds what filled it.**