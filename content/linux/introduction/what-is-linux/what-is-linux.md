# What Is Linux? — Kernel, Distros, Why It's Everywhere


**Linux** — is the **kernel**: the core program of the operating system, first released by Linus Torvalds in 1991, free and open source. The full OS you install is a **distribution** built around it.

---

## Operating system

**Operating system** - is the software layer that manages the hardware and shares it among programs, so applications never touch the CPU, memory, disk, or network directly.

It has two halves:
- **Kernel** — the privileged core (below).
- **Userland** — everything on top: the shell, system libraries, and utilities that people and programs actually use.

## Kernel

**Kernel** - is the core program of the OS. It runs with full hardware privileges, controls how every process uses the CPU, memory, and devices, and exposes that control to programs through **system calls (syscalls)**.

**How it works.** The CPU runs in two modes. The kernel runs in **kernel mode** (unrestricted); your programs run in **user mode** (sandboxed) and *cannot* reach hardware. To do anything real — read a file, open a socket — a program makes a **syscall**, which switches the CPU into kernel mode, runs kernel code, and returns the result. That boundary is the whole point of the kernel.

**Syscalls, grouped by purpose:**
- **Files** — `open`, `read`, `write`, `close`
- **Processes** — `fork`, `execve`, `wait`, `exit`
- **Memory** — `mmap`, `brk`
- **Network** — `socket`, `connect`, `accept`

**Example — the syscalls behind a plain `cat file.txt`:**
```
$ strace cat file.txt
openat(AT_FDCWD, "file.txt", O_RDONLY)  = 3     # ask kernel to open it → fd 3
read(3, "hello\n", 131072)              = 6     # kernel hands back 6 bytes
write(1, "hello\n", 6)                  = 6     # kernel writes them to the screen (fd 1)
close(3)                                = 0     # release the file
```
Every line is the program crossing into the kernel and back — that's all a running program ever really does.

**What the kernel manages:**
- **Processes** — the scheduler decides which process runs on each CPU core, and for how long.
- **Memory** — each process gets its own virtual address space; the hardware MMU maps it to physical RAM (or swap), so no process can read another's memory.
- **Devices** — through **drivers**, many loaded at runtime as **modules** (`.ko` files).
- **Filesystems** — one shared VFS layer sits above `ext4` / `xfs` / `btrfs`, so the file syscalls behave identically on all of them.
- **Networking** — the full TCP/IP stack lives inside the kernel.

**Inspect it:**
```
$ uname -r
6.8.0-45-generic     # 6.8.0 = kernel version · -45-generic = the distro's build
$ dmesg              # kernel's boot + hardware log
$ lsmod              # currently loaded kernel modules
```

## Distribution ("distro")

**Distribution** -is a complete, installable operating system that combines the Linux kernel with the userland needed to boot and run it: a shell, core utilities, system libraries, a package manager, an init system (usually `systemd`).

**Why there are hundreds.** Each makes different trade-offs: stability vs. newest software, minimal vs. full-featured, community vs. paid enterprise support.

**Example — identify any running system:**
```
$ cat /etc/os-release
NAME="Ubuntu"
VERSION="24.04.1 LTS (Noble Numbat)"
```

| Distro | Family | Known for |
|---|---|---|
| **Ubuntu** | Debian | Friendly, huge community, tutorial default |
| **Debian** | Debian (root) | Rock-solid stability |
| **RHEL** | Red Hat | Enterprise support, certifications |
| **Fedora** | Red Hat | Cutting-edge; upstream of RHEL |
| **Rocky / Alma** | RHEL-compatible | Free RHEL clones |
| **Alpine** | Independent | Tiny — the container default |
| **Amazon Linux** | RHEL-ish | Tuned for AWS/EC2 |
| **Arch** | Independent | Build-it-yourself, always current |

## Why it's everywhere

- **Web/servers** — ~96% of the top million web servers
- **Cloud** — dominant (Google Cloud >90% Linux VMs; even Azure runs more Linux than Windows)
- **Containers** — Docker & Kubernetes are Linux
- **Mobile** — Android is Linux → the most-deployed OS on Earth
- **Supercomputers** — 100% of the top 500, unbroken since 2017
- **Embedded/IoT** — routers, TVs, cars, most IoT devices

**Why:** free · open · stable (uptime in months/years) · scales from sensor to supercomputer · automation-friendly (CLI-first).
