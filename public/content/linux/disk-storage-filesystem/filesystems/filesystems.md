# Filesystems

## What a filesystem is

After partitioning, you have a slice of disk — a stretch of empty space with a start and an end, and nothing else. The disk can store bytes at numbered positions, and that is all it knows how to do. It has no idea what a file is, what a name is, or which bytes belong together.

A **filesystem** is the bookkeeping that turns that empty space into something you can store files in. It keeps track of four things:

- **which parts of the space each file occupies**, so a file split across the disk can be read back as one piece
- **names and directories**, so `/var/log/syslog` leads to the right bytes
- **each file's owner, permissions, and timestamps**
- **which space is still empty**, so the next file has somewhere to go

Creating a filesystem is called **formatting**, and it does exactly what the list above implies: it writes the empty bookkeeping structures into the partition. It also creates one thing you can see — the **root directory** of that filesystem, the `/` that everything inside it hangs from. A freshly formatted partition is not empty in the strictest sense; it contains an empty directory, ready to have files put in it.

Where does the bookkeeping itself live? In the partition, alongside the files. A filesystem reserves part of its own space for its records: a **superblock** at the start describing the whole filesystem, tables listing which space is used, and the inode table described below. This is why a formatted 256 MB partition offers less than 256 MB for your files — some of it holds the structure that makes the rest usable.

| | Partition | Filesystem |
|---|---|---|
| What it is | a slice of a disk | bookkeeping inside that slice |
| Created by | `fdisk`, `parted` | `mkfs` |
| Knows about | start and end position | files, directories, permissions |

## Inodes

Every file has an **inode** — the record holding everything about the file *except its name*: owner, group, permissions, timestamps, size, and where the contents are stored.

The name lives separately, in the directory, as an entry pairing a name with an inode number. (That separation is what makes links work, covered in chapter 2.)

Inodes are stored in the **inode table**, a fixed area written at format time. This is the key point, and the reason for the next section: the table is pre-allocated, so **the number of inodes is decided when the filesystem is created and can never change**.

### Why the number is fixed

Each inode takes real space — 256 bytes on ext4 — and they are laid out in a table on disk before any file exists. On a filesystem with 65,536 inodes, that table is:

```
65,536 inodes × 256 bytes = 16 MB reserved up front
```

Making the count changeable would mean moving that table, and everything after it, while files sit in those positions. So the count is chosen once. `mkfs` picks it from a default ratio of roughly one inode per 16 KB of space, which suits ordinary use — average files are much larger than 16 KB, so inodes run out long after disk space does.

You can override it at format time if you know the workload:

```bash
$ sudo mkfs.ext4 -N 8192 /dev/sdb1     # exactly 8192 inodes
$ sudo mkfs.ext4 -i 1024 /dev/sdb1     # one inode per 1 KB — many small files
```

Both are one-time decisions. Changing your mind later means recreating the filesystem.

### Checking them: `df -i`

**`df -i`** reports inode use instead of disk space:

```bash
$ df -i /
Filesystem     Inodes IUsed IFree IUse% Mounted on
/dev/vda        65536    11 65525    1% /
```

| Column | Meaning |
|---|---|
| `Filesystem` | the device holding it |
| `Inodes` | the total, fixed at format time |
| `IUsed` | how many are in use — one per file, directory, and link |
| `IFree` | how many remain |
| `IUse%` | used as a percentage |
| `Mounted on` | the directory it is attached to |

Since every file takes one inode whatever its size, they can run out while the disk is nearly empty:

```bash
$ df -h /mnt/data
/dev/sdb1       224M  1.5M  205M   1% /mnt/data      # 205M free

$ df -i /mnt/data
/dev/sdb1      65536 65536     0  100% /mnt/data     # zero inodes left

$ touch newfile
touch: cannot create 'newfile': No space left on device
```

"No space left on device" while `df -h` shows free space means inodes, not space. It comes from directories filling with huge numbers of small files — a mail queue, a session directory, a cache nobody cleans. Deleting files fixes it; adding disk does not.

## Which filesystem to use

