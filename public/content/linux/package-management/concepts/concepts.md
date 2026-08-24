# Package management concepts

## The problem

**A package manager is a program that installs, updates, and removes software, tracking which files belong to which piece of software and what each one requires.**

Three concepts make it work: packages, dependencies, and repositories.

## Packages

**A package is a single file containing a piece of software, the files it installs, and information describing it.**

Two parts, then. The **files** — programs, libraries, configuration, documentation — each with the path it should be installed to:

```bash
$ dpkg -c hello_2.10-3build1_amd64.deb
-rwxr-xr-x root/root  26856  ./usr/bin/hello
-rw-r--r-- root/root   2264  ./usr/share/doc/hello/copyright
-rw-r--r-- root/root  11668  ./usr/share/info/hello.info.gz
```

And the **metadata**, describing the package itself:

```bash
$ dpkg -I hello_2.10-3build1_amd64.deb
 Package: hello
 Version: 2.10-3build1
 Architecture: amd64
 Installed-Size: 104
 Depends: libc6 (>= 2.38)
 Conflicts: hello-traditional
 Description: example package based on GNU hello
```

The metadata is what turns a package from an archive into something manageable. It carries the **name** and **version**, the **architecture** it was built for, what it **depends on**, and what it **conflicts** with.

Because the package manager records the file list at install time, it can later remove exactly those files, tell which package owns a given file, and detect when two packages want to write the same one.

### Version numbers

Versions matter more than they appear, because dependencies are expressed in terms of them. Most follow **semantic versioning**, three numbers separated by dots:

```
2.10.3
│  │  └── patch: bug fixes only
│  └───── minor: new features, still compatible
└──────── major: changes that may break compatibility
```

Distributions add their own suffix — `2.10-3build1` above — marking a package rebuilt or patched by the distribution without the original software changing.

## Dependencies

Almost no program is self-contained. It uses libraries, which use other libraries.

**A dependency is another package that must be installed for this one to work.**

The `hello` package declares `Depends: libc6 (>= 2.38)`: it needs the C library, at version 2.38 or later. Real software declares many more:

```bash
$ apt-cache depends nginx
nginx
  Depends: libc6
  Depends: libcrypt1
  Depends: libpcre2-8-0
  Depends: libssl3t64
  Depends: zlib1g
  Depends: iproute2
  Depends: nginx-common
```

**Dependency resolution** is the package manager's job of working out the full set of packages needed and installing them in a workable order. Installing `nginx-core` on a bare system pulls in seven other packages first:

```bash
$ sudo apt install nginx-core
The following additional packages will be installed:
  iproute2 libatm1t64 libbpf1 libmaxminddb0 libnginx-mod-http-geoip2
  libnginx-mod-http-image-filter libnginx-mod-http-xslt-filter
```

None of those were requested. The package manager determined they were required, found them, and ordered the installation so that each package's requirements exist before it is configured.

Two related declarations appear alongside `Depends`:

| Declaration | Meaning |
|---|---|
| `Depends` | required — install this too |
| `Recommends` | not required but normally wanted — installed by default on Debian and Ubuntu |
| `Suggests` | related, never installed automatically |
| `Conflicts` | cannot be installed at the same time as this |

The reverse direction matters when removing software: a package needed by others cannot simply be deleted, and the package manager will refuse or warn rather than break what remains.

### Low-level and high-level tools

Every packaging system has two layers, and the difference between them is dependency resolution.

A **low-level tool** installs one package file that is already on disk. It reads the dependency list, but it cannot go and find anything — so a missing dependency is an error:

```bash
$ sudo dpkg -i nginx-core_1.24.0.deb
Unpacking nginx-core (1.24.0-2ubuntu7.17) ...
dpkg: dependency problems prevent configuration of nginx-core:
 nginx-core depends on libnginx-mod-http-geoip2; however:
  Package libnginx-mod-http-geoip2 is not installed.
```

A **high-level tool** works from repositories. Given a package name, it resolves the full dependency set, downloads everything needed, and hands the individual packages to the low-level tool to install. It is the same job the low-level tool just failed at, done with the missing pieces available.

| System | Low level | High level |
|---|---|---|
| deb-based | `dpkg` | `apt` |
| rpm-based | `rpm` | `dnf` (formerly `yum`) |

In normal use the high-level tool is the one to reach for. The low-level tool matters for inspecting a package file, or installing one downloaded from outside the repositories.

## Repositories

**A repository is a server holding a collection of packages and an index describing them.**

This is where the high-level tools get their packages. A distribution runs official repositories containing tens of thousands of packages, built and signed by the distribution and tested against each other. Third parties — Docker, PostgreSQL, NodeSource — run their own for software not in the official set, or for newer versions of it.

