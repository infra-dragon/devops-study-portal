# DNS

## Names and addresses

Machines are reached by IP address, but nobody types `104.20.23.154` to visit a website. Names are used instead, and something has to turn one into the other before any traffic can be sent.

**DNS (Domain Name System) is the system that translates names into IP addresses.** It is a distributed database spread across many servers worldwide, holding the records that say which address a name currently points to.

The translation is called **resolution**, and it happens before a connection is made. When a program is given `example.com`, it first asks for the address, receives one, and only then sends anything to it. This is why a name failing to resolve produces a failure that looks like a network problem but is not: nothing was ever sent, because there was no address to send it to.

A single fact explains most DNS confusion: **names are not resolved by DNS alone.** The machine has a resolution order, and DNS is only part of it.

## How a name is resolved

When a program asks for the address of `example.com`, the system works through sources in a fixed order and stops at the first answer.

That order is set in **`/etc/nsswitch.conf`** (name service switch), the file that tells the system where to look up various kinds of information — users, groups, and among them, hostnames. The relevant line is `hosts`:

```bash
$ grep '^hosts' /etc/nsswitch.conf
hosts:          files dns
```

Read left to right, this says: try **`files`** first, meaning the local file `/etc/hosts`; if there is no match, try **`dns`**, meaning ask a DNS server.

So the full sequence is:

1. **`/etc/hosts`** — a local file of name-to-address entries. If the name is here, resolution stops, and no DNS server is contacted.
2. **A DNS server** — whichever is listed in `/etc/resolv.conf`, asked over the network.

The order matters more than it appears, because it means a local file silently outranks the entire global DNS system for that name.

## `/etc/hosts` — the local list, checked first

**`/etc/hosts`** is a plain text file mapping addresses to names, checked before DNS. Each line is an address followed by one or more names:

```bash
$ cat /etc/hosts
127.0.0.1 localhost
160.79.104.10 api.anthropic.com
127.0.0.1 vm
```

It requires no server and no network, which is what makes it useful:

- **Pointing a name somewhere else during development** — sending `api.example.com` to a machine on your desk while leaving the real DNS record untouched.
- **Naming machines on a small network** without running a DNS server.
- **Blocking a name** by pointing it at `127.0.0.1`, so requests to it go nowhere.

The line `127.0.0.1 localhost` is why `localhost` works everywhere: it is not a DNS name at all, just an entry in this file.

### An entry here ends the search

Because this file is read first, a name listed in it is answered from here and the lookup stops. No DNS server is contacted, not because the file overrules the answer DNS would have given, but because DNS is never reached — the search finished at step one.

Adding a single line is enough:

```bash
$ echo "203.0.113.99 example.com" >> /etc/hosts
$ ping -c1 example.com
PING example.com (203.0.113.99) 56(84) bytes of data.
```

Every ordinary program on this machine now reaches `203.0.113.99` for that name, while every other machine still gets the real address from DNS. Nothing announces this. A line added months ago behaves exactly like a line added a minute ago, so when one machine disagrees with all the others about where a name points, this file is the first thing to read.

## `/etc/resolv.conf` — which DNS server to ask

When the answer is not in `/etc/hosts`, the system asks a DNS server. **`/etc/resolv.conf`** is the file naming which servers to ask.

```bash
$ cat /etc/resolv.conf
nameserver 8.8.8.8
```

Three directives appear in it:

| Directive | Meaning |
|---|---|
| `nameserver` | the address of a DNS server to query. Up to three may be listed, tried in order |
| `search` | domains to append to a bare name — with `search example.com`, asking for `web` also tries `web.example.com` |
| `options` | settings such as `timeout:2` and `attempts:1` |

Extra `nameserver` lines are a fallback: the second is used only after the first fails to answer, and waiting for that failure takes a timeout every time. So a dead first entry does not break name resolution, it makes every lookup slow — a useful thing to recognise, because slowness is a stranger symptom than an outright failure.

