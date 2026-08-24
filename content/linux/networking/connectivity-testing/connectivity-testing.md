# Connectivity testing

## When something cannot be reached

A service cannot reach its database, a deployment fails, a site does not load. The addresses are configured and the machines are running, but traffic is not getting through.

The temptation is to start changing things. The better first step is to find out **how far the traffic actually gets**, because the answer is almost never a simple "it works" or "it does not". It is a specific point along the way where it stops, and knowing that point tells you what to fix — a service that has crashed and a firewall rule that drops packets look identical from the outside, and have nothing in common as problems.

This page covers four commands for finding that point. Each looks at a different part of the path, and the section for each explains where it fits.

## `ping` — is the machine reachable

**`ping` sends a small packet to an address and reports whether a reply comes back, and how long it took.**

It uses **ICMP** (Internet Control Message Protocol), a protocol the network uses to carry control and diagnostic messages rather than data. `ping` sends an ICMP *echo request*, and a machine receiving one normally answers with an *echo reply*.

**ICMP has no ports.** Ports belong to TCP and UDP, the protocols that carry data between programs, and they exist to say *which program* on a machine a packet is for — port 443 for the web server, 5432 for the database. ICMP is not addressed to a program at all; it is handled by the machine's network stack itself, so there is nothing to port-number and `ping` never takes one:

```bash
$ ping 127.0.0.1:80
ping: 127.0.0.1:80: Name or service not known
```

That single fact is the reason `ping` and `nc` answer different questions. `ping` reaches the machine as a whole. Reaching one particular service on it requires a protocol with ports, which is what `nc` uses.

```
ping [-c COUNT] [-W TIMEOUT] DESTINATION
```

Without `-c` it runs until interrupted with `Ctrl-C`.

```bash
$ ping -c 4 192.0.2.1
PING 192.0.2.1 (192.0.2.1) 56(84) bytes of data.
64 bytes from 192.0.2.1: icmp_seq=1 ttl=64 time=0.442 ms
64 bytes from 192.0.2.1: icmp_seq=2 ttl=64 time=0.342 ms
64 bytes from 192.0.2.1: icmp_seq=3 ttl=64 time=0.198 ms

--- 192.0.2.1 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2006ms
rtt min/avg/max/mdev = 0.198/0.327/0.442/0.100 ms
```

Reading the reply lines: **`icmp_seq`** numbers the packets, so a gap shows one was lost. **`time`** is the round trip — how long the packet took to get there and back, which is what people mean by latency.

**`ttl`** is a counter carried inside the packet. The sending machine sets it to a starting number — commonly 64 — and from then on **only routers change it**: every router that forwards the packet on towards another network subtracts one first. Switches do not, because they pass traffic along within a single network without examining this part of the packet.

If the counter ever reaches zero, the router throws the packet away instead of forwarding it. This exists to stop packets circling forever: if two routers were misconfigured to keep handing the same packet back and forth, the counter would run down and end it, rather than letting it loop until the network filled with traffic going nowhere.

`traceroute` puts this counter to a second use, shown below.

The summary is where the answer usually is. **Packet loss** is the number to look at: 0% is healthy, 100% means nothing came back, and anything in between is an intermittent problem, which is often worse than a clean failure because it produces slowness rather than errors.

### What a failure tells you

`ping` fails in three distinguishable ways.

**No replies at all.** The packets went out and nothing returned:

```bash
$ ping -c 2 192.0.2.99
PING 192.0.2.99 (192.0.2.99) 56(84) bytes of data.

--- 192.0.2.99 ping statistics ---
2 packets transmitted, 0 received, 100% packet loss, time 1002ms
```

The machine is off, the address is wrong, the route is broken — or the machine is fine and simply does not answer, which is the important caveat below.

**The name cannot be resolved.** The failure happened before any packet was sent:

```bash
$ ping -c 1 no-such-host.invalid
ping: no-such-host.invalid: Name or service not known
```

This is a DNS problem, not a connectivity problem. `ping` never got an address to send to. The next page covers DNS.

**An error comes back instead of a reply.** Here a router along the way answered, but only to say it had nowhere to send the packet:

```bash
$ ping -c 2 10.1.1.1
PING 10.1.1.1 (10.1.1.1) 56(84) bytes of data.
From 192.0.2.1 icmp_seq=1 Destination Host Unreachable
From 192.0.2.1 icmp_seq=2 Destination Host Unreachable

--- 10.1.1.1 ping statistics ---
2 packets transmitted, 0 received, +2 errors, 100% packet loss
```