Repositories are configured in files. On Ubuntu:

```bash
$ cat /etc/apt/sources.list.d/ubuntu.sources
URIs: http://archive.ubuntu.com/ubuntu/
Suites: noble noble-updates noble-backports
Components: main universe restricted multiverse
```

**`URIs`** is the server, **`Suites`** the distribution release and its update channels, and **`Components`** the sections — on Ubuntu, `main` is supported free software, `universe` is community-maintained, `restricted` and `multiverse` hold software with licensing limitations.

### The local index

The package manager does not search the network when asked to install something. Each repository publishes an **index**: a list of every package it holds, with version and dependency information. That index is downloaded and stored locally.

```bash
$ ls /var/lib/apt/lists/
archive.ubuntu.com_ubuntu_dists_noble_main_binary-amd64_Packages.lz4
...
$ du -sh /var/lib/apt/lists/
51M	/var/lib/apt/lists/

$ apt-cache stats
Total package names: 164366
```

164,366 packages known, from a 51 MB local copy. Searching and dependency resolution happen against this file, which is why they are instant.

The consequence is the one command everyone learns first: **the local index goes stale.** `apt update` refreshes it, and must be run before installing, or the package manager works from an outdated list — trying to download versions that have been replaced, or not seeing a package that exists.

```bash
$ sudo apt update      # refresh the index
$ sudo apt install nginx
```

### Signing

Packages are downloaded over the network and installed as root, which makes their authenticity a security question rather than a formality.

Each repository signs its index with a cryptographic key, and the package manager verifies the signature against a public key held locally before trusting anything. A tampered package fails the check and is refused.

This is why adding a third-party repository always involves importing its key as a separate step. Without the key, the repository's packages cannot be verified, and installing them anyway means trusting an unverified source with root access to the machine.

## The two ecosystems

Linux packaging did not settle on one standard. Two families formed in the 1990s and both are still in wide use, so which one a machine uses is decided by its distribution.

**deb** came from Debian in 1993 and is used by Debian, Ubuntu, and everything derived from them — which covers most cloud images and most developer laptops running Linux.

**rpm** (Red Hat Package Manager) came from Red Hat in 1997 and is used by RHEL, CentOS, Fedora, Rocky, Alma, and SUSE — which covers most corporate and enterprise servers.

Neither is better. They solve the same problem with the same concepts, and the split persists because each has a large ecosystem of packages, tools, and habits built around it.

### What is the same

Everything on this page. Both have packages carrying files plus metadata, both declare dependencies and resolve them automatically, both work from signed repositories with a downloadable index, and both have a low-level tool for a single package file and a high-level tool that works from repositories.

Learning one means understanding the other, because only the surface differs.

### What differs

| | deb | rpm |
|---|---|---|
| Distributions | Debian, Ubuntu | RHEL, CentOS, Fedora, SUSE |
| Package file | `hello_2.10-3build1_amd64.deb` | `hello-2.10-3.el9.x86_64.rpm` |
| Low-level tool | `dpkg` | `rpm` |
| High-level tool | `apt` | `dnf` (previously `yum`) |
| Repository config | `/etc/apt/sources.list.d/` | `/etc/yum.repos.d/` |
| Installed-package records | `/var/lib/dpkg/` | `/var/lib/rpm/` |
| Refresh the index | `apt update`, run explicitly | automatic, on each `dnf` command |

Four of those are worth a note.

**The filenames encode the same information differently.** `hello_2.10-3build1_amd64.deb` uses underscores and separates the distribution's revision with a hyphen; `hello-2.10-3.el9.x86_64.rpm` uses hyphens throughout and marks the target distribution in the release field (`el9` meaning Enterprise Linux 9). Both give name, version, distribution revision, and architecture.

**Index refreshing differs, and it catches people moving between them.** `apt` uses whatever index it last downloaded, so `apt update` must be run first or the information is stale. `dnf` checks the index freshness itself and refreshes when needed, so there is no separate update step — which is why an `apt` habit of running `update` first looks unnecessary on a Fedora machine, and why forgetting it on Ubuntu produces confusing failures.

**Package names are not the same across the two.** The same software is often packaged under different names — the Apache web server is `apache2` on Debian and Ubuntu, `httpd` on RHEL and Fedora. Development files follow different conventions too: `-dev` suffixes on deb, `-devel` on rpm.

**Recommended dependencies behave differently.** Debian and Ubuntu install `Recommends` by default, so a package can pull in more than it strictly needs. The rpm family has `weak dependencies` serving the same role, also installed by default, but the sets are curated differently — the same software can arrive with a noticeably different footprint on the two systems.
