# What Is a CLI and a Shell

---

## The CLI

**The CLI (command-line interface) is a way of using the system where you type one line of text, a program runs, and it prints text back.**

Everything moving through it is text — the line you type, the output you get. No windows, no buttons, no mouse coordinates. Every command also ends with a numeric **exit status**: 0 means success, anything else means failure. That is how a program reports its result to whatever started it.

---

## The shell

**A shell is an ordinary program whose job is to read the command line you typed, find the program you asked for, start it, and wait for it to finish.**

It is not part of the kernel and has no special powers: it runs as your user, has a **PID (process ID)** like any other program, and can be replaced with a different one. Its whole life is a loop — print the prompt, read a line, run the command, wait, print the prompt again. "Run the command" means asking the kernel to copy the shell process (the `fork` system call), replace that copy with the program you asked for (`execve`), then wait for it to exit (`wait`). That last step is why the prompt only comes back once the command is done.

The shell has no screen and no keyboard of its own. It reads bytes from whatever is attached to its input, and writes bytes to its output. In an interactive session that is a terminal device; in a script it is a file. The shell cannot tell the difference without explicitly checking.

Which shell you get at login is recorded in `/etc/passwd`. `$SHELL` is the shell configured for you; `ps -p $$` shows the one you are actually inside (`$$` = the shell's own PID).

```console
$ ps -p $$ -o pid,comm
    PID COMMAND
   4821 bash
```

---

## The terminal emulator

**A terminal emulator is a graphical program that draws a grid of text in a window: it turns your keystrokes into bytes, and turns the bytes it receives back into glyphs on screen.**

It never runs your commands, and it never sees "a command" at all — only bytes, moving in two directions:

- **Keys → bytes.** The graphical system (X11 or Wayland) delivers key events to it, and it encodes each one: `l` → `0x6c`, Enter → `0x0d`, `Ctrl+C` → `0x03`, `↑` → three bytes `0x1b 0x5b 0x41` (`ESC [ A`).
- **Bytes → pixels.** Most bytes coming back are characters to paint. Some are **escape sequences**: in-band instructions aimed at the emulator itself. `ESC [ 31 m` sets the text colour to red, `ESC [ 2J` clears the screen, `ESC [ 2A` moves the cursor up two rows.

```console
$ printf 'plain \033[31mred\033[0m\n'
plain red        # \033[31m is an instruction to the emulator, not text to print
```

Common ones: `gnome-terminal`, `konsole`, `alacritty`, `xterm`, iTerm2, Windows Terminal.

---

## The PTY: the thing between them

**A PTY (pseudo-terminal) is not a program — it is a pair of character device files created by the kernel, and it is what connects the two user-space programs to each other: the terminal emulator on one end, the shell on the other.**

The emulator holds the **master** end (opened through `/dev/ptmx`); the shell has the **slave** end open as its input and output (`/dev/pts/3`). Bytes written to one end become readable at the other. Nothing touches the disk — the kernel simply buffers them.

Sitting between the two ends is the **line discipline**: kernel code that processes the byte stream in flight. It is what

- echoes the characters you type back toward the screen (the shell is not doing that),
- turns control bytes into signals: `0x03` (Ctrl+C) becomes a `SIGINT` delivered to whichever program is in the foreground, `0x1a` (Ctrl+Z) becomes `SIGTSTP`,
- in **canonical mode**, buffers a whole line, handles Backspace itself, and releases the line to the reader only when you press Enter.

Bash switches the terminal *out* of canonical mode and does the echoing and line editing itself. That is why `↑` recalls your previous command in bash, but prints a literal `^[[A` in `cat`.

```console
$ tty            # the slave device this shell is reading from
/dev/pts/3
```

---

## Putting it together

Three separate pieces — and only the middle one lives in the kernel.

| Piece | Program or kernel? | Job | Example |
|---|---|---|---|
| **Terminal emulator** | User-space program | keystrokes ⇄ bytes ⇄ glyphs | `gnome-terminal` |
| **PTY** | Kernel device pair — not a program | carries the bytes, echoes, raises signals | `/dev/ptmx` ⇄ `/dev/pts/3` |
| **Shell** | User-space program | reads command lines, starts programs | `bash` |
| **Command** | User-space program | does the actual work | `/usr/bin/ls` |

```console
$ ps -o pid,ppid,comm,tty -p $$,$PPID
    PID    PPID COMMAND          TT
   4820    3901 gnome-terminal-  ?       # the emulator: no terminal of its own
   4821    4820 bash             pts/3   # the shell: attached to /dev/pts/3
```

What actually happens when you type `ls` and press Enter:

1. The emulator turns the keystroke into the byte `0x6c` (`l`) and **writes it to the PTY master**.
2. The kernel makes that byte readable on the slave end. **Bash reads it** — and writes it straight back out to the PTY, which is why the character appears on screen. Same for `0x73` (`s`).
3. Enter sends `0x0d`. Bash now has a complete line, parses `ls`, forks, and execs `/usr/bin/ls`. The child inherits the same PTY as its input and output.
4. `ls` writes its output bytes to `/dev/pts/3`. The kernel makes them readable at the master end.
5. **The emulator reads them from the master** and paints them into the window.
6. `ls` exits, the shell's `wait` returns, and bash writes a new prompt — down the same path.

So the emulator never sees a command, only bytes; the shell never sees a keystroke or a pixel, only bytes. Neither knows the other exists — the PTY is the only thing they share.

And none of this is mandatory. Over SSH the emulator runs on your laptop, while the SSH server process (`sshd`) creates the PTY on the remote machine. In a cron job or a script there is no terminal at all: the shell reads its commands from a file, with nothing attached to it.

```console
$ ssh server 'tty'
not a tty
```