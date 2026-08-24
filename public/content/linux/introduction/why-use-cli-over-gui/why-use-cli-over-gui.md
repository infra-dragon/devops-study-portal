# Why Use CLI over GUI

The GUI is easier to learn, but the CLI is where you'll spend most of your time as an engineer. Almost every advantage comes down to one fact: **a command is just text you type.** Text can be saved, repeated, shared, and joined together. Mouse clicks can't.

| | CLI | GUI |
|---|---|---|
| Save an action and run it again | Yes — it's just text | No |
| Combine several tools into one step | Yes, with `\|` | No |
| Work on a server with no desktop | Yes | No |
| Act on 1 file or 10,000 files | Same effort | One click each |
| See what options are available | Harder | Easier |

---

## You can save, repeat, and automate it

Because a command is text, you can put it in a script and run it again later, hand it to a teammate, or have something like `cron` or a CI pipeline run it on a schedule with nobody watching. A series of mouse clicks can't be saved and replayed.

```bash
# runs the same way by hand, inside a script, or nightly from cron
sudo systemctl restart nginx
```

The exact command is also a record of what you did — you can paste it into a ticket or a runbook, and anyone can run the identical thing. "Open Settings, click Network, then…" can't be shared or checked that way.

## You can combine small tools

The pipe symbol `|` takes the output of one command and feeds it straight into the next. Instead of one big program, you connect small tools to get exactly the result you want.

```bash
# how many ERROR lines are in app.log?
grep ERROR app.log | wc -l
```

Here `grep` pulls out the matching lines and `wc -l` counts them. Each tool does one thing; together they answer the question.

## It works on servers with no desktop

Most servers, cloud instances, and containers have no graphical desktop installed at all. You connect over the network with `ssh` and get a terminal — the CLI is the only interface there is. It also stays fast over a slow or distant connection, because it's only sending text.

```bash
ssh deploy@server 'tail -n 50 /var/log/nginx/error.log'
```

## One command handles any number of files

A single command treats one file and ten thousand files the same way. In a graphical file manager you'd be clicking each one.

```bash
# delete every .log file older than 30 days — however many there are
find /var/log/app -name '*.log' -mtime +30 -delete
```

## When the GUI is better

The CLI isn't always the right choice.

- **Finding out what's possible** — a menu shows you the available options; a blank prompt assumes you already know the command's name.
- **Anything visual** — comparing two images, reading a graph, or watching a live dashboard is far clearer on screen than in text.