**This file is usually generated, not hand-written.** Several things rewrite it, so edits are commonly overwritten at the next reboot or network change.

The most common is **DHCP** (Dynamic Host Configuration Protocol): rather than typing in an address, gateway, and DNS servers by hand, a machine joining a network broadcasts a request and a DHCP server replies with all of them. This is how nearly every home and office machine is configured, and the DNS servers it hands out are written into `/etc/resolv.conf` automatically. `systemd-resolved` and NetworkManager rewrite it too. On systems using `systemd-resolved` it contains `nameserver 127.0.0.53`, a local service that forwards queries onward; the real servers are shown by `resolvectl status`.

## `dig` — query DNS directly

**`dig` sends a query to a DNS server and prints the reply.**

```
dig [@SERVER] [+short] [TYPE] NAME
```

Its important property is that it queries DNS *directly*, ignoring `/etc/nsswitch.conf` and `/etc/hosts` entirely. It shows what DNS says, not what this machine will do — a distinction returned to below.

```bash
$ dig example.com

; <<>> DiG 9.18.39 <<>> example.com
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 18040
;; flags: qr rd ra ad; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; QUESTION SECTION:
;example.com.			IN	A

;; ANSWER SECTION:
example.com.		300	IN	A	104.20.23.154
example.com.		300	IN	A	172.66.147.243

;; Query time: 28 msec
;; SERVER: 8.8.8.8#53(8.8.8.8) (UDP)
```

The parts worth reading:

- **`status: NOERROR`** — the query succeeded. `NXDOMAIN` means the name does not exist.
- **QUESTION SECTION** — what was asked: the name, and `A` for an address record.
- **ANSWER SECTION** — the result. Two addresses here, both valid; the `300` is the **TTL** in seconds, explained below.
- **`SERVER`** — which DNS server replied, taken from `/etc/resolv.conf`.
- **`Query time`** — how long it took, useful when lookups feel slow.

**`+short`** removes everything but the answer, which is what you want most of the time:

```bash
$ dig +short example.com
104.20.23.154
172.66.147.243
```

### Record types

DNS stores several kinds of record, and a name can have many. The type is given before the name:

| Type | Holds |
|---|---|
| `A` | an IPv4 address — the default |
| `AAAA` | an IPv6 address |
| `MX` | the mail servers for the domain — where to deliver mail addressed to it |
| `NS` | the DNS servers holding this domain's real records |
| `TXT` | free text, put there by the domain's owner for other systems to read |
| `CNAME` | an alias pointing at another name |
| `PTR` | a name for an address — reverse lookup |

Two of those need a word.

**`NS`** records name the DNS servers that hold the domain's original records. Every other server that answers for it is repeating a copy, which may be out of date; these servers hold the real thing, and are described as **authoritative** for that domain. When a change has been made and some places still show the old value, asking one of these directly shows what the record now actually is.

```bash
$ dig +short NS example.com
hera.ns.cloudflare.com.
elliott.ns.cloudflare.com.
```

**`TXT`** records hold whatever text the domain's owner puts there, and exist because only that owner can add one. That makes them a way of proving control of a domain: a service asks you to publish a specific string, then checks that it is there. The same mechanism carries mail rules — `v=spf1` below is an SPF record, stating which servers are allowed to send mail claiming to be from this domain, so that receiving servers can reject forgeries.

```bash
$ dig +short TXT example.com
"v=spf1 -all"
```

```bash
$ dig +short AAAA example.com
2606:4700:10::ac42:93f3
```

**`-x`** performs a reverse lookup, turning an address back into a name:

```bash
$ dig +short -x 8.8.8.8
dns.google.
```

### Asking a specific server

**`@SERVER`** sends the query to a named server instead of the one in `/etc/resolv.conf`:

```bash
$ dig @1.1.1.1 +short example.com
104.20.23.154
```

This is how you separate "the record is wrong" from "our DNS server is wrong". If a public server returns the correct answer and yours does not, the record is fine and your server is at fault — usually holding a stale cached copy.

