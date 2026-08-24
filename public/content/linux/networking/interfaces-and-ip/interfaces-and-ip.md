# Interfaces and IP

## Interfaces

To join a network, a machine needs hardware for it: a **network card**, the component with the socket you plug a network cable into — the flat-clipped Ethernet cable that carries data, not the power cable. Wireless cards do the same job without a cable.

The card on its own cannot be used. It moves signals on the wire and nothing more: it has no name, no address, and no settings. Programs need something they can point at, configure, and send data through, and the kernel provides it.

**A network interface is a named software object in the kernel that represents one network connection and holds its configuration.**

Each part of that:

- **named** — it has a name, like `eth0`, which programs and commands use to refer to it.
- **software object in the kernel** — it exists in software. The card is hardware; the interface is the kernel's representation of a connection.
- **represents one network connection** — one interface per connection.
- **holds its configuration** — its IP address, whether it is switched on, and how it behaves.

All traffic entering or leaving the machine passes through one.

The kernel creates these at boot. It lists the hardware installed in the machine, and for each card it loads a **driver** — code inside the kernel that knows how to operate that particular model. The driver then creates an interface to represent the card and gives it a name. One card, one interface, listed like this:

```bash
$ ls /sys/class/net/
eth0  lo
```

From that point the card is never handled directly. Configuration is applied to `eth0`, and the driver translates it into whatever the hardware needs.

## Interfaces without hardware

An interface represents a connection, and a connection need not run over a card. The kernel can create an interface entirely in software, and three kinds are common.

**Loopback (`lo`)** is on every machine. It connects the machine to itself: traffic sent to it travels down through the network system and comes straight back up, never reaching a card or a cable.

It exists because programs communicate over the network even when they sit on the same machine. A web application connecting to its database at `127.0.0.1` uses ordinary network code, and loopback makes that work with no network attached. It is also the reason a service configured to listen on `localhost` is reachable by programs on that machine and by nothing else — nothing outside has a path to it.

**Containers and virtual machines** each get an interface created in software by the runtime that started them. It is connected to something: the runtime attaches it to a virtual switch on the host, and that switch forwards traffic out through the host's real card. The interface is entirely real from inside the container, and its traffic reaches the world through hardware the container does not own.

**VPNs** create an interface too, commonly named `tun0`. Traffic sent to it is not placed on a wire. The VPN program collects it, encrypts it, and sends it out through the ordinary interface to the VPN server, which unwraps it at the far end.

In all three the pattern is the same: the interface is where traffic is handed over, and something behind it — a driver and a card, a virtual switch, or a program — decides what happens next.

## Interface names

| Name | What it is |
|---|---|
| `lo` | loopback — the machine talking to itself |
| `eth0` | ethernet, old naming — still normal in containers and VMs |
| `enp0s3` | ethernet, new naming |
| `wlp2s0` | wireless, new naming |

The old scheme numbered cards in the order they were found — `eth0`, `eth1` — and that was its weakness. Adding or removing a card changed the order, so `eth0` could come back as `eth1` after a reboot and take a working configuration down with it.

The new names are built from the card's physical position, so they never move. `enp0s3` reads as **e**thernet, **p**CI bus **0**, **s**lot **3**. PCI is the internal bus that expansion cards plug into, the standard connection inside a computer for components such as network and graphics cards.

## IP addresses

An interface needs an address before anything can be sent to it.

Everything in this section describes **IPv4**, the version in use since 1983 and still the one you will meet on almost every machine. A newer version, **IPv6**, exists for a reason covered at the end of this page; until then, "IP address" means an IPv4 address.

**An IP address is a 32-bit number identifying one network interface, so that data can be delivered to it.**

"IP" stands for **Internet Protocol** — the rules for how data is addressed and delivered between machines. An IP address is the kind of address those rules use.

It is written as four decimal numbers, each 0–255, separated by dots, which is a readable way of writing the 32 bits:

```
192.0.2.2

as four numbers:  192  .  0  .  2  .  2         each 0-255
as bits:      11000000.00000000.00000010.00000010     32 bits
```

The address belongs to the interface rather than the machine. A machine with two cards has two interfaces and normally two addresses. One interface can also hold several addresses at once — a single server answering on two of them can host two sites that each need their own, and moving a service to a new address is done by adding it before removing the old one.

The `ip` command displays them, and is covered in full further down:

```bash
$ ip -br addr
lo               UNKNOWN        127.0.0.1/8
eth0             UP             192.0.2.2/24
```

Each line is one interface, giving its name, its state, and its address. The second line therefore says the interface `eth0` is up and holds the address `192.0.2.2`, followed by `/24` — which is part of the address and means something specific.

## Networks and the prefix

Machines are not wired to each other one by one. They are grouped, and the group is what `/24` describes.

A **network** is a set of machines connected so that they can reach each other directly, with nothing in between. In an office this is usually the machines plugged into one **switch** — a box with many sockets that forwards a message arriving on one port out to the machine it is addressed to. On home Wi-Fi it is the devices attached to one access point.

Reaching a machine on a different network requires a **router**: a device connected to two or more networks that passes traffic between them.

A machine sending a packet must therefore decide between two actions. If the destination is on its own network, it sends the packet **directly** — onto the local wire, addressed to that machine, arriving without any device examining or forwarding it. If the destination is elsewhere, it sends the packet to the router instead, and the router takes responsibility for moving it onward.

The `/24` is what makes that decision possible. An IP address carries two pieces of information at once — which network, and which machine on it — and the number after the slash marks the boundary between them. It is called the **prefix length**: the count of bits, from the left, that form the network part.

```
192.0.2.2/24        the first 24 bits are the network, the last 8 are the machine

network part  11000000.00000000.00000010          = 192.0.2
machine part                            00000010  = .2
```

Every machine on that network shares `192.0.2` and differs only in the final number. The sending machine compares the network part of the destination with its own, and the result of that comparison is the decision above:

```
192.168.1.10  →  192.168.1.50     first three match  →  same network  →  sent directly
192.168.1.10  →  192.168.2.50     they differ        →  another network →  sent to the router
```

### What the prefix length means

A smaller prefix leaves fewer bits for the network and more for machines, so the network holds more of them:

| Prefix | Network part | Machines it can hold |
|---|---|---|
| `/8` | first number | 16,777,214 |
| `/16` | first two | 65,534 |
| `/24` | first three | 254 |
| `/32` | all 32 bits | 1 — one exact address |

`/24` is the most common, because the boundary falls neatly on a dot.

### Addresses reserved inside a network

Those totals are two short of the full count, because two addresses in a network are not available to machines. In `192.168.1.0/24` there are 256 addresses and 254 usable:

| Address | Role |
|---|---|
| `192.168.1.0` | the **network address** — names the network itself |
| `192.168.1.255` | the **broadcast address** — a packet sent here goes to every machine on the network |
| `192.168.1.1` – `192.168.1.254` | available to machines |

Two exceptions exist, both for small special-purpose networks. A **`/31`** has just two addresses and reserves neither, since it is used for a direct link between two routers where a broadcast address would be pointless. A **`/32`** is a single address and reserves nothing.

Separately, there is a convention rather than a rule: the router is usually given the first usable address, `192.168.1.1`, which is why that address is familiar from home routers.

## Reserved IP address ranges

Beyond the addresses reserved inside each network, whole ranges are set aside and never used as ordinary public addresses:

| Range | Used for |
|---|---|
| `10.0.0.0/8` | **private** — large networks, cloud VPCs |
| `172.16.0.0/12` | **private** — Docker's default |
| `192.168.0.0/16` | **private** — home and office networks |
| `127.0.0.0/8` | loopback — the whole range, not only `127.0.0.1` |
| `169.254.0.0/16` | link-local — an address a machine gives itself when no address is issued to it |
| `100.64.0.0/10` | shared space used inside ISP networks |
| `224.0.0.0/4` | multicast — one sender, many receivers at once |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | documentation only — the addresses used in examples, including on this page |

Two are worth recognising on sight. An interface holding a **`169.254.x.x`** address requested one and received no answer, so it invented its own, which nearly always means the network is broken. And **`169.254.169.254`** is the address cloud instances use to fetch information about themselves.

## Private addresses

The first three ranges in that table deserve their own explanation, because they behave differently from every other address.

There are about 4.3 billion IPv4 addresses and far more devices than that, so they cannot all have one. The private ranges are the answer: they may be used by anyone, inside their own network, as many times as they like. Millions of separate homes are using `192.168.1.1` at this moment, each meaning a different device, and none of them conflict — because each is only meaningful inside its own network.

