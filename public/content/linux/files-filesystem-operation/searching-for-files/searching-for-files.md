# Searching for Files

There are two different kinds of search here: finding files by their attributes anywhere on disk (`find`, `locate`), and finding where an installed command's program lives (`which`, `whereis`).

## `find` — search the filesystem live

**`find`** walks a directory tree and lists every file matching the criteria you give. It reads the disk directly, so its results are always current, and it can search by many attributes at once. Its shape is a starting directory followed by one or more tests:

```
find <where> <tests>
```

Common tests:

- **`-name "PATTERN"`** — match the filename against a glob pattern (`-iname` to ignore case):

```bash
$ find . -name "*.py"
./setup.py
./project/src/main.py
./project/src/util.py
./run.py
```

- **`-type`** — restrict to a kind: `f` file, `d` directory, `l` symlink:

```bash
$ find . -type d
.
./project
./project/src
./project/logs
```

- **`-size`** — by size, with `+` for larger and `-` for smaller (`k`, `M`, `G` units):

```bash
$ find . -size +5M
./big.bin
```

- **`-mtime`** — by modification time in days: `+N` older than N days, `-N` within the last N days:

```bash
$ find . -mtime +30
./notes.txt
```

- **`-perm`** — by permission bits; handy for security checks, like finding files that anyone can write to:

```bash
$ find . -type f -perm -o+w
./project/config.yaml
```

Here `-o+w` means "others have write permission": `o` is *others* — everyone who isn't the file's owner or in its group — and `w` is the *write* bit. So this finds files any user on the system could modify. (The full permission notation is covered in the permissions chapter.)

Tests given together are combined with AND — every one must match:

```bash
$ find . -type f -name "*.log"
./project/logs/error.log
./project/logs/app.log
```

**Quote the pattern.** The `*` in `*.py` is a wildcard. Normally the shell fills in wildcards with matching filenames *before* the command runs (the globbing from the wildcards page) — but here you want `find`, not the shell, to do the matching, so it can search every subdirectory instead of just the current one.

You can see what the shell would do on its own with `echo`:

```bash
$ echo *.py
run.py setup.py
```

So `find . -name *.py` (no quotes) turns into `find . -name run.py setup.py` — only the current directory's files, and two of them where `find` expects a single pattern. `find` then gives up:

```bash
$ find . -name *.py
find: paths must precede expression: `setup.py'
```

Wrapping the pattern in quotes tells the shell to leave it alone and pass it to `find` untouched, so `find` does the matching itself across the whole tree — which is why `find . -name "*.py"` returned all four files above.

### Running a command on the results: `-exec`

**`-exec`** runs a command on every file `find` turns up. Inside it, `{}` stands for the current filename, and the command ends with `\;` (run once per file) or `+` (batch many files into a single run):

```bash
$ find . -name "*.log" -exec wc -l {} \;
1 ./project/logs/error.log
4 ./project/logs/app.log
```

`find` finds each `.log` file and runs `wc -l` on it. The `\;` form runs the command **separately for each file** — two independent `wc` calls here. The `+` form instead hands **all the files to a single** `wc` call: more efficient, and in this case `wc` adds a `total` line, because it received both files at once:

```bash
$ find . -name "*.log" -exec wc -l {} +
 1 ./project/logs/error.log
 4 ./project/logs/app.log
 5 total
```

The same pattern handles all sorts of jobs — deleting, copying, changing files:

```bash
$ find . -name "*.tmp" -exec rm {} \;            # delete each match
$ find . -name "*.log" -exec rm {} +             # same, batched into fewer rm calls
$ find . -name "*.conf" -exec cp {} /backup/ \;  # copy each match into /backup
```

For the very common case of deleting what it finds, `find` also has a built-in **`-delete`** action (`find . -name "*.tmp" -delete`), which skips `-exec` entirely.

### Exit status: nothing found vs. errors

Two outcomes look similar but are treated very differently.

**No matches — this counts as success.** If `find` searches without a problem but nothing matches, it prints nothing and exits with status `0`.

```bash
$ find . -name "*.nonexistent"
$ echo $?       # print the exit status of the last executed command
0
```

That surprises people used to tools like `grep`, which report "nothing found" as a *non-zero* status. With `find`, empty output plus exit `0` just means "searched fine, found nothing."

## `locate` — fast search with an index

**`locate`** finds files by name almost instantly, because instead of scanning the disk it looks up a prebuilt database of every filename:

```bash
$ locate sshd_config
/etc/ssh/sshd_config
```

The catch is that the database is only refreshed periodically (by `updatedb`, usually on a schedule), so `locate` can be **out of date** — it won't know about files created since the last update, and may still list files that have been deleted. Run `sudo updatedb` to refresh it. It also often isn't installed by default; add it with your package manager (the package is `plocate` or `mlocate`).

In short: `find` for an accurate, live search with rich criteria; `locate` for a quick name lookup when a possibly-stale index is fine.

## `which` and `whereis` — finding a command's files

These don't search your files — they find where an installed **command** lives.

**`which`** prints the path of the program that would run for a command name, by searching your `PATH` (you saw this back in "How commands work"):

```bash
$ which ls
/usr/bin/ls
```

**`whereis`** casts a wider net, reporting the command's binary, its manual page, and its source code, wherever those exist:

```bash
$ whereis ls
ls: /usr/bin/ls /usr/share/man/man1/ls.1.gz
```

Read the output as the command name, a colon, then every location `whereis` found for it. Here there are two: the executable itself (`/usr/bin/ls` — the program that runs), and its manual page (`/usr/share/man/man1/ls.1.gz` — the file `man ls` reads, stored compressed under `/usr/share/man`). If the command's source code were installed, a third path would appear alongside them. So `which` answers only "what will run?", while `whereis` also shows where the documentation and other parts live.