# Basic Text Tools

## `wc` — count lines, words, and bytes

**`wc`** ("word count") reports the size of its input as three numbers — lines, words, and bytes — followed by the name:

```bash
$ wc fruits.txt
 6  6 39 fruits.txt
```

That's 6 lines, 6 words, and 39 bytes. A flag narrows it to a single count, which is usually what you want:

```bash
$ wc -l fruits.txt      # lines
6 fruits.txt
$ wc -w fruits.txt      # words
6 fruits.txt
$ wc -c fruits.txt      # bytes
39 fruits.txt
```

As a text tool, `wc` is most often the *last* stage of a pipe, boiling a stream down to a single number — you'll see it used that way below.

## `cut` — extract columns

**`cut`** pulls specific columns out of each line. The most common form splits each line on a delimiter and keeps the fields you name:

```
cut -d <delimiter> -f <field_numbers> <file>
```

For example, take just the first column of a comma-separated file:

```bash
$ cut -d',' -f1 people.csv
name
alice
bob
carol
```

`-d` sets the delimiter (here a comma) and `-f` picks the field number. You can name several fields at once:

```bash
$ cut -d',' -f1,3 people.csv
name,city
alice,NYC
bob,LA
carol,SF
```

**The default delimiter is a tab.** Leave off `-d` and `cut` splits on tabs — exactly right for tab-separated files, so no `-d` is needed there:

```bash
$ cut -f1 people.tsv
name
alice
bob
```

There is no default for `-f`, though: you must always tell `cut` which fields (or characters) you want, or it errors out. As an alternative to fields:

`-c` selects by character position — here the first five characters of each line:

```bash
$ cut -c1-5 people.csv
name,
alice
bob,2
carol
```

Two limits worth knowing: the **delimiter must be a single character**, and `cut` can't reorder columns — `-f3,1` still comes out in the file's original order.

## `tr` — translate, squeeze, and delete characters

**`tr`** ("translate") transforms characters in a stream. Unlike most tools it takes no filename — it reads only stdin — so you feed it with a pipe or `<`. Its basic form is two character sets:

```
tr <set1> <set2>
```

It replaces each character in `<set1>` with the character at the same position in `<set2>`. The classic example is changing case:

```bash
$ echo "hello world" | tr 'a-z' 'A-Z'
HELLO WORLD
```

Here `a-z` and `A-Z` line up character by character, so every lowercase letter becomes its uppercase counterpart. Two flags switch the mode:

**Delete** (`-d`) removes every listed character (it takes just one set):

```bash
$ echo "hello world" | tr -d 'lo'
he wrd
```

**Squeeze** (`-s`) collapses runs of a repeated character down to a single one:

```bash
$ echo "a---b-----c" | tr -s '-'
a-b-c
```

## `sort` — order lines

**`sort`** reorders the lines of its input, alphabetically by default:

```bash
$ sort fruits.txt
apple
apple
apple
banana
banana
cherry
```

The flag you'll reach for most is **`-n`**, for numeric order. Alphabetical sorting compares character by character, so without `-n` numbers come out wrong — `10` sorts before `2`, because `1` comes before `2`:

```bash
$ sort nums.txt          # alphabetical — wrong for numbers
10
2
25
33
4
$ sort -n nums.txt       # numeric — correct
2
4
10
25
33
```

Other common flags: **`-r`** reverses the order and **`-u`** drops duplicates as it sorts. And **`-k`** sorts by a chosen column, with **`-t`** to set the delimiter (like `cut`) — so you can sort delimited data by any field. Here a comma-separated file is sorted by its second column, numerically:

```bash
$ sort -t',' -k2 -n ages.csv
bob,25
dave,28
alice,30
carol,35
```

`-t','` splits each line on commas, `-k2` sorts by the second field, and `-n` keeps that field numeric.

## `uniq` — collapse adjacent duplicate lines

**`uniq`** removes repeated lines — but only when they are **next to each other**. It compares each line just to the one before it, so duplicates that aren't adjacent slip straight through:

```bash
$ uniq fruits.txt
banana
apple
cherry
apple
banana
apple
```

Nothing was removed, because no two identical lines happened to be adjacent. That's why `uniq` is almost always paired with `sort`, which groups identical lines together first:

```bash
$ sort fruits.txt | uniq
apple
banana
cherry
```

The most useful variant adds **`-c`**, which prefixes each line with how many times it occurred — an instant frequency tally:

```bash
$ sort fruits.txt | uniq -c
      3 apple
      2 banana
      1 cherry
```

`sort | uniq -c` is one of the most common one-liners in all of text processing. Two more flags filter by how often a line appears. **`-d`** keeps only the lines that were duplicated:

```bash
$ sort fruits.txt | uniq -d
apple
banana
```

And **`-u`** keeps only the lines that appeared exactly once:

```bash
$ sort fruits.txt | uniq -u
cherry
```

## `diff` and `patch` — compare files and apply changes

**`diff`** compares two files line by line and reports what would need to change to turn the first into the second:

```bash
$ diff v1.txt v2.txt
2c2
< line two
---
> line TWO changed
3a4
> line four
```

In this default format, `<` lines come from the first file and `>` lines from the second; the codes are instructions — `2c2` means "line 2 changed," `3a4` means "after line 3, add a line."

Far more common in practice is the **unified** format, `diff -u`, which shows the change with surrounding context and `-`/`+` markers — the same format Git and code-review tools use:

```bash
$ diff -u v1.txt v2.txt
--- v1.txt
+++ v2.txt
@@ -1,3 +1,4 @@
 line one
-line two
+line TWO changed
 line three
+line four
```

Lines with a leading space are unchanged context, `-` lines are removed, and `+` lines are added. The `@@ -1,3 +1,4 @@` line is the *hunk header*, which says where this chunk of changes sits in each file: `-1,3` means "3 lines starting at line 1" in the old file, and `+1,4` means "4 lines starting at line 1" in the new file. (The `-` always refers to the first file, `+` to the second.)

**`patch`** applies a diff to a file — it takes `diff`'s output and makes exactly those edits, which is how changes get shared and applied without sending whole files back and forth:

```bash
$ diff -u v1.txt v2.txt > changes.patch
$ patch v1.txt < changes.patch
patching file v1.txt
```

Afterwards `v1.txt` has been edited to match `v2.txt`. Since `patch` reads the diff on stdin, you don't have to save it to a file first — you can pipe `diff` straight in:

```bash
$ diff -u v1.txt v2.txt | patch v1.txt
patching file v1.txt
```

The two-step version is what you'd use to *keep* the patch file and send it to someone or apply it elsewhere; the piped version just applies the change on the spot. This diff-and-patch pair is how source-code changes were shared for decades, and the unified diff it produces is still the format Git uses under the hood.