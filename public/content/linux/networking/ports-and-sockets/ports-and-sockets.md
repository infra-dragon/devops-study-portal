# Ports and sockets

## Ports

A single server may run a website, a database, and an SSH daemon at once, and packets arriving for all three carry the same destination address. Something has to say which program each one is for.

**A port is a number from 0 to 65535 that identifies which program on a machine a packet is meant for.**

The address gets the packet to the machine; the port gets it to the right program. Together they form a complete destination, written with a colon between them, called a socket:

```
192.0.2.2:443        the program serving HTTPS on that machine
192.0.2.2:22         the SSH daemon on the same machine
```

**Ports only exist where a protocol makes room for one.** A packet carries a port number because the protocol it was built with includes a field for it, and not every protocol does.

**TCP** and **UDP** do. They are the two protocols programs use to exchange data, and both reserve a place in every packet for the destination port — which is what allows the packet to be handed to one particular program.

**ICMP**, the protocol `ping` uses, does not. There is no port field in an ICMP packet, so a port cannot be given even in principle:

```bash
$ ping 127.0.0.1:80
ping: 127.0.0.1:80: Name or service not known
```

Nothing is lost by this, because ICMP messages are not meant for a program. When a ping arrives, no program receives it and no program answers — the kernel recognises it as an echo request and sends the reply itself. Nothing is listening, and nothing needs to be:

```bash
$ sudo ss -anp | grep -i icmp
                        # no sockets at all, yet ping works
```

This is the reason `ping` and the tools on this page answer different questions. `ping` reaches a machine, because a machine is all an ICMP packet can be addressed to. Reaching one service on that machine requires a port, and therefore TCP or UDP.

A program that wants to receive connections claims a port and waits — this is called **listening**. Only one program may listen on a given port at a time, which is why starting a second web server on port 80 fails with "address already in use".

## Sockets

**A socket is a connection point held open by a program, through which it sends and receives data over the network.**

Each part of that:

- **a connection point** — one end of a network conversation. The other end is on another program, usually on another machine.
- **held open by a program** — it belongs to that program for as long as the program keeps it. Close it, and the connection is finished.
- **through which it sends and receives** — the socket is what the program actually uses. It does not handle addresses or packets; it writes data into the socket and reads data out of it, and the kernel does the rest.

A door is the closer comparison. A program opens one, things pass through it in both directions while it stays open, and closing it ends the traffic. Where the door leads is fixed when it is opened — that is the address and port.

Sockets come in two kinds, and the difference is whether anyone is on the other side.

A **listening socket** has no partner. The program has claimed an address and a port, and is waiting for someone to connect. No data passes through it; its only job is to accept arrivals.

A **connected socket** has a partner, and data flows through it both ways. It is identified by four values rather than two — the local address and port, plus the remote address and port:

```
127.0.0.1:9400   ←→   127.0.0.1:39792
this end              the other end
```

Those four values make each connection unique, which is how one web server on port 443 serves thousands of visitors at once. Every connection shares the server's address and port, but each visitor supplies a different address and port of their own, so no two sets of four match. The server holds a separate socket for each.

### Where the client's port comes from

A client does not choose its port. When a program opens a connection, the kernel assigns it an unused one automatically — an **ephemeral port**, meaning temporary and released when the connection closes.

```bash
$ cat /proc/sys/net/ipv4/ip_local_port_range
32768	60999
```

That range is where they come from on this machine. It explains something otherwise puzzling in socket listings: a connection shows a familiar port on one side and an arbitrary high number on the other, and the high number is simply the client end.

## Port numbers

The range 0–65535 is divided into three parts:

| Range | Name | Used for |
|---|---|---|
| 0–1023 | well-known | standard services — **root is required to listen here** |
| 1024–49151 | registered | assigned to particular applications |
| 49152–65535 | ephemeral | temporary client ports |

The kernel enforces that restriction on ports below 1024. Trying to listen on one as an ordinary user simply fails:

```bash
$ nc -l 80
nc: Permission denied

$ nc -l 8080          # no error — an ordinary user may use this one
```

The reason is trust. Anyone connecting to port 443 on a machine expects the real web server, not a program that any user happened to start. Reserving the low ports for root means only the administrator decides what answers there.

This is why applications so often run on 8080 rather than 80: on 8080 they can run as an ordinary user, with something privileged in front passing traffic to them.

### The ports worth knowing

| Port | Service |
|---|---|
| 22 | SSH |
| 25 | SMTP (mail) |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 6379 | Redis |

These are conventions, not rules — a web server can be told to use 9000 — but everything assumes them by default.

The full list is in **`/etc/services`**, which maps names to numbers:

```bash
$ grep -E "^(ssh|https|postgresql)\s" /etc/services
ssh		22/tcp				# SSH Remote Login Protocol
https		443/tcp				# http protocol over TLS/SSL
postgresql	5432/tcp	postgres	# PostgreSQL Database
```

This file is what lets tools print `ssh` instead of `22`. It does not control anything — editing it will not move a service.

## `ss` — see the sockets

**`ss` (socket statistics) lists the sockets on the machine.**

```
ss [-t] [-u] [-l] [-a] [-n] [-p]
```

| Flag | Effect |
|---|---|
| `-t` | TCP sockets |
| `-u` | UDP sockets |
| `-l` | listening sockets only |
| `-a` | all sockets, listening and connected |
| `-n` | show numbers, do not translate ports to names |
| `-p` | show which process owns each socket (needs root) |

