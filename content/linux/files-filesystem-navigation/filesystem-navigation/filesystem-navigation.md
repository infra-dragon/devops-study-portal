# Filesystem Navigation

## `pwd` — print working directory

**`pwd`** prints the full absolute path of the directory you're currently in.

```bash
$ pwd
/home/alice
```

Shells often show your location in the prompt, but `pwd` always prints the exact, full path — useful when the prompt is customized or abbreviated.

## `cd` — change directory

**`cd`** moves you to another directory. It takes the destination as an argument and, when it succeeds, prints nothing — you can confirm the move with `pwd`:

```bash
$ cd /var/log
$ pwd
/var/log
```

The destination can be absolute or relative, and several shortcuts are worth knowing:

```bash
cd docs          # relative: into "docs" inside the current directory
cd ./docs        # the same thing — "./" means "in the current directory"
cd /var/log      # absolute: straight to /var/log from anywhere
cd ..            # up one level, into the parent directory
cd ~             # your own home directory (cd with no argument does the same)
cd ~bob          # another user's home directory — here /home/bob
cd -             # back to the directory you were in just before
```

## `ls` — list

**`ls`** lists the contents of a directory — the current one if you give no argument, or any path you name.

```bash
$ ls
README.md  backup.tar  docs  report.log  run.sh
```

### `-l` — long format, one entry per line with detail

```bash
$ ls -l
total 4640
-rw-r--r-- 1 alice alice     220 Jul 10 09:00 README.md
-rw-r--r-- 1 alice alice 4718592 Jul 15 08:20 backup.tar
drwxr-xr-x 2 alice alice    4096 Jul 11 14:30 docs
-rw-r--r-- 1 alice alice   18240 Jul 14 16:45 report.log
-rwxr-xr-x 1 alice alice      48 Jul 12 11:15 run.sh
```

Reading that first line left to right — `-rw-r--r-- 1 alice alice 220 Jul 10 09:00 README.md` — gives seven columns:

1. **`-rw-r--r--`** — type and permissions. The first character is the type (`-` file, `d` directory, `l` symbolic link); the next nine are the read / write / execute permissions.
2. **`1`** — link count: how many hard links point to this entry.
3. **`alice`** — owner: the user who owns it.
4. **`alice`** — group: the group that owns it.
5. **`220`** — size in bytes (or `4.5M`-style with `-h`).
6. **`Jul 10 09:00`** — when it was last modified.
7. **`README.md`** — the name. For a symbolic link, an arrow and target follow, like `link -> README.md`.

The `total` line reports disk blocks used. By default, 1 block equals 1 KiB (1024-byte).

### `-a` — include hidden entries

Hidden files are any files or directories whose names begin with a period (**`.`**). This naming convention makes them invisible to standard file and directory listings by default. For example the `.` and `..` every directory has, and files like `.gitignore`:

```bash
$ ls -a
.  ..  .gitignore  README.md  backup.tar  docs  report.log  run.sh
```

### `-F` — mark each entry's type

Appends `/` to directories, `*` to executables, `@` to symbolic links, so you can spot types without `-l`:

```bash
$ ls -F
README.md  backup.tar  docs/  report.log  run.sh*
```

### `-h` — human-readable sizes

With `-l`, the size column reads `4.5M` or `18K` instead of raw byte counts:

```bash
$ ls -lh
total 4640
-rw-r--r-- 1 alice alice  220 Jul 10 09:00 README.md
-rw-r--r-- 1 alice alice 4.5M Jul 15 08:20 backup.tar
drwxr-xr-x 2 alice alice 4.0K Jul 11 14:30 docs
-rw-r--r-- 1 alice alice  18K Jul 14 16:45 report.log
-rwxr-xr-x 1 alice alice   48 Jul 12 11:15 run.sh
```

### `-t` — sort by time, newest first

Handy for finding what you just changed:

