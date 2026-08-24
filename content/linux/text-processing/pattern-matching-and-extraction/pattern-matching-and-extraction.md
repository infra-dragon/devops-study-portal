# Pattern Matching and Extraction

**`grep`** searches text for lines that match a pattern — the most-used text tool. Those patterns can be literal strings or **regular expressions** (regex), a compact language for describing the *shape* of text.

## `grep` — search for matching lines

**`grep`** (Global Regular Expression Print) scans its input and prints every line that contains a match for the pattern:

```bash
$ grep ERROR app.log
2026-07-15 09:03:10 ERROR db connection lost
2026-07-15 09:04:02 ERROR timeout
```

General form is: 
`grep <pattern> <file>`

Given a file it searches the file; with no file it reads stdin, so it drops into pipes — 
`<some_command> | grep <pattern>`
This filters another command's output down to the matching lines.

## Useful flags

**`-n`** prefixes each match with its line number:

```bash
$ grep -n ERROR app.log
3:2026-07-15 09:03:10 ERROR db connection lost
5:2026-07-15 09:04:02 ERROR timeout
```

**`-i`** ignores case, matching regardless of capitalization:

```bash
$ grep -i info app.log
2026-07-15 09:01:12 INFO server started
2026-07-15 09:03:44 INFO request handled
2026-07-15 09:05:20 info cache cleared
```

**`-v`** inverts the match — prints the lines that **don't** match:

```bash
$ grep -v INFO app.log
2026-07-15 09:02:04 WARN slow query
2026-07-15 09:03:10 ERROR db connection lost
2026-07-15 09:04:02 ERROR timeout
2026-07-15 09:05:20 info cache cleared
```

**`-c`** prints just the count of matching lines:

```bash
$ grep -c ERROR app.log
2
```

**`-r`** searches recursively through a directory, showing `file:line` for each hit:

```bash
$ grep -r TODO .
./src/main.py:TODO: fix this
./notes.txt:TODO: refactor
```

**`-l`** lists only the names of files that contain a match (usually paired with `-r`):

```bash
$ grep -rl TODO .
./src/main.py
./notes.txt
```

## Regular expressions

**Regular expressions** (regex) — a small language where certain characters describe the shape of text rather than exact letters. `grep` treats patterns as regex by default; a plain word like `ERROR` is simply a regex with no special characters in it.

### Anchors: `^` and `$`

Anchors match a **position**, not a character. 
**`^`** matches the start of a line and **`$`** the end:

```bash
$ grep '^co' words.txt      # lines starting with "co"
cot
coat
color
colour
$ grep 't$' words.txt       # lines ending with "t"
ct
cat
caat
caaat
cot
coat
```

Combine them as `^word$` to match a line that is **exactly** that and nothing more.

### Character classes: `[...]` and `.`

**`[...]`** matches any single character from the set inside the brackets. The classic use is a spelling variant — `gr[ae]y` matches both `gray` and `grey`:

```bash
$ grep 'gr[ae]y' text.txt
gray
grey
```

Inside the brackets, a hyphen gives a **range**.
`[0-9]` is any digit, `[a-z]` any lowercase letter, `[A-Z]` any uppercase letter:

```bash
$ grep '[0-9]' text.txt        # lines containing any digit
2024
v2
abc123
$ grep '[A-Z]' text.txt        # lines containing an uppercase letter
Hello
```

A leading **`^`** inside the brackets **negates** the set — `gr[^a]y` is `gr`, then any character that is **not** `a`, then `y`:

```bash
$ grep 'gr[^a]y' text.txt
grey
groy
```

A bare **`.`** (outside brackets) matches any single character at all:

```bash
$ grep 'gr.y' text.txt
gray
grey
groy
```

Classes combine with the anchors above — `^[0-9]` matches only lines that start with a digit:

```bash
$ grep '^[0-9]' text.txt
2024
```

### Quantifiers: `*`, `+`, `?`, `{n,m}`

A quantifier says how many times the **preceding** item may repeat. There are four.
Only `*` works on its own; `+`, `?`, and `{}` need `-E` flag, for the reason in the next section.

**`*`** — zero or more:

```bash
$ grep 'ca*t' words.txt      # c, zero-or-more a, then t
ct
cat
caat
caaat
```

It matched everything from `ct` (zero a's) to `caaat` (three a's).

**`+`** — one or more:

```bash
$ grep -E 'ca+t' words.txt
cat
caat
caaat
```

**`?`** — zero or one, i.e. optional. Here the `u` may or may not be there:

```bash
$ grep -E 'colou?r' words.txt
color
colour
```

**`{n,m}`** — between n and m times (`{n}` means exactly n). `ca{2,3}t` wants two or three a's:

```bash
$ grep -E 'ca{2,3}t' words.txt
caat
caaat
```

## Basic vs extended regex: `-E`

`grep` understands two flavors of regex. By default it uses **basic** regex (BRE), in which `+`, `?`, `{`, `}`, `(`, `)`, and `|` are *literal characters* — to use them as operators you must escape them with a backslash. With **`-E`** (extended regex, ERE) they act as operators directly, which reads far more cleanly.

The difference is clearest with `+`. In basic regex a bare `+` means a literal plus sign, so this finds nothing:

```bash
$ grep 'ca+t' words.txt
$            # no match — it looked for a literal "ca+t"
```

Escaping it as `\+` makes it an operator, and `-E` lets you drop the backslash entirely — both match the same lines:

```bash
$ grep 'ca\+t' words.txt     # basic regex, escaped
cat
caat
caaat
$ grep -E 'ca+t' words.txt   # extended regex
cat
caat
caaat
```

The same escaping rule applies to `?`, `{}`, `()`, and to alternation with `|` ("this or that"), which is another ERE feature:

```bash
$ grep -E 'cat|dog' words.txt   # match cat OR dog
cat
dog
```

Because the escaping in basic regex gets noisy quickly, most people just use `grep -E` (or its old alias `egrep`) whenever a pattern needs `+`, `?`, `{}`, `()`, or `|`. The characters `^`, `$`, `.`, `*`, and `[...]` mean the same thing in both flavors.

## More useful examples

**`-o`** prints only the matched part of each line instead of the whole line — ideal for *extracting* data. This pulls the IP addresses out of a log:

```bash
$ grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' net.log
192.168.1.10
10.0.0.5
192.168.1.20
```

**`-w`** matches whole words only, so a search for `cat` won't also hit `category` or `concatenate`:

```bash
$ grep -w cat words2.txt
cat
a cat sat
```

**`-A`**, **`-B`**, and **`-C`** print lines of context *after*, *before*, and *around* each match — invaluable when reading logs. `-A1` shows each match plus the line after it:

```bash
$ grep -A1 ERROR app.log
2026-07-15 09:03:10 ERROR db connection lost
2026-07-15 09:03:44 INFO request handled
2026-07-15 09:04:02 ERROR timeout
2026-07-15 09:05:20 info cache cleared
```

And `grep` is constantly used as a filter inside a pipe. This keeps only the directory lines from a long listing — the ones whose permissions start with `d`:

```bash
$ ls -l | grep '^d'
drwxr-xr-x 2 alice alice 4096 Jul 17 09:00 src
```

A few more you'll reach for often: `grep -rn <pattern> .` (recursive, with line numbers), `grep -E 'foo|bar'` (several patterns at once), and `history | grep ssh` (find an earlier command).