The combination to remember is **`ss -tlnp`** — TCP, listening, numeric, with processes — which answers "what is accepting connections on this machine":

```bash
$ sudo ss -tlnp
State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN 0      1            0.0.0.0:9200      0.0.0.0:*    users:(("nc",pid=568,fd=3))
LISTEN 0      1          127.0.0.1:9201      0.0.0.0:*    users:(("nc",pid=569,fd=3))
```

Reading the columns:

- **`State`** — `LISTEN` here, meaning waiting for connections.
- **`Recv-Q` / `Send-Q`** — data received but not yet read by the program, and data sent but not yet acknowledged. On a listening socket, `Recv-Q` is the number of connections waiting to be accepted and `Send-Q` is the maximum allowed to queue. Persistent non-zero values on a connected socket mean a program that is not keeping up.
- **`Local Address:Port`** — where this socket is listening. The most important field on the page, explained below.
- **`Peer Address:Port`** — `0.0.0.0:*` for a listening socket, since there is no peer yet.
- **`Process`** — the program and its PID, shown only with root.

### `0.0.0.0` versus `127.0.0.1`

The two lines above differ in one place, and that difference decides whether the service is reachable at all.

The address before the colon is not the address being connected *to* by someone else — it is the address on this machine that the socket is willing to receive on. The port after the colon is fixed either way; only the set of addresses changes.

**`0.0.0.0:9200`** means port 9200 on **every** address this machine has. A machine with a loopback address and an ethernet address is reachable on port 9200 through both, so connections from other machines are accepted. It is only that one port — `0.0.0.0` says nothing about any other.

**`127.0.0.1:9201`** means port 9201 on the loopback address **only**. Programs on this machine can connect to it; nothing from outside can, because a packet arriving from another machine is addressed to this machine's real address, and the socket is not listening on that one.

This single distinction is behind a large share of "the service is running but I cannot connect" problems. The process is up, the port is open, the firewall is fine — and the service is bound to `127.0.0.1`, so nothing outside can ever reach it. Checking `ss -tlnp` and reading the local address is faster than any other test.

Both are legitimate. Binding to `127.0.0.1` is the correct choice for a database that only local applications should reach, and it is a common default for exactly that reason.

### Listening and connected together

**`-a`** shows both kinds at once, which makes the relationship clear:

```bash
$ sudo ss -tanp
State   Recv-Q Send-Q Local Address:Port  Peer Address:Port  Process
LISTEN  0      5            0.0.0.0:9400       0.0.0.0:*     users:(("python3",pid=598,fd=3))
ESTAB   0      0          127.0.0.1:9400    127.0.0.1:39792  users:(("python3",pid=598,fd=4))
ESTAB   0      0          127.0.0.1:39792   127.0.0.1:9400   users:(("python3",pid=600,fd=3))
```

Three sockets, and every one is doing something different:

1. The **listening** socket on port 9400, still waiting for further connections.
2. The **server's end** of the connection that was accepted — same port 9400, now with a peer.
3. The **client's end** — its local port is 39792, an ephemeral port assigned by the kernel, and its peer is the server.

Note that the server did not stop listening when a connection arrived. The listening socket stays, and each accepted connection becomes a separate socket, which is how a server handles many clients at once.

### Socket states

`ss` shows the state of each TCP socket:

| State | Meaning |
|---|---|
| `LISTEN` | waiting for connections |
| `ESTAB` | connected, data can flow |
| `TIME-WAIT` | closed, held briefly in case late packets arrive |
| `CLOSE-WAIT` | the other end closed; this end has not |
| `SYN-SENT` | a connection attempt with no reply yet |

Two of these are diagnostic. Many **`TIME-WAIT`** sockets are normal on a busy server — each closed connection lingers for a minute or two by design. Many **`CLOSE-WAIT`** sockets are not: they mean the program is not closing connections the other side has already ended, which is a bug that leaks file descriptors until the process runs out.

### Filtering

`ss` accepts filters, which matters on a machine with thousands of sockets:

```bash
$ ss -tn state established              # only established connections
$ ss -tlnp 'sport = :443'               # only what is listening on 443
$ ss -tn dst 192.0.2.5                  # only connections to one host
```

## `netstat` — the older command

**`netstat`** did this job before `ss`, and appears throughout older material. The flags are the same, so anything you know from `ss` transfers directly:

```bash
$ sudo netstat -tlnp
Proto Recv-Q Send-Q Local Address    Foreign Address  State   PID/Program name
tcp        0      0 0.0.0.0:9500     0.0.0.0:*        LISTEN  480/nc
```

The same sockets, the same information, laid out slightly differently.

Two reasons to reach for `ss` instead. `netstat` is **not installed by default** on current distributions — it comes from the `net-tools` package, alongside `ifconfig`. And it is slower: it reads socket information out of `/proc` one line at a time, while `ss` asks the kernel directly, which is noticeable on a machine holding thousands of connections.

## Finding what holds a port

When a port is taken and you need to know by what, `ss -tlnp` names the process.

**`lsof`** — the "list open files" command from the mounting page — answers the same question from the other direction. Since a socket is something a program holds open, `lsof` sees it as one more open file, and **`-i`** limits the output to network ones:

```bash
$ sudo lsof -i :9200
COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
nc       568 root    3u  IPv4  12345      0t0  TCP *:9200 (LISTEN)
```

Either is fine. The usual sequence when a service will not start because its port is in use: find the process, decide whether it should be there, and stop it — or change the port your service uses.