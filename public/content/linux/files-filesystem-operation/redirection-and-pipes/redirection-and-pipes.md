# Redirection and Pipes

By default a command reads from your keyboard and writes to your terminal. Redirection and pipes let you change where a command's input comes from and where its output goes — into files, into other commands, or nowhere at all. This is the machinery behind combining small tools into bigger ones.

## The three streams

**Every command has three default channels, each identified by a number:**

- **stdin** — *standard input*, channel **0** — where the command reads input (your keyboard by default).
- **stdout** — *standard output*, channel **1** — where it writes its normal output (your terminal by default).
- **stderr** — *standard error*, channel **2** — where it writes error and diagnostic messages (also your terminal by default).

Those numbers are **file descriptors**, the handles the shell uses to refer to each channel. They matter because redirection can target a specific one — `2>` acts on stderr, for instance. Normal output and errors are kept separate on purpose: it lets you save a command's results to a file while its error messages still appear on screen, or throw the errors away while keeping the results.

## Redirecting output: `>` and `>>`

**`>`** sends a command's stdout to a file instead of the terminal, **overwriting** the file — creating it if needed, emptying it if it already exists:

```bash
$ echo hello > out.txt
$ cat out.txt
hello
```

**`>>`** does the same but **appends**, keeping whatever is already there:

```bash
$ echo world >> out.txt
$ cat out.txt
hello
world
```

The difference matters: `>` silently replaces the whole file, so a stray `echo fresh > out.txt` would leave `out.txt` containing only `fresh`.

## Redirecting input: `<`

**`<`** feeds a file into a command's stdin, as if you had typed the file's contents. Many commands accept a filename as an argument anyway, but with `<` the command reads from the stream and never sees the name:

```bash
$ wc -l fruits.txt
3 fruits.txt
$ wc -l < fruits.txt
3
```

Both count 3 lines, but with `<` the filename is missing from the output — `wc` simply received data on its input and had no idea where it came from.

## Standard error and `/dev/null`

By default stdout and stderr both land on your terminal, mixed together. Redirecting stdout with `>` leaves stderr behind, because `>` only touches channel 1. To redirect errors, name channel 2 with **`2>`**:

```bash
$ ls fruits.txt nope.txt
ls: cannot access 'nope.txt': No such file or directory   # stderr
fruits.txt                                                # stdout
$ ls fruits.txt nope.txt 2> errors.txt
fruits.txt
```

Now the normal output prints while the error goes into `errors.txt`.

**`2>&1`** means "send channel 2 to wherever channel 1 is currently going" — it merges errors into the stdout stream. Combined with a redirect, it puts everything in one place. Taking the same `ls` as before:

```bash
$ ls fruits.txt nope.txt > everything.txt 2>&1
$ cat everything.txt
ls: cannot access 'nope.txt': No such file or directory
fruits.txt
```

Both the error and the normal output ended up in `everything.txt`. Order matters, though: `> file 2>&1` sends both to the file, but `2>&1 > file` does not — it points stderr at the terminal *first*, then sends only stdout to the file.

**`/dev/null`** is a special file that discards anything written to it — a black hole. Redirect to it when you don't want the output at all:

```bash
$ ls fruits.txt nope.txt 2> /dev/null     # discard the errors, keep normal output
fruits.txt
$ command > /dev/null 2>&1                # discard everything, stdout and stderr
```

## Pipes: `|`

**A pipe, `|`, connects one command's stdout directly to the next command's stdin**, so the second works on the first's output with no file in between. This is how small tools combine into larger ones:

```bash
$ cat fruits.txt | head -2
apple
banana
```

`cat` writes the file to its stdout, the pipe hands that to `head`, and `head` prints the first two lines. You can chain as many stages as you like. For example, `ls | wc -l` counts the entries in the current directory — `ls` lists them one per line, and `wc -l` counts the lines:

```bash
$ ls
a.txt  b.txt  c.log  d.md
$ ls | wc -l
4
```

Pipes become far more powerful once you add the filtering and sorting tools from the next chapter.

## `tee` — send output two ways

**`tee`** copies its stdin to a file *and* to stdout at the same time, so you can save output and still see it (or pass it further down a pipe). It's named after a T-shaped pipe splitter:

```bash
$ echo saved | tee teed.txt
saved
$ cat teed.txt
saved
```

The word `saved` was both printed and written to the file. Use **`tee -a`** to append instead of overwrite. A common real use is `command | tee build.log` — watching output scroll by while keeping a copy.

## `xargs` — turn input into arguments

Some commands read their input as a stream (like `wc`); others expect it as command-line **arguments** (like `rm`, `touch`, or `mkdir`), and those ignore stdin entirely. **`xargs`** bridges the gap: it reads items from stdin and lays them out as arguments to a command.

```bash
$ echo one.txt two.txt three.txt | xargs touch
```

The three names arrive on `xargs`'s stdin, and `xargs` runs `touch one.txt two.txt three.txt`, creating the files. Piping straight into `touch` wouldn't work — `touch` doesn't read stdin. The classic pairing is with `find`:

```bash
$ find . -name "*.tmp" | xargs rm
```

One catch: by default `xargs` splits its input on **spaces and newlines**, so a filename that contains a space is read as two separate items. Given a file literally named `my file.txt`:

```bash
$ find . -name "*.txt" | xargs ls
ls: cannot access './my': No such file or directory
ls: cannot access 'file.txt': No such file or directory
./normal.txt
```

`xargs` chopped `./my file.txt` at the space into `./my` and `file.txt`, and both failed. The fix is to separate items with a **null byte** — a character that can't occur inside a filename — instead of whitespace: `find -print0` emits null-separated names, and `xargs -0` reads them that way, so each name stays whole:

```bash
$ find . -name "*.txt" -print0 | xargs -0 ls
./my file.txt
./normal.txt
```

## Chaining commands: `;`, `&&`, `||`

These run several commands from one line, differing in whether the next one depends on the previous succeeding. They rely on exit codes — `0` for success, non-zero for failure.

**`;`** runs the commands in order, no matter what:

```bash
$ echo one ; echo two
one
two
```

**`&&`** runs the next command **only if** the previous one **succeeded**:

```bash
$ mkdir newproj && echo "directory created"
directory created
```

**`||`** runs the next command **only if** the previous one **failed**:

```bash
$ test -f nope.xyz || echo "file is missing"
file is missing
```

A frequent pattern is `command1 && command2` for "do this, and only continue if it worked" — like `cd build && make`, which won't try to build if the directory isn't there.

## Line continuation: `\`

A backslash at the very end of a line lets a long command **continue onto the next line**; the shell joins them back into one:

```bash
$ echo one \
  two \
  three
one two three
```

This is purely for readability — it's identical to typing it all on one line — and it's handy for breaking up long commands with many options.

## Running in the background: `&`

Normally a command holds your terminal until it finishes. `sleep 30` is a simple example — it does nothing for 30 seconds and then exits — and while it runs, your prompt is frozen: you can't type the next command until it's done (or you interrupt it with Ctrl+C):

```bash
$ sleep 30
   (the terminal waits here for 30 seconds, then the prompt returns)
```

Ending the command with **`&`** runs it in the **background** instead: the shell starts it and hands your prompt straight back, so you can keep working while it runs:

```bash
$ sleep 30 &
[1] 12345
$
```

The shell prints a job number (`[1]`) and the process's PID (`12345`), then returns the prompt immediately. Managing background jobs properly — bringing them to the foreground, listing them, keeping them running after you log out — is covered in the processes chapter; here it's enough to know that `&` sets a command running on its own.