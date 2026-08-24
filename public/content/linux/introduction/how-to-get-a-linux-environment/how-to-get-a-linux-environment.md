# How to Get a Linux Environment

> Chapter 0 · Introduction to Linux

You don't need to wipe your laptop to use Linux. There are four common ways to get a working environment, and they differ in two things: how closely it behaves like a real server, and how much weight it runs on your machine. Already on Linux? You're set. macOS is Unix-like but not Linux, and Windows isn't either — so Mac and Windows users usually want one of the options below to match real Linux servers.

| Option | What it is | Weight | Like a real server? | Best for |
|---|---|---|---|---|
| **VM** | A full simulated computer | Heavy | Yes — complete | A realistic, isolated Linux |
| **WSL** | Linux built into Windows | Light | Very close | Windows users, local dev |
| **Cloud instance** | A rented remote server | None locally | Yes — it *is* one | Production parity, remote access |
| **Docker** | A lightweight container | Very light | No — stripped down | Quick, disposable trials |

---

## Virtual machine (VM)

**A full, simulated computer running a complete Linux system inside your current OS.** Software called a *hypervisor* pretends to be hardware, and you install a Linux distribution into it just like a real machine — it has its own kernel and runs in full isolation from your host. Common tools are **VirtualBox** (free, all platforms) and **VMware**.

```bash
# with VirtualBox: download an Ubuntu .iso, create a VM, and boot it to install
# or use Multipass for a ready Ubuntu VM in one command:
multipass launch --name dev
```

The most complete and realistic option, but the heaviest — it takes real RAM, CPU, and disk, and is slower to start.

## WSL (Windows Subsystem for Linux)

**A Windows feature that runs a real Linux distribution directly on Windows, with no separate VM to manage.** It installs from Windows itself and behaves like a normal app, and files and commands pass easily between Windows and Linux. Ubuntu is the default distro.

```powershell
wsl --install          # installs WSL and Ubuntu
wsl -l -v              # list your installed distros
```

Fast, lightweight, and well integrated with Windows tools like VS Code. Windows-only, and a few system-level behaviors differ slightly from a real server.

## Cloud instance

**A Linux server you rent on a provider's infrastructure and reach over the network.** You pick a distribution and size on a service like **AWS EC2**, **DigitalOcean**, or **Hetzner**, it boots in the cloud with a public address, and you connect to it with `ssh`.

```bash
ssh ubuntu@203.0.113.10    # connect to your instance's public IP
```

Nothing to install locally, matches real production, and reachable from anywhere.

## Docker (containers)

**A tool that runs Linux in a lightweight, isolated container that shares your host's kernel instead of booting a whole OS.** A container holds just a distro's files, starts in seconds, and can be thrown away and recreated instantly. On Windows and macOS, Docker runs its own small Linux underneath.

```bash
docker run -it ubuntu bash    # drop into a shell in a fresh Ubuntu container
```

Extremely fast and disposable, but stripped down — it isn't a full machine and normally has no running services, so it's great for trying commands or one app, and less suited to learning full system administration.
