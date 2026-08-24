# Swap

## What swap is

RAM is finite. When programs ask for more memory than the machine has, something must give.

**Swap** is disk space the kernel uses as an overflow area for memory. When RAM runs short, the kernel takes memory pages that have not been touched recently, writes them to swap, and frees the RAM for something more urgent. If a page is needed again later, it is read back.

The trade is speed for capacity. Disk is far slower than RAM — even an SSD is orders of magnitude behind — so swapped-out memory is slow to reach. Swap does not make a machine faster; it stops it from failing when memory runs out.

## When it is used

Swap is not a last-resort emergency measure that sits idle until RAM is full. The kernel uses it in two distinct ways.

**Proactive paging.** Even with RAM free, the kernel may move long-idle pages to swap. A daemon that started at boot and has done nothing since does not need to occupy RAM; moving it out leaves more room for the file cache, which speeds up everything doing real work. This is why a healthy server often shows some swap in use — that is the system working as intended, not a warning sign.

**Memory pressure.** When RAM genuinely runs short, swapping becomes necessary rather than opportunistic. This is where the cost shows: if the machine is actively using more memory than it has, pages are written out and read back constantly, and the system spends its time moving memory instead of working. This is **thrashing** — the machine appears to hang, with the disk busy and almost nothing progressing.

Without swap, running out of memory has a different ending: the kernel's **OOM killer** picks a process and terminates it. Swap does not prevent this, it delays it — and gives you a window to notice and intervene.

## `free` — seeing memory and swap

**`free`** reports memory use, including swap.

```
free [-h]
```

**`-h`** gives human-readable units.

```bash
$ free -h
               total        used        free      shared  buff/cache   available
Mem:           3.9Gi       305Mi       3.6Gi       4.2Mi       198Mi       3.6Gi
Swap:          511Mi          0B       511Mi
```

The columns on the `Mem:` line:

| Column | Meaning |
|---|---|
| `total` | physical RAM installed |
| `used` | in use by programs |
| `free` | completely unused — **not the number that matters** |
| `shared` | memory shared between processes |
| `buff/cache` | used by the kernel for caching files — reclaimable at once |
| `available` | **the number that matters**: what a new program could get, including reclaimable cache |

The distinction between `free` and `available` is the point of reading this output. Linux deliberately uses spare RAM for file caching, so `free` tends toward zero on a busy machine — that is not a problem, because the cache is released the moment anything needs the memory. Judge memory by **`available`**.

The `Swap:` line is simpler: total, used, and free swap space. Swap in use is normal; swap *filling up* while `available` memory is near zero means the machine is in trouble.

## Swap file or swap partition

Swap can live in either, and both work identically to the kernel.

A **swap partition** is a partition with no filesystem, dedicated to swap. Traditional, and marginally faster on spinning disks because the space is contiguous.

A **swap file** is an ordinary file on an existing filesystem. Modern, and the better default: it can be created, resized, or removed at any time without touching the partition table.

On current hardware the performance difference is negligible. Use a file unless something specific requires a partition.

## Creating swap

Three commands, and the same sequence whether it is a file or a partition.

### `mkswap` — format the space as swap

**`mkswap`** writes a swap header, marking the space for the kernel's use — the swap equivalent of `mkfs`.

```
mkswap DEVICE_OR_FILE
```

For a swap file, create the file first with `fallocate`, then restrict its permissions:

```bash
$ sudo fallocate -l 2G /swapfile
$ sudo chmod 600 /swapfile
$ sudo mkswap /swapfile
Setting up swapspace version 1, size = 2 GiB
no label, UUID=1f436d96-c638-460f-884f-96552b84dca5
```

**The `chmod 600` is not optional.** Swap holds whatever was in memory — passwords, keys, private data — so a readable swap file exposes all of it to any user on the machine. `swapon` warns if you forget:

```bash
$ sudo swapon /swapfile
swapon: /swapfile: insecure permissions 0644, 0600 suggested.
```

It still activates. The warning is the only thing standing between you and a world-readable copy of your machine's memory, so do not rely on noticing it.

