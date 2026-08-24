# Firewall

## What a firewall is

**A firewall is a filter that examines each packet arriving at or leaving a machine and decides whether to let it through.**

On Linux that decision is made by the kernel, before the packet reaches any program. A blocked packet never arrives at the service at all, which is why a firewalled port behaves differently from a closed one: a closed port answers with an immediate *connection refused*, while a firewalled port stays silent and the sender waits for a timeout.

It exists because a listening service accepts connections from anyone who can reach it, and that is usually more than you want — a database should be reachable by the application servers and nothing else.

## The layers

**netfilter is the packet filtering framework built into the Linux kernel.** You never run it; it is the part of the kernel that inspects packets and applies rules. Everything else is a way of telling it what to do:

```
   ufw / firewall-cmd   →   iptables   →   netfilter
      what you type        the rules      the kernel
```

`iptables` writes rules directly. `ufw` and `firewalld` are front ends that turn short commands into the detailed rules below — which is why enabling `ufw` with four rules creates dozens of `iptables` entries.

Use the front end your distribution ships, and do not mix them:

| Distribution | Front end |
|---|---|
| Ubuntu, Debian | `ufw` |
| RHEL, CentOS, Fedora | `firewalld` |

## `ufw`

**`ufw` (Uncomplicated Firewall) is a front end for iptables that makes ordinary rules short to write.**

```
ufw [enable|disable|status|reset]
ufw allow|deny RULE
```

```bash
$ sudo ufw allow 22/tcp
$ sudo ufw allow 443/tcp
$ sudo ufw allow from 192.168.1.0/24 to any port 5432
$ sudo ufw deny 23
```

Two ports open to everyone, a database open only to one network, one port closed.

Rules can be added while `ufw` is inactive; they take effect when it is switched on:

```bash
$ sudo ufw enable
Firewall is active and enabled on system startup
```

**Allow SSH before enabling it on a remote machine.** The default denies all incoming traffic, so enabling it without an SSH rule ends your session and locks you out.

```bash
$ sudo ufw status verbose
Status: active
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
5432                       ALLOW IN    192.168.1.0/24
23                         DENY IN     Anywhere
```

The **`Default:`** line matters most: nothing gets in unless a rule permits it, while the machine can still reach out.

Delete by number, or start over with `ufw reset`:

```bash
$ sudo ufw status numbered
[ 1] 22/tcp            ALLOW IN    Anywhere
[ 2] 443/tcp           ALLOW IN    Anywhere

$ sudo ufw delete 2
```

## `firewalld`

**`firewalld` is the front end used on RHEL, CentOS, and Fedora.** It organises rules into **zones** — named sets of rules, with each interface assigned to one, so a laptop can apply stricter rules on an untrusted network than in the office.

```bash
$ sudo firewall-cmd --list-all                       # the active zone
$ sudo firewall-cmd --add-service=https --permanent
$ sudo firewall-cmd --add-port=5432/tcp --permanent
$ sudo firewall-cmd --reload
```

**`--permanent` writes the rule to disk but does not apply it now**; without it, the rule applies now and is lost on reload. Add permanently, then `--reload`.

It also accepts service names instead of port numbers — `--add-service=https` rather than `--add-port=443/tcp`.

## `iptables`

**`iptables` manages the filtering rules held in the kernel.** Even when using a front end, being able to read its output is worth having, because it shows what is actually in the kernel rather than what a front end believes it configured.

A **chain** is a list of rules applied at one point in a packet's journey. `INPUT` is for packets addressed to this machine and is where nearly all server firewall work happens; `OUTPUT` is for packets it sends, `FORWARD` for packets passing through to somewhere else.

Rules are tested **in order, top to bottom**. The first match decides and testing stops. If nothing matches, the chain's **policy** applies. A rule's decision is its **target**: `ACCEPT` lets the packet through, `DROP` discards it silently, and `REJECT` discards it and sends back an error.

`DROP` gives an attacker no confirmation the machine exists; `REJECT` is easier to debug, since a legitimate user gets a clear failure instead of a hang.

### Reading a ruleset

```bash
$ sudo iptables -L INPUT -n -v --line-numbers
Chain INPUT (policy DROP 0 packets, 0 bytes)
num   pkts bytes target  prot opt in   out  source      destination
1       12   635 ACCEPT  0    --  lo   *    0.0.0.0/0   0.0.0.0/0
2        0     0 ACCEPT  0    --  *    *    0.0.0.0/0   0.0.0.0/0   ctstate RELATED,ESTABLISHED
3        0     0 ACCEPT  6    --  *    *    0.0.0.0/0   0.0.0.0/0   tcp dpt:22
4        0     0 ACCEPT  6    --  *    *    0.0.0.0/0   0.0.0.0/0   tcp dpt:443
```

`-n` prints numbers instead of looking up names, `-v` adds the counters, `--line-numbers` numbers the rules so you can delete one.

- **`policy DROP`** — anything unmatched is discarded, making this a whitelist.
- **`pkts` / `bytes`** — how much traffic each rule has matched. A rule you expect to be working with a count of zero is not matching anything.
- **`prot`** — `6` is TCP, `17` is UDP, `0` any.
- **`in`** — the interface; rule 1 applies only to loopback.
- The trailing text — extra conditions, such as `tcp dpt:22` for destination port 22.

That order is the standard shape: allow loopback, allow replies to connections this machine started, allow the services you want reachable, drop the rest. Without rule 2, a `DROP` policy would block the answers to your own outgoing requests.

The counters show ordering at work — rule 1 matched 12 packets while rules 3 and 4 matched none, because that traffic was on loopback and the search ended at the first match.

### Writing rules

```bash
$ sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT     # append
$ sudo iptables -I INPUT 1 -p tcp --dport 22 -j ACCEPT   # insert at position 1
$ sudo iptables -D INPUT 3                               # delete rule 3
$ sudo iptables -P INPUT DROP                            # set the policy
```

`-A` appends and `-I` inserts. Since rules are tested in order, a rule appended after a drop-everything rule never runs — when a rule seems to have no effect, check its position first.

**These rules do not survive a reboot.** `iptables` changes the live kernel configuration and writes nothing to disk; keeping them requires the `iptables-persistent` package. Front ends handle this themselves, which is the main practical reason to prefer them.

## A working starting point

```bash
$ sudo ufw default deny incoming
$ sudo ufw default allow outgoing
$ sudo ufw allow 22/tcp                       # before enabling
$ sudo ufw allow 443/tcp
$ sudo ufw enable
```

When a service is unreachable, check the service and the firewall separately: `ss -tlnp` shows whether the program is listening and on which address, and `ufw status` shows whether packets are allowed to reach it.