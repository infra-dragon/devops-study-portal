# How Commands Work

## What is a command

**A command is a single instruction that tells the computer to run a program.** You type it into the **terminal** — the text window where you work with Linux — and the shell running inside the terminal reads the line and starts the program you named.

## The parts of a command

At its simplest, a command has two parts:

```
<command_name> <arguments>
```

`<command_name>` is the program you want to run. `<arguments>` are the input the program works on — much like the parameters you pass to a function. They tell the program what to operate on. For example:

```bash
cat notes.txt
```

Here `cat` is the command (it prints a file's contents to the screen) and `notes.txt` is the argument: the input file that `cat` should print.

### Flags

Most commands also take **flags** (also called *options*), which change how the program behaves. They sit between the command and the arguments and usually start with a dash:

```
<command_name> <flags> <arguments>
```

For example:

```bash
ls -l /home
```

- `ls` is the command — on its own, it lists the files and folders inside a directory.
- `-l` is a flag — it tells `ls` to change its behavior, here printing a long, detailed listing instead of the plain default.
- `/home` is the argument — the directory you want `ls` to list.

A few rules for flags:

- Short flags' names use one dash (`-l`); long flags' names use two (`--all`).
- Short flags can be combined: `-l -a` becomes `-la`.
- Some flags take their own value: in `head -n 5 notes.txt`, the `-n` flag takes the value `5` (show the first 5 lines).

## Reading the documentation

Every command comes with built-in help, so you never have to guess what its flags do.

Open a command's full manual page:

```
man <command_name>
```

For example, `man ls` opens the manual for `ls`. Scroll with the arrow keys or space, search with `/`, and quit with `q`.

Get a shorter summary printed straight into the terminal:

```
<command_name> --help
```

For example, `ls --help` prints a quick usage reminder.

`--help` is quickest for a reminder; `man` is the complete reference.

## Three handy commands

**`echo`** prints text back to you.

```bash
echo Hello        # prints: Hello
```

Before your text ever reaches `echo`, the shell splits the line into separate words wherever it sees spaces and hands each word to `echo` as its own argument. `echo` then prints those arguments with exactly one space between them — so any extra spaces you typed are thrown away:

```bash
echo Hello,    World     # prints: Hello, World
```

To keep the text exactly as written, wrap it in quotes so the shell passes the whole thing as a single argument:

```bash
echo "Hello,    World"   # prints: Hello,    World
```

**`type`** tells you what a name actually is — a program on disk, a shell built-in, an alias, or a function.

```bash
$ type echo
echo is a shell builtin
```

**`which`** prints the location of the program a name would run.

```bash
$ which python3
/usr/bin/python3
```

The difference between the last two: `which` only finds programs on disk, while `type` also knows about built-ins, aliases, and functions — so `type` gives the fuller picture.