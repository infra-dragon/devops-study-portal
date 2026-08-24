# Terminal multiplexers: `tmux` and `screen`

## The problem

You connect to a server over SSH, start a long job — a build, a data import, a training run — and an hour later your laptop sleeps or the network drops. The SSH connection closes, and with it the shell it was running. Every program that shell started goes down too: they were its children, and when the terminal is lost they receive a hangup signal and are killed. The hour of work is gone, and you have to start over.

The cause is that your programs are tied to the SSH session. What is needed is to run them somewhere that is **not** tied to the connection, so that the connection can come and go while the work continues.

## What a terminal multiplexer is

A **terminal multiplexer** is a program that runs shells inside a long-lived background process of its own, and lets you connect to and disconnect from that process at will. The two in common use are **`tmux`** (the modern one) and **`screen`** (the older one); they do the same job, and this page uses `tmux` throughout.

The key move is that the multiplexer, not your SSH connection, becomes the parent of your shells. That parent keeps running on the server whether or not you are connected, so your programs are no longer children of the SSH session and are unaffected when it ends.

Three terms name the pieces:

- A **session** is a running instance of the multiplexer holding your work open — the shells you have started and the programs inside them. It lives in the multiplexer's background process on the server.
- **Detaching** disconnects your terminal from a session while leaving the session, and everything in it, running.
- **Attaching** connects a terminal back to a session that is still running.

The pattern that solves the opening problem is: start a session, work in it, detach (or simply lose the connection), and later — from any new SSH login — attach again.

## The server, and where it all lives

The background process that holds everything open is the **tmux server**. The first `tmux` command you run starts it; every session you create lives *inside* that one server, and a single server can hold several sessions at once (`work`, `logs`, `deploy`). So the full structure is: one **server** process, holding one or more **sessions**, each holding **windows and panes**, each of those a shell. Ending the server ends all of its sessions together.

```bash
$ tmux ls
deploy: 1 windows (created Fri Jul 24 21:27:59 2026)
logs: 1 windows (created Fri Jul 24 21:27:59 2026)
work: 1 windows (created Fri Jul 24 21:27:59 2026)
```

The point that makes the whole thing work is *where* this server runs: **on the remote computer, not on your laptop and not inside the SSH connection.** SSH is only a temporary pipe from your terminal to a server that is already running over there. Put the flow together:

1. You SSH into the remote machine, which gives you a shell on it.
2. You run `tmux new -s work`, starting the tmux server (if it is not already running) and a session inside it — your terminal is now attached.
3. You detach, or the connection drops. The server and session keep running on the remote machine; you can close SSH entirely.
4. Later you SSH back in and run `tmux attach -t work`, reconnecting to the same still-running session.

Because the server belongs to the machine it runs on, its sessions exist only there: SSH to a different server and you get that machine's own tmux, with its own separate sessions. Your `work` session lives on the one host where you created it.

## What a session actually is, and why nothing is lost

When you attach to a session, you find it exactly as you left it because you are reconnecting to **the very same shell processes that were already running** — detaching never stopped them; it only disconnected your screen from them. Nothing is saved and restored, because nothing was ever torn down.

Concretely, the shell inside a session keeps, across a detach and reattach: its **working directory**, its **shell and environment variables**, its **aliases and functions**, its **command history**, and any **program still running** in it — because all of that is the live state of a process that never stopped. The verification: set a variable, an alias, and a directory in a session, disconnect, reconnect, and every one is still there, because it is the same process's memory.

This is the difference from an ordinary SSH shell, which *is* torn down when the connection drops — taking its variables, its directory, and its running programs with it.

## Starting, detaching, attaching

**Start a named session** with `new-session`; `-s` gives it a name so you can find it later. tmux ships short names for its commands — `new` is simply a built-in shorthand for `new-session`, `ls` for `list-sessions`, `a` for `attach-session` — the two spellings run the identical command:

```bash
$ tmux new -s work            # 'new' and 'new-session' are the same command
```

This drops you into an ordinary shell inside the session.

**Detach** with the key sequence `Ctrl-b` then `d`. `Ctrl-b` is tmux's *prefix*: tmux ignores your normal typing until you press it, so its own commands never collide with the shell's. `Ctrl-b d` therefore means "prefix, then detach." You are returned to your original shell and the session keeps running. Losing the SSH connection detaches you the same way, without the keystrokes.

**List** running sessions with `ls`, and **attach** to one with `attach` (`-t` selects it by name):

```bash
$ tmux ls
work: 1 windows (created Fri Jul 24 20:56:27 2026)
$ tmux attach -t work
```

That a session is genuinely separate can be seen directly: its shell has a different process id from the shell you started it from, so it is its own process that outlives its creator.

**End** a session by exiting every shell in it, or from outside with `kill-session`:

```bash
$ tmux kill-session -t work
```

## Windows and panes

A session can hold more than one shell, arranged as windows and panes. The essential fact about both is that **each is a separate shell process** — they do not share variables, aliases, or working directory with one another. A variable set in one window is not visible in another; they are independent shells that merely live in the same session.

- A **window** fills the whole screen, like a tab: you see one window at a time and switch between them. `Ctrl-b c` creates one, `Ctrl-b n` / `Ctrl-b p` move to the next / previous, and `Ctrl-b 0`…`9` jump to one by number.
- A **pane** is a window split into regions shown at once, so several shells share the screen side by side. `Ctrl-b "` splits the current pane top/bottom, `Ctrl-b %` splits it left/right, and `Ctrl-b` then an arrow key moves between panes.

So the nesting is: a session contains windows, and a window contains one or more panes; every pane and every window is its own shell. What they *do* share is the session itself — they stay alive together, and they detach and reattach together as one unit. This structure is a convenience for organising work within a single connection (a build in one pane, its logs in another) and is independent of the keep-alive purpose above.

## `screen`

`screen` is an older program that does the same job, and is sometimes the only one already installed. Almost everything transfers; two differences are worth knowing. Its prefix key is `Ctrl-a` instead of `Ctrl-b`, and its commands are given as flags rather than words:

| Task | `tmux` | `screen` |
|---|---|---|
| Start a named session | `tmux new -s work` | `screen -S work` |
| Detach | `Ctrl-b d` | `Ctrl-a d` |
| List sessions | `tmux ls` | `screen -ls` |
| Reattach | `tmux attach -t work` | `screen -r work` |

The concepts — sessions, detaching, attaching — are identical; only the keystrokes and command spellings differ. Use `tmux` when you can choose it; reach for `screen` when it is what the machine already has.

## Why this is standard practice on servers

Any command that must outlast your connection belongs inside a session: a long build or migration, a service you are running by hand, or simply a shell you want to return to with its history and directory intact. Run such work directly in an SSH shell and a dropped connection loses it; run it inside `tmux` and the connection becomes disposable — you can disconnect deliberately, be disconnected by accident, move to another machine, and pick the session back up unchanged.