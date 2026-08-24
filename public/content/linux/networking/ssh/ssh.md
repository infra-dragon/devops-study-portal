# SSH

## What SSH is

**SSH (Secure Shell) is a protocol for logging in to a remote machine and running commands on it over an encrypted connection.**

It is how nearly all server administration is done. You sit at one machine, connect to another, and get a shell there — with everything sent between the two encrypted, so anyone able to read the traffic in between learns nothing.

The pieces involved:

- **`ssh`** — the client, run on your machine.
- **`sshd`** — the server, running on the remote machine, listening on port 22.

```bash
$ ssh alice@server.example.com
```

That connects as user `alice` on that host, and leaves you at a shell prompt on the far end.

## How the encryption works

SSH uses **asymmetric cryptography**, which is worth understanding because the whole key-based login system rests on it.

**A key pair is two matched keys: a private key that is kept secret, and a public key that can be given to anyone.** They are generated together and are mathematically linked, but neither can be derived from the other. Data encrypted with one can only be decrypted with the other.

This gives two properties SSH uses:

- **Anyone can encrypt for you.** Something encrypted with your public key can only be opened with your private key.
- **You can prove who you are.** Something you sign with your private key can be verified with your public key by anyone — and only you could have produced it.

Two separate exchanges happen when you connect:

1. **The connection is secured.** The client and server agree on a shared secret over the open network, in a way an eavesdropper cannot reconstruct even having watched the whole exchange. Everything after this point is encrypted.
2. **The parties authenticate.** The server proves its identity with its own key, and then you prove yours — by password, or by key.

## Host keys and `known_hosts`

The first time you connect anywhere, SSH asks:

```
The authenticity of host 'server.example.com' can't be established.
ED25519 key fingerprint is SHA256:VJ1Fg75HiChtHoPOhi3fxHO0vGJwaMB9zSz3VWoJwAk.
Are you sure you want to continue connecting (yes/no)?
```

Every server has its own key pair, called its **host key**. This prompt is showing you the fingerprint of the server's public key and asking whether you recognise it. On accepting, it is recorded in **`~/.ssh/known_hosts`**:

```bash
$ cat ~/.ssh/known_hosts
|1|MoNNROV0DYpTijI8HTAcwrM6YKQ=|N4Gh5lv6Q37Ru+iZeEbAArdoISM= ssh-ed25519 AAAAC3NzaC1lZDI1N...
```

On every later connection the server's key is compared against this record. If it differs, SSH refuses to connect and warns loudly, because that is what an impostor server would look like — someone intercepting your connection and pretending to be the destination.

In practice the warning usually means the server was rebuilt or reinstalled and has a new host key. Remove the stale entry and reconnect:

```bash
$ ssh-keygen -R server.example.com
```

Do that only when you know why the key changed.

## `ssh-keygen` — creating your key pair

Passwords are the weaker way to log in: they can be guessed, reused, and brute-forced. Key-based login replaces them.

**`ssh-keygen` generates a key pair.**

```
ssh-keygen -t TYPE [-C COMMENT] [-f FILE]
```

```bash
$ ssh-keygen -t ed25519 -C "alice@laptop"
Generating public/private ed25519 key pair.
Your identification has been saved in /home/alice/.ssh/id_ed25519
Your public key has been saved in /home/alice/.ssh/id_ed25519.pub
The key fingerprint is:
SHA256:VJ1Fg75HiChtHoPOhi3fxHO0vGJwaMB9zSz3VWoJwAk alice@laptop
```

**`-t ed25519`** chooses the key type. Ed25519 is the current recommendation: short, fast, and strong. RSA still appears widely and remains fine at 4096 bits (`-t rsa -b 4096`), but there is no reason to prefer it for a new key. **`-C`** adds a comment, conventionally identifying which machine the key belongs to.

Two files result, and the difference between them is the whole point:

```bash
$ ls -l ~/.ssh/
-rw------- 1 alice alice 399 Aug 23 02:49 id_ed25519       # PRIVATE — never leaves this machine
-rw-r--r-- 1 alice alice  94 Aug 23 02:49 id_ed25519.pub   # public — copy freely
```

```bash
$ cat ~/.ssh/id_ed25519.pub
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGXYkA7qZmdkzkFEVlytqe7y0h9YhuHMs0euCzpXD6Tq alice@laptop
```

**The private key never leaves your machine.** It is not copied to servers, not emailed, not put in a repository. Anyone holding it can log in as you everywhere the matching public key is installed.

`ssh-keygen` also offers a **passphrase**, which encrypts the private key on disk. With one, a stolen key file is useless without it — worth setting, and the reason `ssh-agent` exists further down.

Note the permissions. SSH requires the private key to be unreadable by others and refuses to use it otherwise:

```bash
$ chmod 644 ~/.ssh/id_ed25519 && ssh server
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Permissions 0644 for '/home/alice/.ssh/id_ed25519' are too open.
This private key will be ignored.
```

