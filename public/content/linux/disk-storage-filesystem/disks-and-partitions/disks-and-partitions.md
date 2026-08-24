# Disks and partitions

## The layers, before the details

Getting from bare hardware to a file you can open takes four steps, each building on the one before:

**1. A disk** is raw space — the physical device, holding nothing but capacity.

**2. A partition** divides that space into slices. Each slice is treated as an independent device.

**3. A filesystem** is written into a partition. This is what creates the structure of files, directories, names, and permissions inside that space.

**4. Mounting** attaches the filesystem to a directory, and only then can you reach the files.

The same four as a table, with the command that handles each:

| Layer | What it is | Example | Tool |
|---|---|---|---|
| Disk | the hardware | `/dev/sda` | `lsblk` |
| Partition | a slice of a disk | `/dev/sda1` | `fdisk`, `parted` |
| Filesystem | file structure inside a slice | ext4, xfs | `mkfs` |
| Mount point | where it appears to you | `/home` | `mount` |

**This page covers the first two** — seeing what disks exist, and dividing them. The next covers filesystems, and the one after that mounting.

## How data is stored: blocks and sectors

Disks do not read or write one byte at a time. The hardware works in fixed-size chunks, and everything above it follows suit.

A **sector** is the smallest unit the disk hardware can read or write — **512 bytes** on most disks, though newer drives use 4096. You can see the size the kernel reports:

```bash
$ sudo fdisk -l /dev/vda
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
```

Sectors are also how partitions are measured: a partition is defined by the sector it starts at and the one it ends at, which is why partitioning tools print numbers like `2048` and `409599`.

A **block** is the unit the *software* uses, and it is a group of sectors — typically **4096 bytes**, or eight 512-byte sectors. The filesystem allocates space in whole blocks:

```bash
$ stat -f /
Block size: 4096
```

One consequence worth knowing: because space is given out in whole blocks, a 10-byte file still occupies a full 4096-byte block on disk. This is why a directory of many tiny files uses far more space than the sum of their sizes.

## How Linux sees a disk

A **block device** is a device the kernel reads and writes in whole blocks, with the ability to access any block directly, in any order. Disks, SSDs, and USB drives are all block devices — as opposed to **character devices**, which handle a stream of bytes with no random access, like a terminal or `/dev/urandom`.

Each one appears as a file under `/dev/`. It is not a normal file: it is the kernel's handle on the hardware, and reading from it means reading the raw disk.

```bash
$ ls -l /dev/vda /dev/urandom
brw------- 1 root root 254, 0 Jul 26 06:29 /dev/vda
crw-rw-rw- 1 root root   1, 9 Jul 26 06:29 /dev/urandom
```

The first character of the permission string says which kind it is: **`b`** for block, **`c`** for character (the file types from the permissions chapter). And where a normal file shows a size, a device shows two numbers — the **major and minor numbers**, telling the kernel which driver handles the device and which specific device it is.

Disk names follow the type of hardware:

| Name | Hardware |
|---|---|
| `/dev/sda`, `/dev/sdb` | SATA, SAS, USB, and most virtual disks |
| `/dev/nvme0n1` | NVMe SSD — `nvme0` is the controller, `n1` the first namespace |
| `/dev/vda`, `/dev/vdb` | virtio disks, common on VMs and cloud instances |

The trailing letter is the disk's order of discovery: `sda` is the first, `sdb` the second. **That order is not guaranteed** to be the same after a reboot or a hardware change, which is why the mounting page uses UUIDs instead of these names for anything permanent.

## Partitions

A **partition** is a numbered slice of a disk, treated by the system as an independent device. One disk can hold several, each usable for a different purpose.

Partitions are named by appending a number to the disk:

| Disk | Partitions |
|---|---|
| `/dev/sda` | `/dev/sda1`, `/dev/sda2` |
| `/dev/vda` | `/dev/vda1`, `/dev/vda2` |
| `/dev/nvme0n1` | `/dev/nvme0n1**p**1`, `/dev/nvme0n1**p**2` |

Note the `p`: when a disk name already ends in a digit, a `p` separates the disk from the partition number, so `nvme0n1p1` is unambiguous. Names ending in a letter take the number directly.

Why partition at all? Three reasons that come up in practice:

- **Separating data from the system**, so filling one does not break the other. A runaway log filling `/var` should not stop the root filesystem from working.
- **Different requirements per area** — one partition encrypted and another not, or different filesystems for different workloads.
- **Boot requirements** — UEFI systems need a small dedicated partition for the bootloader, and swap traditionally lives in its own.

On cloud instances you will often see the opposite: a single partition spanning the whole disk, because a virtual disk can simply be grown or replaced instead.

## `lsblk` — see what is there

**`lsblk`** ("list block devices") lists the disks and their partitions as a tree. It is the first command to run on an unfamiliar machine.

```
lsblk [-f] [-o COLUMNS] [DEVICE]
```

