# Viewing File Content

## Printing a file: `cat`, `less`

### `cat` — print the whole file

**`cat`** prints a file's entire contents to the terminal at once. It's ideal for short files; a long one will scroll past faster than you can read, so use a pager for those.

```bash
$ cat run.sh

#!/bin/bash
echo hi
```

The name is short for "concatenate" — give it several files and it prints them one after another (`cat part1 part2`). The **`-n`** flag numbers every line:

```bash
$ cat -n app.log
     1  2026-07-15 09:01:12 INFO  server started
     2  2026-07-15 09:01:13 INFO  listening on port 8080
     3  2026-07-15 09:02:04 INFO  GET /health 200
     ...
```

### `less` — page through a long file

**`less`** opens a file one screen at a time so you can scroll instead of having it fly past. It's the standard **pager**, the same viewer `man` uses, and it doesn't load the whole file at once — so it stays fast even on multi-gigabyte logs.

```bash
$ less app.log
```

Once inside, a few keys do most of the work:

- **Space** / **b** — forward / back one screen
- **↑ / ↓** — down / up one line
- **/text** then **Enter** — search forward; **n** / **N** jump to the next / previous match
- **g** / **G** — jump to the start / end of the file
- **q** — quit

## Viewing part of a file: `head`, `tail`, `wc`

### `head` — the first lines

**`head`** prints the beginning of a file — the first 10 lines by default. Good for checking a file's format or header without dumping the whole thing.

```bash
$ head app.log
2026-07-15 09:01:12 INFO  server started
2026-07-15 09:01:13 INFO  listening on port 8080
2026-07-15 09:02:04 INFO  GET /health 200
2026-07-15 09:02:31 INFO  GET /users 200
2026-07-15 09:03:10 WARN  slow query (1.2s)
2026-07-15 09:03:44 INFO  GET /users/42 200
2026-07-15 09:04:02 ERROR db connection lost
2026-07-15 09:04:03 INFO  retrying connection
2026-07-15 09:04:05 INFO  connection restored
2026-07-15 09:05:20 INFO  GET /health 200
```

The **`-n`** flag sets how many lines:

```bash
$ head -n 3 app.log
2026-07-15 09:01:12 INFO  server started
2026-07-15 09:01:13 INFO  listening on port 8080
2026-07-15 09:02:04 INFO  GET /health 200
```

### `tail` — the last lines

**`tail`** prints the end of a file — the last 10 lines by default, or a count you set with **`-n`**. This is usually what you want with logs, since the newest entries are at the bottom.

```bash
$ tail -n 3 app.log
2026-07-15 09:05:20 INFO  GET /health 200
2026-07-15 09:06:01 WARN  high memory usage
2026-07-15 09:06:33 INFO  GET /health 200
```

### `tail -f` — follow a file as it grows

**`tail -f`** ("follow") keeps the file open and prints new lines the moment they're appended, so you can watch a log update live. It doesn't return to the prompt — it stays running until you stop it with **Ctrl+C**.

```bash
$ tail -f app.log
2026-07-15 09:06:33 INFO  GET /health 200
... new lines appear here as they are written
```

A related flag, **`-F`** (capital), also keeps up when the log is rotated — replaced by a fresh file — which is common for long-running services.

### `wc` — count lines, words, and bytes

**`wc`** ("word count") reports the size of a file's *content*. With no flags it prints three numbers — lines, words, and bytes — followed by the name:

```bash
$ wc app.log
 12  70 526 app.log
```

Each flag narrows it to a single count, which is usually what you want:

```bash
$ wc -l app.log      # lines — by far the most used
12 app.log
$ wc -w app.log      # words
70 app.log
$ wc -c app.log      # bytes
526 app.log
$ wc -m app.log      # characters
526 app.log
$ wc -L app.log      # length of the longest line
48 app.log
```

`-m` matches `-c` here because the file is plain ASCII — one byte per character. For UTF-8 text, where a single character can span several bytes, the two differ.

## Describing a file: `file`, `stat`

### `file` — what kind of file is it?

**`file`** reports what a file actually contains by inspecting its bytes, not its name — so it works even with no extension or a misleading one.

```bash
$ file app.log run.sh app.log.gz /usr/bin/ls
app.log:     ASCII text
run.sh:      Bourne-Again shell script, ASCII text executable
app.log.gz:  gzip compressed data, was "app.log", ...
/usr/bin/ls: ELF 64-bit LSB pie executable, x86-64, dynamically linked, ...
```

It recognizes text, scripts, compressed archives, images, executables, and hundreds of other formats by their content.

### `stat` — full metadata

**`stat`** shows everything the filesystem records about a file — its size, permissions, owner, and timestamps — much more than `ls -l`.

```bash
$ stat app.log
  File: app.log
  Size: 526          Blocks: 8          IO Block: 4096   regular file
Device: 254,0   Inode: 573485      Links: 1
Access: (0644/-rw-r--r--)  Uid: ( 1000/   alice)   Gid: ( 1000/   alice)
Access: 2026-07-15 09:06:33 +0000
Modify: 2026-07-15 09:06:31 +0000
Change: 2026-07-15 09:06:31 +0000
 Birth: 2026-07-15 09:00:02 +0000
```

The permissions appear in both octal (`0644`) and symbolic (`-rw-r--r--`) form, both explained in the permissions chapter. The three time fields are the part worth knowing now:

- **Access** — when the file was last read.
- **Modify** — when its contents last changed.
- **Change** — when its metadata (permissions, name, owner) last changed.

(**Birth** is the creation time, where the filesystem tracks it.)