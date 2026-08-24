# LVM (Logical Volume Management)

## The problem with plain partitions

A partition is fixed at creation. It starts at one position on the disk and ends at another, and the partitions around it sit immediately after — so growing one means there is nowhere for it to grow into.

This produces the situation every administrator meets eventually:

```
/dev/sdb1   /var    20G   98% full        ← out of space
/dev/sdb2   /home  200G    4% full        ← space you cannot use
```

The space exists, on the same disk, and it is unreachable. Fixing it with partitions means backing up, deleting, recreating, and restoring — with downtime, and risk.

Two further limits hurt just as much:

- **A partition cannot exceed its disk.** If you need 3 TB and your largest disk is 2 TB, partitions cannot help. You cannot combine two disks into one space.
- **Adding a disk adds a separate space.** A new disk becomes `/dev/sdc1`, mounted somewhere else. It does not enlarge anything that already exists.

**LVM** removes all three limits by inserting a layer between the disks and the filesystems.

## The three layers

Instead of putting a filesystem directly on a partition, LVM pools storage and then hands out slices of the pool:

**1. Physical Volume (PV)** — a disk or partition handed over to LVM. This is raw capacity contributed to the pool.

**2. Volume Group (VG)** — the pool itself. One or more PVs combined into a single reservoir of space. A VG may span several disks, and its size is simply the sum of its PVs.

**3. Logical Volume (LV)** — a slice taken out of the pool, which behaves exactly like a partition. You format it and mount it, and it is what your filesystem actually sits on.

```
disks           /dev/sdb        /dev/sdc
                    ↓               ↓
PVs           [ /dev/sdb ]   [ /dev/sdc ]
                    └───────┬───────┘
VG                    [   vgdata   ]        one pool, 1 TB
                    ┌───────┴───────┐
LVs            [ applv 300G ]  [ dblv 200G ]    ← formatted and mounted
```

The gain is that an LV is **not tied to a physical location**. Its space is allocated from anywhere in the pool, and more can be added at any time — from free pool space, or from a disk added later. That is what makes online growth possible.

Inside the pool, space is tracked in fixed-size units called **extents**, 4 MB by default. A VG is a set of extents, and an LV is a list of extents assigned to it — which is why an LV can be enlarged without moving anything, and why it can span disks without noticing.

```bash
$ sudo vgdisplay vgdata
  VG Size               1016.00 MiB
  PE Size               4.00 MiB
  Total PE              254
```

## Building it: `pvcreate`, `vgcreate`, `lvcreate`

Three commands, one per layer, in order.

### `pvcreate` — make a disk available to LVM

**`pvcreate`** marks a disk or partition as a physical volume, writing a small header so LVM recognises it.

```
pvcreate DEVICE...
```

```bash
$ sudo pvcreate /dev/sdb /dev/sdc
  Physical volume "/dev/sdb" successfully created.
  Physical volume "/dev/sdc" successfully created.
```

**`pvs`** lists physical volumes:

```bash
$ sudo pvs
  PV         VG Fmt  Attr PSize   PFree
  /dev/sdb      lvm2 ---  512.00m 512.00m
  /dev/sdc      lvm2 ---  512.00m 512.00m
```

The blank `VG` column means these are not yet in a group.

### `vgcreate` — pool them

**`vgcreate`** creates a volume group from one or more PVs, and gives it a name.

```
vgcreate VGNAME DEVICE...
```

```bash
$ sudo vgcreate vgdata /dev/sdb /dev/sdc
  Volume group "vgdata" successfully created
```

**`vgs`** shows the result:

```bash
$ sudo vgs
  VG     #PV #LV #SN Attr   VSize    VFree
  vgdata   2   0   0 wz--n- 1016.00m 1016.00m
```

Two 512 MB disks have become one pool of roughly 1 GB. `#PV` is how many disks back it, `VSize` the total, `VFree` what is unallocated.

### `lvcreate` — carve out a volume

**`lvcreate`** takes space from the group and creates a logical volume.

```
lvcreate -L SIZE -n LVNAME VGNAME
lvcreate -l 100%FREE -n LVNAME VGNAME
```

**`-L`** gives an absolute size, **`-n`** the name. **`-l`** takes a number of extents or a percentage, so `-l 100%FREE` means "all remaining space" without arithmetic.

```bash
$ sudo lvcreate -L 300M -n applv vgdata
  Logical volume "applv" created.
$ sudo lvcreate -L 200M -n dblv vgdata
  Logical volume "dblv" created.
```

**`lvs`** lists them:

```bash
$ sudo lvs
  LV     VG     Attr       LSize
  applv  vgdata -wi-a----- 300.00m
  dblv   vgdata -wi-a----- 200.00m
```