```bash
$ ls -lt
total 4640
-rw-r--r-- 1 alice alice 4718592 Jul 15 08:20 backup.tar
-rw-r--r-- 1 alice alice   18240 Jul 14 16:45 report.log
-rwxr-xr-x 1 alice alice      48 Jul 12 11:15 run.sh
drwxr-xr-x 2 alice alice    4096 Jul 11 14:30 docs
-rw-r--r-- 1 alice alice     220 Jul 10 09:00 README.md
```

### `-r` — reverse the sort

`-r` flips whatever order is in effect, so `-tr` is time order reversed: oldest at the top, newest at the bottom right above your prompt — the usual way to read logs:

```bash
$ ls -ltr
total 4640
-rw-r--r-- 1 alice alice     220 Jul 10 09:00 README.md
drwxr-xr-x 2 alice alice    4096 Jul 11 14:30 docs
-rwxr-xr-x 1 alice alice      48 Jul 12 11:15 run.sh
-rw-r--r-- 1 alice alice   18240 Jul 14 16:45 report.log
-rw-r--r-- 1 alice alice 4718592 Jul 15 08:20 backup.tar
```

### `-S` — sort by size, largest first

```bash
$ ls -lS
total 4640
-rw-r--r-- 1 alice alice 4718592 Jul 15 08:20 backup.tar
-rw-r--r-- 1 alice alice   18240 Jul 14 16:45 report.log
drwxr-xr-x 2 alice alice    4096 Jul 11 14:30 docs
-rw-r--r-- 1 alice alice     220 Jul 10 09:00 README.md
-rwxr-xr-x 1 alice alice      48 Jul 12 11:15 run.sh
```

### `-n` — numeric owner and group

Like `-l`, but shows the owner and group as numeric IDs instead of names:

```bash
$ ls -n
total 4640
-rw-r--r-- 1 1000 1000     220 Jul 10 09:00 README.md
-rw-r--r-- 1 1000 1000 4718592 Jul 15 08:20 backup.tar
drwxr-xr-x 2 1000 1000    4096 Jul 11 14:30 docs
-rw-r--r-- 1 1000 1000   18240 Jul 14 16:45 report.log
-rwxr-xr-x 1 1000 1000      48 Jul 12 11:15 run.sh
```

### `-R` — recursive

Lists this directory, then descends into every subdirectory beneath it:

```bash
$ ls -R
.:
README.md  backup.tar  docs  report.log  run.sh

./docs:
guide.md
```

These flags combine in any order: `ls -lah`, `ls -ltr`, `ls -RF`.

## `tree` — show the whole structure

**`tree`** prints a directory and everything inside it as an indented tree, the same shape as the diagrams from the previous page — handy for seeing a layout at a glance.

```bash
$ tree
.
├── README.md
├── backup.tar
├── docs
│   └── guide.md
├── report.log
└── run.sh

1 directory, 5 files
```

### `-L <n>` — limit the depth

Stops at `n` levels; essential on large trees so the output doesn't scroll forever. Here it stops at the top level and doesn't descend into `docs`:

```bash
$ tree -L 1
.
├── README.md
├── backup.tar
├── docs
├── report.log
└── run.sh

1 directory, 4 files
```

### `-d` — directories only

A quick look at the folder structure alone, skipping files:

```bash
$ tree -d
.
└── docs

1 directory
```

### `-a` — include hidden entries

Dot-names, which `tree` leaves out by default:

```bash
$ tree -a
.
├── .gitignore
├── README.md
├── backup.tar
├── docs
│   └── guide.md
├── report.log
└── run.sh

1 directory, 6 files
```

### `-h` — human-readable sizes

Prints each entry's size in brackets before the name:

```bash
$ tree -h
.
├── [ 220]  README.md
├── [4.5M]  backup.tar
├── [4.0K]  docs
│   └── [  30]  guide.md
├── [ 18K]  report.log
└── [  48]  run.sh

1 directory, 5 files
```

`tree` isn't always installed by default; add it with `sudo apt install tree` (Debian/Ubuntu) or `sudo dnf install tree` (RHEL/Fedora).