### `swapon` — activate it

**`swapon`** tells the kernel to start using a swap area.

```
swapon [--show] [-a] DEVICE_OR_FILE
```

```bash
$ sudo swapon /swapfile
```

**`--show`** lists what is currently active:

```bash
$ swapon --show
NAME      TYPE SIZE USED PRIO
/swapfile file 512M   0B   -2
```

`TYPE` distinguishes a file from a partition, `USED` is how much is currently occupied, and `PRIO` is the priority: with several swap areas, the kernel fills the highest-priority one first, and spreads across areas of equal priority.

`free -h` confirms it is in use:

```bash
$ free -h
Swap:          511Mi          0B       511Mi
```

**`-a`** activates everything listed in `/etc/fstab` — the equivalent of `mount -a`.

### `swapoff` — deactivate it

**`swapoff`** stops using a swap area, moving anything stored there back into RAM.

```
swapoff DEVICE_OR_FILE
swapoff -a
```

```bash
$ sudo swapoff /swapfile
```

This requires enough free RAM to hold what comes back. If swap is heavily used and memory is tight, `swapoff` will be slow, and can fail or trigger the OOM killer. Check `free -h` first.

To remove a swap file entirely: `swapoff` it, delete it, and remove its `fstab` line.

## Making it permanent

`swapon` lasts until reboot. Add a line to **`/etc/fstab`**, using the same six fields as any other entry:

```
/swapfile   none   swap   sw   0   0
```

The mount point is `none` because swap is not mounted anywhere in the tree, the type is `swap`, and `sw` is the conventional option. The last two fields are `0`, since swap is never dumped or checked by `fsck`.

A swap partition uses its UUID, for the reason from the mounting page — device names are not stable:

```
UUID=1f436d96-c638-460f-884f-96552b84dca5   none   swap   sw   0   0
```

Test with `sudo swapon -a` before rebooting, then confirm with `swapon --show`.

## `swappiness` — how eagerly to swap

**`vm.swappiness`** is a kernel setting from **0 to 100** controlling how readily the kernel swaps pages out rather than shrinking the file cache.

```bash
$ cat /proc/sys/vm/swappiness
60
```

- **Low (0–10)** — swap only under real pressure. Suits databases and latency-sensitive services, where a swapped-out page arriving late is worse than a smaller cache.
- **60** — the default, balanced for general use.
- **High (100)** — swap readily, favouring a large file cache.

`0` does not disable swapping; it means "avoid it until necessary."

Change it for the current boot with `sysctl`:

```bash
$ sudo sysctl vm.swappiness=10
```

And permanently in `/etc/sysctl.conf` or a file under `/etc/sysctl.d/`:

```
vm.swappiness=10
```

Lowering it to `10` on a database server is a common and defensible tuning. Changing it without a specific reason is not — the default is well chosen.

## How much, and whether

The old advice of "twice your RAM" comes from an era of far smaller memory and no longer scales — 64 GB of swap on a 32 GB machine is unusable in practice, since a machine actively using that much swap has already stopped responding.

Reasonable current guidance:

| RAM | Swap |
|---|---|
| ≤ 2 GB | equal to RAM |
| 2–8 GB | equal to RAM, or half |
| 8–64 GB | 4–8 GB is plenty |
| > 64 GB | 4 GB, or none |

**Hibernation is the exception**: suspending to disk writes all of RAM into swap, so it needs swap at least the size of RAM. This applies to laptops, not servers.

**Should a server have swap at all?** Both positions are defensible.

*Some swap is worth having.* It lets the kernel move idle pages out, and turns a sudden memory spike into a slow machine you can log into and fix rather than a process killed without warning.

*No swap is also valid.* On systems where predictable performance matters more than surviving a spike — many Kubernetes nodes, some database servers — swap is disabled deliberately, so that memory exhaustion fails fast and visibly instead of degrading into thrashing. Kubernetes historically required swap to be off for exactly this reason.

The middle position, and a reasonable default: a modest amount of swap, a low `swappiness`, and monitoring that alerts when swap use starts climbing — because on a healthy machine, it should not.