That reuse is exactly why they cannot travel the internet. A router on the public internet receiving a packet addressed to `192.168.1.5` has no way to know which of the millions is meant, so such packets are not carried at all.

Which leaves a problem: a machine with only a private address cannot be reached from the internet, and packets it sends have a source address no reply could come back to. NAT is what resolves it.

## NAT

**NAT (Network Address Translation) is a technique for rewriting the IP addresses inside packets as they pass through a device, so that machines using one set of addresses can communicate through another.**

Routers are where it is most often performed — every home router does it — but not the only place. Firewalls, load balancers, cloud gateways, and any Linux machine configured to forward traffic can all perform NAT.

In the common case it works like this. A machine on the private network sends a packet out. The router replaces the private source address with its own public address, records the substitution, and forwards the packet. The reply arrives addressed to the router's public address; the router consults its record, puts the private address back, and delivers it inside.

The result is that a whole household or office shares one public address while every machine keeps a private one.

The practical consequence is that **the address on your interface is usually not the address the outside world sees**:

- the **local address** is what `ip addr` shows, meaningful on your own network.
- the **public address** belongs to the router, and is what a remote server records.

Learning the public one requires asking something outside the network. `curl` is a command that fetches a web page and prints it, covered later in this chapter, and some sites reply with nothing but the address they saw:

```bash
$ curl -s https://api.ipify.org
203.0.113.45
```

Cloud instances behave the same way: `ip addr` shows a private address, and the provider maps a public one to it. Not finding the public address on the interface is expected rather than a fault.

## The `ip` command

Confusingly, the command for managing addresses is also called **`ip`**. The protocol is Internet Protocol; the command is a tool named after it. From here, `ip` in a code block means the command.

It takes an **object** — the kind of thing you want to work with — then what to do with it:

```
ip [-4|-6] [-br] OBJECT COMMAND
```

Three objects cover this page, and they answer three separate questions:

| Object | The question it answers |
|---|---|
| `ip link` | Does the interface exist, and is it working? |
| `ip addr` | What addresses does it have? |
| `ip route` | Where does traffic get sent? |

**`-br`** (brief) prints one short line per interface. **`-4`** or **`-6`** limits output to IPv4 or IPv6.

### `ip addr` — the addresses

```bash
$ ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN
    link/loopback 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1400 state UP
    link/ether 02:fc:00:00:00:01
    inet 192.0.2.2/24 brd 192.0.2.255 scope global eth0
```

What to read:

- **`inet`** — the IPv4 address and prefix. Usually the line you came for.
- **`link/ether`** — the **MAC address**, a number burned into the card that identifies it on the local network. An IP address can be changed; this one belongs to the hardware.
- **`mtu`** — the largest packet this interface will send, in bytes.
- **`state UP`** — the interface is working.

The brief form when you only want addresses:

```bash
$ ip -br addr
lo               UNKNOWN        127.0.0.1/8
eth0             UP             192.0.2.2/24
```

And shorter still:

```bash
$ hostname -I
192.0.2.2
```

### `ip link` — the interfaces themselves

`ip link` shows interfaces without their IP addresses. Use it when the question is whether an interface is up, not what address it holds.

```bash
$ ip link
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1400 state UP
```

Two flags in the angle brackets mean different things, and telling them apart is how you diagnose a dead connection:

- **`UP`** — someone enabled the interface. It is switched on.
- **`LOWER_UP`** — there is a live link. A cable is plugged in and the other end is alive.

`UP` without `LOWER_UP` means the interface is configured and enabled but nothing is connected — an unplugged cable, or a dead port on the switch.

Turning an interface on and off needs root:

```bash
$ sudo ip link set eth0 up
$ sudo ip link set eth0 down
```

### `ip route` — where traffic goes

An address is not enough on its own. The machine also has to know where to send each packet.

```bash
$ ip route
default via 192.0.2.1 dev eth0
192.0.2.0/24 dev eth0 proto kernel scope link src 192.0.2.2
```

Both lines matter:

- **`192.0.2.0/24 dev eth0`** — anything on this network is reachable directly through `eth0`, no router needed. The kernel adds this by itself when the address is assigned.
- **`default via 192.0.2.1`** — everything else goes to `192.0.2.1`, the **default gateway** (the router). Without this line the machine can reach its own network and nothing else.

That second line is worth remembering, because it maps to a specific symptom: *"local machines work, the internet does not"* is nearly always a missing or wrong default route.