### TTL and caching

The number in each answer — `300` above — is the record's **TTL** (time to live), in seconds. It is how long the answer may be cached before being asked for again.

Caching happens at several levels: the program, the machine's resolver, and the DNS servers between you and the source. The TTL is what makes DNS changes take time to appear: after updating a record, anyone holding a cached copy keeps using the old address until their copy expires.

This is why lowering a record's TTL *before* a planned change is standard practice. Drop it to 60 seconds a day ahead, make the change, and the old answer expires within a minute instead of hours.

Repeating a `dig` shows the effect — the TTL counts down between queries, and resets when a fresh copy is fetched.

## `host` and `nslookup`

Two other commands query DNS in the same way `dig` does, and appear often enough to be worth recognising.

**`host`** is a short, readable lookup:

```bash
$ host example.com
example.com has address 172.66.147.243
example.com has address 104.20.23.154
example.com has IPv6 address 2606:4700:10::6814:179a
```

It gives plain sentences with no sections to read, which suits a quick check. Reverse lookups need no flag — `host 8.8.8.8` works directly.

**`nslookup`** is the oldest of the three and appears throughout older documentation:

```bash
$ nslookup example.com
Server:		8.8.8.8
Address:	8.8.8.8#53

Non-authoritative answer:
Name:	example.com
Address: 104.20.23.154
```

*Non-authoritative* means the answer came from a cache or a forwarding server rather than from the domain's own name server — normal, not a problem.

For anything beyond a quick lookup, prefer `dig`: it shows the full reply including status codes and TTLs, and its output is easier to use in scripts.

## The trap: `dig` works but the application does not

`dig` bypasses `/etc/hosts` and `/etc/nsswitch.conf`. Programs do not — they use the system resolver, which follows the order in `nsswitch.conf` and reads `/etc/hosts` first.

So the two can disagree, and it looks baffling until you know why:

```bash
$ dig +short example.com          # asks DNS directly
104.20.23.154

$ ping -c1 example.com            # uses the system resolver
PING example.com (203.0.113.99)   # a different address entirely
```

Both are correct. `dig` reported what DNS says; `ping` reported what this machine does, having found an entry in `/etc/hosts` and stopped there.

**`getent hosts`** resolves a name the same way an ordinary program would, which makes it the right tool when the two disagree:

```bash
$ getent hosts example.com
```

The rule to remember: **`dig` shows what DNS says, `getent hosts` shows what your machine will actually do.** When an application cannot reach a host that `dig` resolves perfectly, compare the two, and check `/etc/hosts` first.

### Which source gave the answer

Since the answer can come from either `/etc/hosts` or a DNS server, it is worth knowing which tool can tell you.

**`dig`, `host`, and `nslookup` never read `/etc/hosts` at all.** They speak to a DNS server and nothing else, so anything they return came from DNS by definition. The proof is a name that exists only in the local file:

```bash
$ grep testname /etc/hosts
203.0.113.99 testname.example

$ dig +short testname.example        # no output
$ host testname.example
Host testname.example not found: 3(NXDOMAIN)

$ getent hosts testname.example
203.0.113.99    testname.example
```

The DNS tools report the name as non-existent while the machine resolves it perfectly well — because the entry is in a file they do not consult.

**Which DNS server answered** is shown by `dig` and `nslookup` without asking:

```bash
$ dig example.com | grep SERVER
;; SERVER: 8.8.8.8#53(8.8.8.8) (UDP)

$ nslookup example.com | head -2
Server:		8.8.8.8
Address:	8.8.8.8#53
```

`host` hides this by default; **`-v`** reveals it:

```bash
$ host -v example.com | grep Received
Received 61 bytes from 8.8.8.8#53 in 16 ms
```

**`getent hosts` does not report its source.** It follows the same order an application does and prints only the result, so it answers "what will my program get" but not "where did that come from". When the two disagree, the source is `/etc/hosts` — that being the only step ahead of DNS in the order.