Note the `From 192.0.2.1` — the reply came from the gateway, not the destination, and it is reporting a delivery failure rather than answering. `Network is unreachable` is the same kind of message and appears when your own machine has no route for that address at all.

### The caveat that matters

**A failed ping does not prove a machine is down.** ICMP is frequently blocked: many firewalls drop it, and most cloud providers block it by default, so a perfectly healthy server can be completely silent to `ping` while serving traffic normally.

The reverse is more reliable — a successful ping does prove the machine is up and the route works. So treat `ping` as good news when it succeeds, and as inconclusive when it fails. When it fails, test the actual service with `nc` before concluding anything.

### Working outward

`ping` is most useful run in sequence, each step widening the scope, so the first failure tells you where the problem lies:

```bash
$ ping -c 1 127.0.0.1        # 1. own network stack
$ ping -c 1 192.0.2.2        # 2. own interface
$ ping -c 1 192.0.2.1        # 3. the gateway — local network works
$ ping -c 1 8.8.8.8          # 4. the internet by address — routing works
$ ping -c 1 google.com       # 5. the internet by name — DNS works
```

Step 3 failing points at the local network. Step 4 failing with step 3 working points at routing or the internet connection. Step 5 failing with step 4 working is DNS, every time.

## `traceroute` — where the traffic goes

When a destination cannot be reached, the next question is how far the packets get.

A packet crossing the internet is not delivered in one step. It is passed from router to router, each one sending it a little closer, until it arrives. **Each of those steps — one router receiving the packet and passing it on — is called a hop.** A machine four routers away is four hops away.

**`traceroute` shows every hop a packet takes on its way to a destination, naming the router at each one and the time taken to reach it.**

It works by using the **TTL** counter described above, plus one detail not mentioned there: when a router throws a packet away because the counter reached zero, it sends a message back to the sender to report it — and that message reveals which router did it.

`traceroute` turns that into a map of the path. It sends a packet with the counter set to 1, so the very first router subtracts one, gets zero, discards it, and reports back. Then a packet set to 2, which dies at the second router. Then 3, and so on. Each packet travels one hop further than the last before being dropped, and every router along the route names itself in turn.

```
traceroute [-n] [-m MAX_HOPS] DESTINATION
```

**`-n`** skips reverse DNS lookups, which makes it much faster and is worth using by default.

```bash
$ traceroute -n 10.255.255.1
traceroute to 10.255.255.1 (10.255.255.1), 30 hops max, 60 byte packets
 1  192.0.2.1  3.138 ms  3.042 ms  3.028 ms
 2  21.4.0.63  3.022 ms  3.015 ms  3.008 ms
 3  * * *
```

Each numbered line is one hop, naming the router that answered from that position along the path.

The three times on each line come from three separate test packets, sent so that a router giving uneven results shows it.

The first hop is always your own gateway — the first router your traffic reaches. From there the path runs out through your provider's network and onward.

**`* * *` means no reply from that hop.** This does not necessarily indicate a fault: many routers are configured not to answer these probes, so a few starred lines in the middle of an otherwise complete path are normal. What matters is where the stars begin and whether they continue: a path that reaches hop 7 and then shows nothing but stars to the end has stopped there, and hop 7 is where to look.

Reading a traceroute is mostly about noticing the *change* — where the path stops, or where the times jump sharply and stay high. A jump from 20 ms to 150 ms that persists marks the point where the delay is introduced.

## `mtr` — traceroute, continuously

A single traceroute is one quick look. A fault that comes and goes — a router losing some packets, a link that only struggles when busy — can easily be missed by it, because the moment you happened to test may have been a good one.

**`mtr` combines `ping` and `traceroute`: it traces the path and then keeps testing every hop along it, reporting loss and latency for each.**

```
mtr [-r] [-c COUNT] [-n] DESTINATION
```

Run plainly, it opens a live display that updates continuously. **`-r`** produces a fixed report instead, which is what you paste into a ticket:

```bash
$ mtr -r -c 3 -n 192.0.2.1
Start: 2026-08-02T02:19:28+0000
HOST: vm                          Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 192.0.2.1                  0.0%     3    0.3   0.3   0.2   0.4   0.1
```

The columns per hop: **`Loss%`** is the share of probes that got no reply, **`Snt`** how many were sent, and **`Last`/`Avg`/`Best`/`Wrst`** the most recent, mean, minimum, and maximum times. **`StDev`** shows how much the times vary — a high value means erratic performance even if the average looks acceptable.