### Changing an address

```bash
$ sudo ip addr add 10.99.0.5/24 dev eth0
$ ip -br addr show eth0
eth0             UP             192.0.2.2/24 10.99.0.5/24

$ sudo ip addr del 10.99.0.5/24 dev eth0
```

Note that the interface now holds two addresses at once. This is normal, and there are three situations where it is done deliberately:

- **Hosting several services that each need their own address.** Two websites requiring separate TLS certificates, or two applications that both insist on port 443, can be given one address each on the same interface and one machine serves both.
- **Changing a machine's address without downtime.** Add the new address, move traffic and DNS to it while both work, then remove the old one. Replacing the address in a single step would cut off every connection using it.
- **Taking over an address during failover.** A standby server can add the address of a failed primary to its own interface and begin answering traffic sent to it, without anything on the network being reconfigured.

**These changes disappear at reboot.** `ip` changes what the kernel is doing right now and writes nothing to disk. That is ideal for testing and a trap if you expected it to stick. Permanent configuration is done elsewhere — `netplan` on Ubuntu, NetworkManager on RHEL and most desktops.

## `ifconfig` — the old command

**`ifconfig`** did what `ip` does now, and fills older documentation.

```bash
$ ifconfig
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1400
        inet 192.0.2.2  netmask 255.255.255.0
```

It is **no longer installed by default**:

```bash
$ ifconfig
Command 'ifconfig' not found, but can be installed with:
apt install net-tools
```

It is also not simply an older style. It cannot show several addresses on one interface, network namespaces, or policy routing — so on a modern system its output can be quietly incomplete, which is worse than being out of date.

Recognise it in old guides, and translate:

| `ifconfig` | `ip` |
|---|---|
| `ifconfig` | `ip addr` |
| `ifconfig eth0` | `ip addr show eth0` |
| `ifconfig eth0 up` | `ip link set eth0 up` |
| `ifconfig eth0 192.168.1.5` | `ip addr add 192.168.1.5/24 dev eth0` |
| `route -n` | `ip route` |

## IPv6

Everything above describes IPv4, whose addresses are 32 bits — about 4.3 billion of them. That was ample in 1983 and ran out decades ago, which is why private addresses and NAT exist: they are workarounds for a shortage.

**IPv6 is the newer version of the Internet Protocol, using 128-bit addresses instead of 32-bit ones.**

The change in size is difficult to picture. IPv4 offers roughly 4×10⁹ addresses; IPv6 offers about 3.4×10³⁸ — enough that every device can have a public address permanently, with no reuse and no shortage.

### How the addresses are written

Eight groups of four hexadecimal digits, separated by colons:

```
2001:0db8:85a3:0000:0000:8a2e:0370:7334
```

Two rules shorten them, and both are used in practice:

- leading zeros in a group are dropped: `0db8` becomes `db8`
- one run of all-zero groups is replaced by `::`

```
2001:0db8:85a3:0000:0000:8a2e:0370:7334      full
2001:db8:85a3::8a2e:370:7334                 same address, written normally
```

`::` may appear only once in an address, because more than one would leave the length ambiguous.

The prefix works exactly as in IPv4, with the same slash notation — `/64` is the standard size for a single network, leaving 64 bits for machines within it.

### The familiar addresses

Each IPv4 special case has an IPv6 counterpart:

| Purpose | IPv4 | IPv6 |
|---|---|---|
| Loopback | `127.0.0.1` | `::1` |
| Link-local (self-assigned) | `169.254.0.0/16` | `fe80::/10` |
| Private / internal | `10.0.0.0/8` and others | `fc00::/7` |
| Documentation | `192.0.2.0/24` | `2001:db8::/32` |

### In practice

The two versions run side by side. Most machines have both, which is called **dual-stack**: an IPv4 address for the majority of the internet, and an IPv6 address for the parts that support it.

The commands are the same ones already covered, with `-6` to select IPv6:

```bash
$ ip -6 addr
$ ip -6 route
```

Two differences are worth knowing. **NAT is largely unnecessary** with IPv6, since there is no address shortage to work around and every machine can hold a public address directly. And a firewall matters more as a result: an IPv6 address is often reachable from the internet without the accidental barrier that NAT provided.

IPv4 remains what you will configure and debug most often, and is what the rest of this chapter uses. IPv6 appears increasingly in cloud environments and mobile networks, and is worth recognising when it does.