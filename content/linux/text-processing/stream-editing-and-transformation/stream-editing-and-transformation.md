# Stream Editing and Transformation

`sed` and `awk` both read text line by line and change it as it passes through — like `grep`, but instead of just selecting lines they *transform* them. `sed` is the tool for find-and-replace and line edits; `awk` is for working with columns and doing calculations on them. Both are small programming languages and a few patterns cover almost all everyday use.

## `sed` — the stream editor

**`sed`** ("stream editor") reads its input line by line, applies editing commands, and writes the result to stdout. By default it leaves the original file untouched and just prints the edited version.

### Substitution

By far the most common `sed` command is substitution, written `s/pattern/replacement/`. It replaces the **first** match on **each** line:

```bash
$ echo "a a a a" | sed 's/a/b/'
b a a a
```

Add the **`g`** flag ("global") to replace **every** match on each line:

```bash
$ echo "a a a a" | sed 's/a/b/g'
b b b b
```

The pattern is a regular expression — the same BRE from the last page, or ERE with `-E` — so full regex works on the left side. Substituting in a file prints the edited text but leaves the file as it was:

```bash
$ sed 's/localhost/0.0.0.0/' config.txt
host=0.0.0.0
port=8080
debug=false
timeout=30
```

The delimiter doesn't have to be `/` — any character works, which helps when the text itself contains slashes, like file paths:

```bash
$ echo "/usr/local/bin" | sed 's|/usr/local|/opt|'
/opt/bin
```

### Deletion

The **`d`** command deletes whole lines. Give it a pattern to delete every matching line:

```bash
$ sed '/debug/d' config.txt
host=localhost
port=8080
timeout=30
```

Or give it a line number to delete that specific line — `sed '2d'` drops line 2:

```bash
$ sed '2d' config.txt
host=localhost
debug=false
timeout=30
```

### In-place editing: `-i`

Everything above prints to stdout and leaves the file alone. To actually change the file, add **`-i`** ("in place"):

```bash
$ sed -i 's/false/true/' config.txt
$ cat config.txt
host=localhost
port=8080
debug=true
timeout=30
```

`-i` gives no output and no undo, so make a backup of anything important. Adding a suffix — **`-i.bak`** — edits the file *and* first saves a copy of it as `config.txt.bak`:

```bash
$ sed -i.bak 's/8080/9090/' config.txt
$ ls config.txt*
config.txt  config.txt.bak
$ cat config.txt.bak
host=localhost
port=8080
debug=true
timeout=30
```

`config.txt` now has the new port, while `config.txt.bak` preserves the version from just before the edit.

## `awk` — field processing

**`awk`** is a small but complete programming language built for text laid out in columns. It reads input line by line, automatically splits each line into **fields**, and lets you print, filter, and compute with them. Every `awk` program has the form `pattern { action }`: for each line, if it matches the pattern, `awk` runs the action — and with no pattern, the action runs on every line.

### Fields

By default `awk` splits on whitespace, and the fields are named `$1`, `$2`, `$3`, and so on, with `$0` being the whole line. Printing a column is the simplest use:

```bash
$ awk '{print $1}' scores.txt
alice
bob
carol
dave
$ awk '{print $1, $2}' scores.txt
alice 85
bob 92
carol 78
dave 90
```

(The comma in `print $1, $2` puts a space between them.) Splitting on whitespace only helps with whitespace-separated data, though. On a CSV line like `alice,30,NYC` there are no spaces at all, so `awk` treats the whole line as a single field, `$1`:

```bash
$ awk '{print $1}' people.csv
alice,30,NYC
bob,25,LA
carol,35,SF
```

The **`-F`** flag changes what `awk` splits on. With `-F','` it breaks each line at commas instead of spaces, so the fields line up as expected — `$1` is the name, `$2` the age, `$3` the city:

```bash
$ awk -F',' '{print $1, $2, $3}' people.csv
alice 30 NYC
bob 25 LA
carol 35 SF
```

### Patterns and conditionals

The pattern in front of the action decides *which* lines the action runs on. When that pattern is a regex written in slashes, `awk` runs the action only on the lines that contain a match. So `/math/ {print $1}` tests each line for "math" and, on the ones that have it, prints the first field — the names of the students taking math:

```bash
$ awk '/math/ {print $1}' scores.txt
alice
carol
```

The pattern can also be a **comparison on the fields themselves** — something a plain text filter can't express. Here `awk` keeps only the lines whose second field is greater than 85, then prints the name and score:

```bash
$ awk '$2 > 85 {print $1, $2}' scores.txt
bob 92
dave 90
```

### Built-in variables

`awk` tracks some values automatically as it reads. Two of the most useful are **`NR`** (the current line number) and **`NF`** (the number of fields on the line):

```bash
$ awk '{print NR, NF, $0}' scores.txt
1 3 alice 85 math
2 3 bob 92 science
3 3 carol 78 math
4 3 dave 90 science
```

### Arithmetic

`awk` can also accumulate values across lines and do math with them. A special **`END`** block runs once after all lines have been read — perfect for totals. This sums the second column:

```bash
$ awk '{sum += $2} END {print "total:", sum}' scores.txt
total: 345
```

The variable `sum` starts at zero, adds each line's `$2`, and `END` prints the result once at the finish. Divide by `NR` for an average:

```bash
$ awk '{sum += $2} END {print "average:", sum/NR}' scores.txt
average: 86.25
```

Between `sed` for edits and `awk` for columns and arithmetic, most day-to-day text transformation is covered — and both slot into pipes, so they combine freely with `grep`, `sort`, `cut`, and the rest.