Each LV appears as a device under two equivalent paths:

```
/dev/vgdata/applv
/dev/mapper/vgdata-applv
```

From here it is an ordinary block device. Format and mount it exactly as in the previous two pages:

```bash
$ sudo mkfs.ext4 /dev/vgdata/applv
$ sudo mkdir -p /app
$ sudo mount /dev/vgdata/applv /app
```

For `/etc/fstab`, use the LV path — unlike `/dev/sdb1`, it is stable, because LVM finds its volumes by the headers on the disks rather than by detection order.

## Growing a volume, without downtime

This is what LVM is for. Growing is two steps, because there are two things to grow: the volume, then the filesystem inside it.

**Step 1 — extend the logical volume** with `lvextend`. A `+` means "add this much" rather than "make it this size":

```bash
$ sudo lvextend -L +200M /dev/vgdata/applv
  Size of logical volume vgdata/applv changed from 300.00 MiB to 500.00 MiB.
```

**Step 2 — grow the filesystem** to fill the new space. The command depends on the filesystem:

```bash
$ sudo resize2fs /dev/vgdata/applv      # ext4
$ sudo xfs_growfs /app                  # xfs — takes the MOUNT POINT
```

Note the difference: `resize2fs` takes the device, `xfs_growfs` takes the mount point. Both work on a **mounted, in-use filesystem** — no unmounting, no downtime, no interruption to whatever is running.

`lvextend` can do both steps at once with **`-r`** (resize filesystem), which is the form to prefer since it cannot be half-done:

```bash
$ sudo lvextend -r -L +200M /dev/vgdata/applv
```

**If the pool itself is full**, add a disk to the group first with **`vgextend`**, then extend as above:

```bash
$ sudo pvcreate /dev/sdd
$ sudo vgextend vgdata /dev/sdd
  Volume group "vgdata" successfully extended
$ sudo vgs
  VG     #PV #LV #SN Attr   VSize  VFree
  vgdata   3   0   0 wz--n- <1.24g <1.24g
```

The pool grew from 1016 MB to 1.24 GB by adding a disk, while everything stayed online. That is the whole argument for LVM: capacity becomes something you add to a pool, not something you plan perfectly in advance.

**Shrinking is a different matter.** It is possible with ext4 but must be done in the opposite order — shrink the filesystem first, then the volume — and usually requires unmounting. Get the order wrong and you cut off the end of a filesystem that is still using it, destroying data. xfs cannot shrink at all. Plan to grow, not to shrink.

## Snapshots

An **LVM snapshot** is a frozen view of a logical volume at one moment, created instantly and without copying the data.

It works by recording only what *changes* after the snapshot is taken: when a block on the original is about to be modified, the old contents are copied into the snapshot first. Reading the snapshot gives the original block where nothing changed, and the preserved copy where it did.

```
lvcreate -s -L SIZE -n SNAPNAME /dev/VG/LV
```

```bash
$ sudo lvcreate -s -L 100M -n applv-snap /dev/vgdata/applv
  Logical volume "applv-snap" created.
```

**`-s`** makes it a snapshot; the size is space for the changes, not a copy of the volume — so a snapshot of a 500 GB volume might need only a few GB.

Two practical uses:

- **A consistent backup.** Copying files from a live filesystem gives an inconsistent result, since files change while you read them. Snapshot first, back up from the snapshot, and the copy is a single point in time.
- **A safe deployment or upgrade.** Snapshot before making a risky change; if it goes wrong, roll back with `lvconvert --merge`, and if it goes well, delete the snapshot with `lvremove`.

Two cautions. A snapshot **fills up**: if changes exceed its allocated size, it becomes invalid and is dropped, so size it for the expected write volume. And snapshots slow writes to the original, since each first change now involves a copy — they are meant to be short-lived, not left in place.

## Command summary

Each layer has three commands following the same pattern — `create`, `s` to list, `display` for detail:

| | Physical Volume | Volume Group | Logical Volume |
|---|---|---|---|
| Create | `pvcreate` | `vgcreate` | `lvcreate` |
| List | `pvs` | `vgs` | `lvs` |
| Detail | `pvdisplay` | `vgdisplay` | `lvdisplay` |
| Grow | — | `vgextend` | `lvextend` |
| Remove | `pvremove` | `vgremove` | `lvremove` |

## When to use LVM

**Use it** on any server whose storage might need to grow, on VMs and cloud instances where disks can be added or enlarged, and wherever snapshots before upgrades are worth having. The cost is one extra layer to understand.

**Skip it** for a single-purpose machine with fixed storage, or where the added complexity buys nothing — a container with one volume, or a system where the cloud provider already handles resizing at a lower level.