**Use `ext4`.** It is the default on Debian and Ubuntu, mature, stable, and good at everything ordinary. Unless something specific pushes you elsewhere, this is the answer.

Two others you will meet:

**`xfs`** is the default on RHEL and CentOS, so you get it whether or not you chose it. It handles very large files and heavy parallel writes better than ext4. One limitation to remember: an xfs filesystem **can be grown but never shrunk**.

**`btrfs`** offers snapshots and built-in corruption detection, at the cost of more complexity. It is the default on Fedora Workstation and openSUSE.

All three are **journaling** filesystems, which is what makes them safe to use. Before changing anything on disk, the filesystem writes down what it is about to do. If the power fails mid-write, the next mount reads that note and either finishes the job or discards it — so the filesystem is never left half-changed. This is why a Linux machine that loses power boots normally instead of scanning the entire disk.

What your kernel supports is listed in `/proc/filesystems`:

```bash
$ cat /proc/filesystems
	ext3
	ext4
	xfs
```

## `mkfs` — creating a filesystem

**`mkfs`** ("make filesystem") formats a partition.

```
mkfs.TYPE [-L LABEL] DEVICE
```

The type is part of the command name — `mkfs.ext4`, `mkfs.xfs`:

```bash
$ sudo mkfs.ext4 /dev/sdb1
mke2fs 1.47.0 (5-Feb-2023)
Creating filesystem with 65536 4k blocks and 65536 inodes
Filesystem UUID: dcc20bb1-bc35-4d10-9403-fe7d51993058
Superblock backups stored on blocks:
	32768

Allocating group tables: done
Writing inode tables: done
Creating journal (4096 blocks): done
Writing superblocks and filesystem accounting information: done
```

That output names the structures described above as it writes them. The block and inode counts are the ones now fixed for good. The **UUID** is a unique identifier generated for this filesystem — the next page uses it in `/etc/fstab`, because device names like `/dev/sdb1` can change between reboots and a UUID cannot. The **superblock backups** are spare copies of the main record, kept so a damaged superblock can be recovered.

**`-L`** attaches a label, a readable name you can use instead of the device path:

```bash
$ sudo mkfs.ext4 -L data /dev/sdb1
$ sudo blkid /dev/sdb1
/dev/sdb1: LABEL="data" UUID="dcc20bb1-bc35-4d10-9403-fe7d51993058" TYPE="ext4"
```

**`mkfs` erases the target.** It writes fresh, empty bookkeeping, so whatever was there becomes unreachable — and it does not ask first. Confirm the device with `lsblk` before running it.

## `fsck` — checking and repairing

**`fsck`** ("filesystem check") looks for damage in the bookkeeping and can repair it: space marked used by no file, inodes whose counts do not add up, directory entries pointing at nothing. Crashes, power loss, and failing disks cause these.

```
fsck [-n] [-y] [-f] DEVICE
```

| Flag | Effect |
|---|---|
| `-n` | answer no to every question — check only, change nothing |
| `-y` | answer yes to every question — repair without asking |
| `-f` | check even if the filesystem is marked clean |

```bash
$ sudo fsck -f /dev/sdb1
Pass 1: Checking inodes, blocks, and sizes
Pass 2: Checking directory structure
Pass 3: Checking directory connectivity
Pass 4: Checking reference counts
Pass 5: Checking group summary information
/dev/sdb1: 11/65536 files (0.0% non-contiguous), 8268/65536 blocks
```

**Never run `fsck` on a mounted filesystem.** Repairing structures while the kernel writes to them will corrupt the filesystem. `fsck` only warns — it does not stop you:

```bash
$ sudo fsck /dev/sdb1
Warning!  /dev/sdb1 is mounted.
```

Unmount first. The root filesystem cannot be unmounted while the system is running, so check it by booting from rescue media or a live USB.

You will rarely run this by hand. Journaling deals with ordinary crashes, and the boot process checks filesystems when needed. `fsck` is for when something has actually broken — a filesystem that mounts read-only, I/O errors in the logs, a disk that has been misbehaving.

The partition can now hold files, but nothing can reach them yet. Attaching it to a directory is the next page.