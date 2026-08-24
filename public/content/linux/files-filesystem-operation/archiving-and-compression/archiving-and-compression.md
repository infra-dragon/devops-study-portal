# Archiving and Compression

## Two different operations

On Linux, **archiving** and **compression** are two separate jobs, often handled by two separate tools:

- **Archiving** bundles many files and directories into a single file (a "tarball"), keeping their names, structure, and permissions. It does *not* make anything smaller — it just packs everything into one container. `tar` does this.
- **Compression** re-encodes data so it takes up fewer bytes. It works on a single stream of data, not a folder of files. `gzip`, `bzip2`, and `xz` do this.

The usual workflow chains them: `tar` packs a folder into one `.tar`, then a compressor shrinks that into a `.tar.gz` (or `.tar.xz`). That's why the extensions stack — each one records a step. The `zip` format is the exception: it does both at once, which is why it's the norm on Windows and macOS.

## `tar` — bundle files into one archive

**`tar`** ("tape archive") packs files and directories into a single archive and unpacks them again. It has three main modes, and always needs **`-f`** to name the archive file:

- **`-c`** create, **`-x`** extract, **`-t`** list
- add **`-z`** for gzip (`.gz`), **`-j`** for bzip2 (`.bz2`), or **`-J`** for xz (`.xz`) compression
- **`-v`** (verbose) lists each file as it's processed

Create a gzip-compressed archive of a folder:

```bash
$ tar -czvf project.tar.gz project/
project/
project/readme.txt
project/data.txt
```

List what's inside, without extracting:

```bash
$ tar -tzf project.tar.gz
project/
project/readme.txt
project/data.txt
```

Extract it — add **`-C`** to unpack somewhere other than the current directory:

```bash
$ tar -xzf project.tar.gz            # extract into the current directory
$ tar -xzf project.tar.gz -C /tmp/   # extract into /tmp
```

A memory aid for the flag soup: **c**reate / e**x**tract / lis**t**, plus **z**ip and **f**ile — so `czf` reads as "create zipped file" and `xzf` as "extract zipped file." Modern `tar` can also detect the compression on its own, so `tar -xf project.tar.gz` works even without `-z`.

## Compression tools: `gzip`, `bzip2`, `xz`

These compress a **single file**. By default each one *replaces* the original with a compressed version — the original is deleted:

```bash
$ gzip data.txt        # data.txt becomes data.txt.gz (data.txt is gone)
$ gunzip data.txt.gz   # back to data.txt
```

Use **`-k`** to keep the original, and **`-d`** to decompress (so `gzip -d` is the same as `gunzip`). `bzip2` and `xz` behave the same way, with `bunzip2` and `unxz` to reverse them.

The three differ in how hard they work — a tradeoff between speed and how small the result gets:

| Tool | Extension | Compress speed | Compression | Typical use |
|------|-----------|----------------|-------------|-------------|
| `gzip` | `.gz` | fast | good | the everyday default; supported everywhere |
| `bzip2` | `.bz2` | slower | better | older, now largely superseded |
| `xz` | `.xz` | slowest | best | distributing files where small size matters |

For a sense of scale, a 220 KB text file here shrank to about 700 bytes with `gzip` — though exact ratios depend heavily on the data. A newer tool, **`zstd`** (`.zst`), is increasingly the default choice because it's very fast *and* compresses well; `tar` supports it with `--zstd`.

## `zip` and `unzip` — the cross-platform format

**`zip`** bundles and compresses in one step, producing a `.zip` that Windows and macOS open natively — so it's what to reach for when sharing with people not on Linux. Unlike the compressors above, it leaves your original files in place.

Add **`-r`** to include a folder's contents, and use `unzip` to list or extract:

```bash
$ zip -r project.zip project/     # create
$ unzip project.zip               # extract
$ unzip -l project.zip            # list contents without extracting
Archive:  project.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
        0  2026-07-16 00:41   project/
        6  2026-07-16 00:41   project/readme.txt
   220000  2026-07-16 00:41   project/data.txt
---------                     -------
   220006                     3 files
```

On minimal systems `zip` and `unzip` may need installing (`sudo apt install zip unzip`).