```bash
$ lsblk
NAME      MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
loop0       7:0    0  512M  0 loop
|-loop0p1 259:0    0  199M  0 part
`-loop0p2 259:1    0  311M  0 part
vda       254:0    0  256G  0 disk /
```

The indentation *is* the information: `loop0p1` and `loop0p2` are drawn beneath `loop0` because they are partitions of it. **`TYPE`** distinguishes them — `disk` for a whole device, `part` for a partition. **`MOUNTPOINTS`** shows where each is attached in the filesystem, and a blank there means the partition is not currently in use.

**`-f`** adds filesystem information — the type, label, and UUID — which answers whether a partition has been formatted at all:

```bash
$ lsblk -f
```

**`-o`** selects the columns you want:

```bash
$ lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT
NAME  SIZE TYPE FSTYPE MOUNTPOINT
vda   256G disk        /
```

Reading `lsblk` output tells you the three things you usually need: what disks exist, how they are divided, and which slices are actually in use.

## The partition table

The list of partitions is itself stored on the disk, in a small area at the beginning called the **partition table**. It records where each partition starts and ends. Two formats exist, and every disk uses one of them.

**MBR** (Master Boot Record) is the old format, from 1983. Its limits are real:

- a maximum disk size of **2 TB**
- only **four primary partitions** — more requires turning one into an *extended* partition that holds *logical* partitions inside it, an awkward workaround
- one copy of the table, with no backup

**GPT** (GUID Partition Table) is the modern replacement and the default for anything new:

- disk sizes far beyond any current hardware
- **128 partitions** as standard, all equal — no primary/extended/logical distinction
- a **backup copy** of the table at the end of the disk, and checksums to detect corruption
- partitions carry a **name** and a **UUID**, so they can be identified without relying on device order

Which one a disk uses is visible in the tools. `fdisk` reports it as the disklabel type:

```bash
$ fdisk -l /dev/loop0
Disklabel type: gpt
Disk identifier: CEEDA4D0-A3E0-4910-967D-870761F0BFA7

Device        Start     End Sectors  Size Type
/dev/loop0p1   2048  409599  407552  199M Linux filesystem
/dev/loop0p2 409600 1046527  636928  311M Linux filesystem
```

An MBR disk instead shows `Disklabel type: dos`, and its partitions are labelled `primary`:

```bash
$ fdisk -l /dev/loop1
Disklabel type: dos
Device       Boot Start    End Sectors Size Id Type
/dev/loop1p1       2048 131071  129024  63M 83 Linux
```

**Use GPT** unless you have a specific reason not to — an old BIOS-only machine, or a disk that must be read by very old software. Converting between the two is possible but risky; choose correctly when you first set the disk up.

## `fdisk` and `parted` — editing partitions

Two tools do the same job in different styles. Both need root, since they write to the raw disk.

### `fdisk`

**`fdisk`** is an interactive, menu-driven editor. Nothing is written to the disk until you explicitly save, which makes it forgiving to explore.

```
fdisk -l [DEVICE]      # list partitions (read-only)
fdisk DEVICE           # open the interactive editor
```

`fdisk -l` on its own is the safe, everyday use — it only reads. Inside the editor, single letters do the work:

| Key | Action |
|---|---|
| `p` | print the current table |
| `n` | new partition |
| `d` | delete a partition |
| `t` | change a partition's type |
| `w` | **write** the changes and exit |
| `q` | quit **without** saving |

The important pair is `w` and `q`: until you press `w`, nothing has changed. If you are unsure at any point, press `q` and start again.

### `parted`

**`parted`** can run interactively too, but its distinguishing feature is that it takes commands directly on the command line, which makes it the one to use in scripts and automation.

```
parted [-s] DEVICE COMMAND
```

`-s` means "script mode": do not ask questions. Creating a GPT table with two partitions:

```bash
$ sudo parted -s /dev/sdb mklabel gpt
$ sudo parted -s /dev/sdb mkpart data1 ext4 1MiB 200MiB
$ sudo parted -s /dev/sdb mkpart data2 ext4 200MiB 100%
$ sudo parted -s /dev/sdb print
Model: Loopback device (loopback)
Disk /dev/sdb: 537MB
Partition Table: gpt

Number  Start   End    Size   File system  Name   Flags
 1      1049kB  210MB  209MB               data1
 2      210MB   536MB  326MB               data2
```

Three things in that sequence are worth noting. **`mklabel gpt`** creates the partition table and **erases any existing one** — it is the destructive step. **`100%`** means "to the end of the disk", saving you the arithmetic. And the `ext4` in `mkpart` only *labels the intended type*; it does not format anything. The `File system` column stays empty until you actually create a filesystem, which is the next page.

**`parted` writes immediately.** Unlike `fdisk` there is no save step and no way to back out — check the device name before you press enter.

## Two cautions

**Partitioning is destructive.** Changing a partition table does not move data; it changes where the system believes data begins and ends. Deleting or resizing a partition makes its contents unreachable. Have a backup, and confirm you have the right device with `lsblk` first — `/dev/sdb` and `/dev/sdc` differ by one character.

**Tell the kernel after you change things.** The kernel reads the partition table when the disk appears. After editing it, run `partprobe` so the kernel re-reads it and the new `/dev/sdb1` entries exist:

```bash
$ sudo partprobe /dev/sdb
$ lsblk /dev/sdb
```

A partition now exists, but it holds nothing usable yet — it is just a reserved span of the disk. Making it store files requires a filesystem, which is the next page.