The private key must be `600`, and `~/.ssh` itself `700`.

## `authorized_keys` — how the server knows you

**`~/.ssh/authorized_keys` on the server is the list of public keys permitted to log in as that user.** One key per line, in the format shown above.

Logging in with a key works like this: you claim a username, the server looks in that user's `authorized_keys`, and challenges you to prove you hold the matching private key. You sign the challenge, the server verifies the signature with the public key, and you are in. **The private key itself is never sent.**

The `-v` flag shows those steps happening:

```bash
$ ssh -v server
debug1: Authentications that can continue: publickey
debug1: Offering public key: /home/alice/.ssh/id_ed25519 ED25519 SHA256:VJ1Fg75...
debug1: Server accepts key: /home/alice/.ssh/id_ed25519 ED25519 SHA256:VJ1Fg75...
Authenticated to server ([10.0.0.5]:22) using "publickey".
```

`-v` is the first thing to reach for when a key login fails and you cannot see why.

### `ssh-copy-id` — installing your key

**`ssh-copy-id` copies your public key into a server's `authorized_keys`.**

```bash
$ ssh-copy-id alice@server.example.com
```

It asks for your password once — the last time you will need it for that server — then appends the key and fixes the permissions. Doing it by hand is possible but easy to get wrong; the permissions requirements apply on the server side too.

Once installed, `ssh alice@server.example.com` logs in with no password at all.

## `~/.ssh/config` — saving the details

Typing a user, port, and key path on every connection is tedious. **`~/.ssh/config` stores per-host settings under a short alias.**

```
Host demo
    HostName 10.0.0.5
    Port 2222
    User root
    IdentityFile ~/.ssh/id_ed25519
```

With that in place, this:

```bash
$ ssh -i ~/.ssh/id_ed25519 -p 2222 root@10.0.0.5
```

becomes:

```bash
$ ssh demo
```

The alias works everywhere SSH is used, including `scp` and `rsync`.

Two commonly useful settings:

**A jump host** — reaching a machine that is not directly accessible, by connecting through one that is:

```
Host internal-db
    HostName 10.0.2.15
    User alice
    ProxyJump bastion.example.com
```

`ssh internal-db` then connects through the bastion automatically.

**Keeping a connection alive** through an idle timeout:

```
Host *
    ServerAliveInterval 60
```

The file must be `600`, like the keys.

## `ssh-agent` — using a passphrase once

A passphrase on a private key means typing it on every connection, which pushes people towards leaving it off.

**`ssh-agent` is a program that holds unlocked private keys in memory and performs signatures on request.** You unlock the key once, and connections use it without asking again.

```bash
$ eval "$(ssh-agent -s)"          # start it
$ ssh-add ~/.ssh/id_ed25519       # unlock and load a key
Identity added: /home/alice/.ssh/id_ed25519 (alice@laptop)

$ ssh-add -l                      # list loaded keys
256 SHA256:VJ1Fg75HiChtHoPOhi3fxHO0vGJwaMB9zSz3VWoJwAk alice@laptop (ED25519)
```

The keys are held in memory only, and disappear when the agent stops or the machine is rebooted. Desktop environments normally start an agent automatically at login, so `ssh-add` is often all you need.

## `scp` and `rsync` — copying files

SSH carries file transfers as well as shells.

### `scp`

**`scp` copies files over SSH**, using the same syntax as `cp` with `host:path` for the remote side.

```
scp [-r] SOURCE DESTINATION
```

```bash
$ scp report.txt demo:/tmp/                    # local  → remote
$ scp demo:/var/log/app.log ./                 # remote → local
$ scp -r ./site demo:/var/www/                 # a whole directory
```

It is simple and everywhere. Its weakness is that it copies everything every time, with no way to resume.

### `rsync`

**`rsync` synchronises files between two locations, transferring only the differences.**

```
rsync -av [-e SSH_COMMAND] SOURCE DESTINATION
```

**`-a`** preserves permissions, timestamps, and ownership and recurses into directories; **`-v`** lists what it does.

```bash
$ rsync -av ./src/ demo:/tmp/dest/
sending incremental file list
./
a.txt
b.txt

sent 181 bytes  received 89 bytes
```

Running it again after changing one file shows the difference from `scp`:

```bash
$ rsync -av ./src/ demo:/tmp/dest/
sending incremental file list
a.txt

sent 146 bytes  received 41 bytes
```

Only `a.txt` was sent. On a large directory where little has changed, this is the difference between seconds and hours — and an interrupted transfer can be resumed by simply running it again.

**The trailing slash on the source matters.** `src/` copies the *contents* of `src` into the destination; `src` without the slash copies the directory itself, creating `dest/src/`. This catches everyone at least once.

Use `scp` for a single file, `rsync` for directories, repeated transfers, or anything large.