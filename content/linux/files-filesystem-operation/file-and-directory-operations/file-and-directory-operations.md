# File and Directory Operations

These commands create, copy, move, and delete files and directories. Most of them print nothing when they succeed — the result is the change itself, which you confirm with `ls`. A recurring theme: deleting and overwriting are permanent and silent by default, so a couple of these deserve real care.

## `touch` — create empty files, update timestamps

**`touch`** has two uses. If the file doesn't exist, it creates an empty one; if the file already exists, it updates the file's timestamp to now without touching the contents.

```bash
$ touch newfile.txt
$ ls -l newfile.txt
-rw-r--r-- 1 alice alice 0 Jul 15 09:30 newfile.txt
```

Creating empty placeholder files and bumping a file's modification time (for example, to make a build tool treat it as changed) are the two things it's for.

## `mkdir` — create a directory

Creates one level at a time and fails if a parent doesn't exist.

```bash
$ mkdir photos
```

Flag **`-p`** (parents) creates any missing parents along the path, and stays quiet if the directory already exists:

```bash
$ mkdir a/b/c
mkdir: cannot create directory 'a/b/c': No such file or directory
$ mkdir -p a/b/c        # creates a, then a/b, then a/b/c
```

## `rmdir` — remove a directory

Removes a directory, but only if it's empty — a built-in safety check:

```bash
$ rmdir full
rmdir: failed to remove 'full': Directory not empty
```

## `cp` — copy

**`cp`** copies a file to a new name or location; the original stays where it is.

```bash
$ cp report.txt report-backup.txt      # copy to a new name
$ cp report.txt /tmp/                   # copy into another directory
```

To copy a directory and everything inside it, add **`-r`** (recursive). Without it, `cp` refuses to copy a directory:

```bash
$ cp -r project/ project-backup/
```

Two flags are worth having:

- **`-i`** (interactive) — ask before overwriting an existing file, since `cp` otherwise overwrites it silently:

```bash
$ cp -i f1 f2
cp: overwrite 'f2'?
```

- **`-v`** (verbose) — print each file as it's copied.

## `mv` — move and rename

**`mv`** moves a file to another location. Because renaming is just moving a file to a new name in the same directory, the same command also renames:

```bash
$ mv draft.txt final.txt                # rename (same directory)
$ mv final.txt /home/alice/documents/   # move to another directory
```

Unlike `cp`, no `-r` is needed to move a directory — `mv` moves the whole thing at once. Like `cp`, it overwrites the destination silently unless you add **`-i`**.

## `rm` — remove (delete)

**`rm`** deletes files, permanently. There is no recycle bin or trash — once removed, a file is gone — which makes `rm` the command to treat with the most caution.

```bash
$ rm oldfile.txt
$ rm *.tmp              # delete every .tmp file in the current directory
```

Its flags:

- **`-r`** (recursive) — delete a directory and everything inside it. Plain `rm` won't remove directories.
- **`-i`** (interactive) — prompt before each deletion; a useful safety net.
- **`-f`** (force) — never prompt, and don't complain about files that don't exist.

**`rm -rf`** combines the two: it deletes an entire directory tree, no questions asked. It's the normal way to clear out a folder — and also the classic way to destroy data by accident. Before running it, check the path carefully: a stray space (`rm -rf / tmp/cache` instead of `rm -rf /tmp/cache`) or an empty variable (`rm -rf "$DIR/"` when `$DIR` is unset) can wipe far more than you meant to.

## `test` — check a condition

**`test`** evaluates a condition — often about a file — and reports the answer as an exit code rather than printing anything: exit status `0` means true, non-zero means false. It's almost always used inside an `if` statement or alongside `&&` / `||`, not on its own.

Its file checks are the ones relevant here:

- `-e FILE` — the file exists (any type)
- `-f FILE` — exists and is a regular file
- `-d FILE` — exists and is a directory
- `-r` / `-w` / `-x FILE` — is readable / writable / executable
- `-s FILE` — exists and is not empty

Because it prints nothing, you either check `$?` or, more usefully, chain it with `&&` ("and then") to act on a true result:

```bash
$ test -f notes.txt && echo "the file exists"
the file exists
$ test -d /etc && echo "yes, a directory"
yes, a directory
```

The `[ ... ]` form is the same command written differently — `[` *is* `test`, and the closing `]` is just a required final argument — so these two lines are identical:

```bash
$ test -f notes.txt
$ [ -f notes.txt ]
```

`test` also compares strings and numbers to build conditions in scripts; those operators, and the related `[[ ... ]]`, are covered in the shell-scripting chapter.

## `rename` — batch renaming

**`rename`** renames many files at once by applying a pattern, instead of one at a time. It's handy for a quick one-off, but it comes with two catches: it often isn't installed, and there are actually two different programs called `rename` with incompatible syntax — a Perl-based one on Debian/Ubuntu, and a simpler one on Fedora/RHEL. Because of that inconsistency, for anything you need to repeat or run on another machine, most people use a `for` loop (Chapter 10) or `find -exec` (later this chapter) instead, which behave the same everywhere.

The Debian/Ubuntu (Perl) version takes a substitution, and **`-n`** previews the result without changing anything:

```bash
$ rename -n 's/\.txt$/.md/' *.txt      # -n: show what would change, rename nothing
```

Install it with `sudo apt install rename` or `sudo dnf install rename`.