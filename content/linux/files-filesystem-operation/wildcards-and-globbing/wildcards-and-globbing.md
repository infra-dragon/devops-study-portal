# Wildcards and Globbing

A **wildcard** is a special character that stands in for other characters in a filename. **Globbing** is what the shell does with wildcards: it expands a pattern into the list of filenames that match. Together they let you act on many files at once — `rm *.tmp`, `cp report.* backup/` — instead of naming each one by hand.

## The patterns

### `*` — any characters

**`*`** matches any run of characters, including none. `*.txt` matches every name ending in `.txt`; `report.*` matches every name starting with `report.`.

```bash
$ ls *.txt
report.txt
$ ls report.*
report.csv  report.log  report.txt
```

### `?` — a single character

**`?`** matches exactly one character — no more, no fewer. `photo?.jpg` matches `photo1.jpg`, but not `photo10.jpg` (two characters) or `photo.jpg` (none).

```bash
$ ls photo?.jpg
photo1.jpg  photo2.jpg  photo3.jpg
```

### `[...]` — one character from a set or range

**`[abc]`** matches exactly one character from the set inside the brackets. A range like **`[a-z]`** or **`[0-9]`** matches one character anywhere in that range.

```bash
$ ls photo[13].jpg      # a 1 or a 3
photo1.jpg  photo3.jpg
$ ls photo[1-2].jpg     # the range 1 through 2
photo1.jpg  photo2.jpg
```

### `{...}` — brace expansion (generate a list (text))

**`{a,b,c}`** is different from the others: instead of matching existing files, it expands into every listed item, whether or not those files exist. It's a **text generator**, not a file matcher.

```bash
$ echo report.{txt,log}
report.txt report.log
$ echo file{1,2,3}.txt        # these files don't need to exist
file1.txt file2.txt file3.txt
```

It also expands numeric and letter ranges written with `..`:

```bash
$ echo {1..5}
1 2 3 4 5
```

An item can even be empty. `{,.bak}` holds two items — nothing, and `.bak` — so it expands the word once unchanged and once with `.bak` added on the end:

```bash
$ echo config.yml{,.bak}
config.yml config.yml.bak
```

That empty-item trick is what powers the quick-backup command in the examples below.

A common practical use is creating several directories at once: `mkdir -p site/{css,js,img}` makes all three folders in a single command.

## How globbing works

**The key idea: globbing is done by the shell, before the command runs.** When you type `ls *.txt`, the shell first replaces `*.txt` with the list of matching filenames, then runs `ls` with those names as its arguments. The command never sees the `*` — it just receives a list of files.

You can watch this happen with `echo`, which only ever prints the arguments it's handed:

```bash
$ echo *.txt
report.txt
```

`echo` knows nothing about wildcards; the shell already turned `*.txt` into `report.txt` before `echo` started. Three things follow from this:

**It works with every command.** Because the shell does the expanding, globbing behaves the same with `ls`, `cp`, `rm`, `cat`, and anything else — none of them implement it themselves.

**No match → the pattern is passed through as-is.** If nothing matches, bash leaves the pattern untouched and hands the literal text to the command, which usually then complains:

```bash
$ ls *.xyz
ls: cannot access '*.xyz': No such file or directory
```

**Quotes switch it off.** Since the shell doesn't expand inside quotes, quoting a pattern passes the literal characters through — the same rule as with `$` variables:

```bash
$ echo "*.txt"
*.txt
```

One more thing worth knowing: `*`, `?`, and `[...]` skip hidden files. A leading-dot name like `.gitignore` is not matched by `*`, so `rm *` won't touch your dotfiles.

> These wildcards are **not** regular expressions. Regex is a different, more powerful pattern language (covered later), and symbols like `*` mean something different there.

## Useful examples

**Count lines across matching files.** `wc` receives every match at once, so it also prints a total:

```bash
$ wc -l *.py
 3 app.py
 1 setup.py
 2 utils.py
 6 total
```

**Peek at several files at once.** `head` (and `tail`) label each file with a `==>` header when given more than one:

```bash
$ head -n 2 *.csv
==> orders.csv <==
id,total
1,99

==> users.csv <==
name,age
alice,30
```

**Check the sizes of one type of file.** Pair a glob with `ls -lh`:

```bash
$ ls -lh *.log
-rw-r--r-- 1 alice alice 2.0K Jul 16 02:05 app.log
-rw-r--r-- 1 alice alice  51K Jul 16 02:05 error.log
```

**Make a quick backup with braces.** `config.yml{,.bak}` expands to `config.yml config.yml.bak`, so this copies a file to `<name>.bak` in one short command:

```bash
$ cp config.yml{,.bak}
$ ls config.yml*
config.yml  config.yml.bak
```

And a handful of common one-liners — all silent on success:

```bash
$ cp *.jpg ~/photos/               # copy every JPG into a folder
$ mv *.log logs/                   # move every log into logs/
$ rm *.tmp                         # delete all temp files
$ tar -czf configs.tar.gz *.conf   # archive every .conf file
$ rm photo[1-5].jpg                # delete photo1.jpg through photo5.jpg
```