Loss shown at one hop in the middle, with none at the hops after it, is not a real fault. That router is just answering test packets slowly while passing normal traffic through perfectly well. Genuine loss appears at a hop **and at every hop beyond it**, because those packets never got through to be counted.

This is the tool for the vague complaints — "it is slow sometimes", "connections drop now and then". A single test proves nothing about those, while a few minutes of `mtr` shows whether packets are being lost and at which hop.

## `nc` — is the service accepting connections

`ping` tests a machine. A machine being up says nothing about whether the service you need is running and reachable: a web server can be perfectly pingable with its application crashed, or its port blocked by a firewall.

**`nc` (netcat) opens a TCP or UDP connection to a given address and port, and can send and receive data over it.**

```
nc [-z] [-v] [-u] [-w SECONDS] HOST PORT
```

| Flag | Meaning |
|---|---|
| `-z` | test only — connect and close, sending no data |
| `-v` | verbose — report the outcome |
| `-w N` | give up after N seconds |
| `-u` | use UDP instead of TCP |
| `-l` | listen for a connection rather than making one |

### Testing a port

`-zv` is the everyday form. A service that is listening accepts the connection:

```bash
$ nc -zv 127.0.0.1 9099
Connection to 127.0.0.1 9099 port [tcp/*] succeeded!
```

Nothing listening produces an immediate refusal:

```bash
$ nc -zv 127.0.0.1 9098
nc: connect to 127.0.0.1 port 9098 (tcp) failed: Connection refused
```

Those two outcomes are informative, and a third is equally so:

| Outcome | Meaning |
|---|---|
| **succeeded** | a service is listening and accepted the connection |
| **Connection refused** | the machine answered, but nothing is listening on that port — usually the service is stopped or bound to a different address |
| **timeout — no answer at all** | something is silently discarding the packets, almost always a firewall |

The difference between *refused* and *timed out* is the most useful thing on this page, because each points somewhere completely different.

**Refused** means the packet arrived and the machine actively answered "nothing is listening there". The network worked perfectly. What is wrong is on the machine itself: the service is stopped or crashed, or it is running but listening on a different port, or it is bound only to `127.0.0.1` and so refuses connections from outside. All of those are fixed on the server, not in the network.

**Timed out** means no answer came at all. Something between you and the machine dropped the packet without a word, which is what a firewall does — a rule on the server, a cloud security group, or a device in between. Nothing on the machine is at fault until traffic can reach it.

So the same failure to connect sends you to two different places, and `nc` tells you which in about a second.

Several ports can be checked at once by giving a range:

```bash
$ nc -zv -w 1 127.0.0.1 9095-9100
```

### Moving data

`nc` is not only a tester; it connects two ends and passes data between them. With **`-l`** it listens, and another `nc` connects to it:

```bash
# on one machine — listen and write what arrives to a file
$ nc -l 9105 > received.txt

# on another — send
$ echo "hello over TCP" | nc 192.0.2.2 9105
```

```bash
$ cat received.txt
hello over TCP
```

This makes it useful for checking that a path works end to end when nothing is deployed yet: start a listener on the port your service will use, connect from the client machine, and confirm the firewall rules are right before the application exists.

It can also talk to real services. Many of the older internet protocols are plain text, and a server using one will introduce itself the moment you connect. Mail servers are the clearest example — connecting to a mail server on its normal port, 25, it announces itself before you have typed anything:

```bash
$ nc smtp.example.com 25
220 smtp.example.com ESMTP ready
```

That first line is called a **banner**: a greeting the service sends to say what it is and that it is ready. Here `220` is the protocol's code for "ready", and `ESMTP` names the mail protocol being spoken.

This tells you more than `nc -zv` would. `-zv` only proves that something accepted a connection on port 25; the banner proves that a *mail server* is behind it, and that it is working well enough to respond. When a port is open but the service behaves strangely, connecting like this and reading the greeting is often the quickest way to see what is actually there.

## Putting them in order

For an unreachable service, the sequence narrows the fault quickly:

1. **`ping` the machine** — if it replies, the machine and route are fine. If not, remember ICMP may simply be blocked.
2. **`nc -zv` the port** — *refused* means the network works and the service does not; *timed out* means a firewall is in the way; *succeeded* means the service is fine and the fault is above the network, in the application or its configuration.
3. **`traceroute`** if traffic is not arriving at all, to find where it stops.
4. **`mtr`** if the connection works but behaves badly, to find which hop is losing packets.