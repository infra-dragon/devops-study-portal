# Special permissions and privilege escalation

## The problem

The nine permission bits of the previous page cannot express some things a real system needs.

Changing your own password means writing to `/etc/shadow`, which is readable only by root — yet ordinary users must be able to change their passwords. And `/tmp` must let every user create files, which means making it writable by everyone, but a directory anyone can write to is a directory where anyone can delete anyone else's files.

Three additional bits — **setuid**, **setgid**, and the **sticky bit** — solve exactly these cases. Beyond them, `sudo` provides the general mechanism for running a command as another user.

## The three special bits

They sit above the nine ordinary bits and appear as a fourth, leading octal digit:

| Bit | Octal | Applies to | Effect |
|---|---|---|---|
| **setuid** | `4` | executable files | the program runs as the **file's owner**, not the user who started it |
| **setgid** | `2` | executable files | the program runs with the **file's group** |
| | | directories | new files inside **inherit the directory's group** |
| **sticky** | `1` | directories | only a file's **owner** may delete or rename it |

In `ls -l` they replace the `x` of the class they affect — setuid the owner's, setgid the group's, sticky the other's:

```bash
$ ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root 64152 May 30  2024 /usr/bin/passwd
$ ls -ld /tmp
drwxrwxrwt 24 root root 4096 Jul 27 00:42 /tmp
```

The letter's case tells you whether the underlying `x` is also set: lowercase **`s`** or **`t`** means the special bit *and* execute are both on, while uppercase **`S`** or **`T`** means the special bit is set but execute is not — usually a mistake:

```bash
$ chmod 4755 f && stat -c '%A' f     # setuid + owner x
-rwsr-xr-x
$ chmod 4655 f && stat -c '%A' f     # setuid, but NO owner x
-rwSr-xr-x
```

## setuid

**setuid** ("set user ID on execution") makes a program run with the identity of the file's owner rather than the person who launched it. Set it with a leading `4`, or symbolically with `u+s`:

```bash
$ chmod 4755 prog
$ chmod u+s prog
```

`passwd` is the standard example. It is owned by root and setuid, so when `alice` runs it, the process runs as **root** and can therefore write to `/etc/shadow` — something `alice` could never do directly. The process has two identities: its **real UID** stays `alice` (who started it), while its **effective UID** — the one permission checks use — becomes root:

```bash
$ id -u
1000
$ ./prog                                 # a setuid-root program
real uid=1000  effective uid=0
```

**setuid is a security decision, not a convenience.** Any setuid-root program is a path to root for every user on the system, and it is only as safe as its own code: a bug that lets a user influence what it does runs with root's power. So the rules are: set it on as few programs as possible, never on something you have not audited, and audit the ones present with

```bash
$ find / -perm -4000 -type f 2>/dev/null
```

**setuid does not work on shell scripts.** The kernel ignores it on interpreted files — a deliberate refusal, because the interpreter and its environment offer too many ways to subvert the script. The bit can be set, and it simply has no effect:

```bash
$ ls -l s.sh
-rwsr-xr-x 1 root root 45 Jul 27 00:50 s.sh      # setuid is set
$ ./s.sh                                          # run as alice
script sees: uid=1000 euid=1000                   # still alice, not root
```

Anything needing a script to run with privilege must go through `sudo` instead.

## setgid

On an **executable file**, **setgid** is the group counterpart of setuid: the program runs with the file's group. It is rarer than setuid and used for the same kind of narrow access grant.

On a **directory**, setgid does something different and much more useful: **files created inside inherit the directory's group** instead of the creator's primary group. Set it with a leading `2` or `g+s`:

```bash
$ chmod 2775 shared
$ stat -c '%A %G' shared
drwxrwsr-x devs
```

This is the standard way to build a shared project directory. Without it, each user's files carry their own primary group and colleagues cannot read them; with it, everything lands in the common group:

```bash
$ touch plain/a shared/b        # as alice, both directories group-owned by 'devs'
$ stat -c '%U:%G' plain/a
alice:alice                     # plain dir: file gets alice's primary group
$ stat -c '%U:%G' shared/b
alice:devs                      # setgid dir: file inherits 'devs'
```

New subdirectories inherit the setgid bit as well, so the behaviour continues down the tree.

## The sticky bit

The **sticky bit** restricts deletion in a directory: even where the directory is writable by everyone, **only a file's owner (or root) may delete or rename that file.** Set it with a leading `1` or `+t`:

```bash
$ chmod 1777 upload
$ stat -c '%A' upload
drwxrwxrwt
```

This is what makes shared temporary directories safe. `/tmp` is mode `1777` — anyone may create files there, nobody may remove another's:

```bash
$ ls -ld /tmp
drwxrwxrwt 24 root root 4096 Jul 27 00:42 /tmp
```

The difference is easy to see. In a plain `777` directory, any user can delete root's file; add the sticky bit and the same attempt fails:

```bash
$ rm nosticky/rootfile           # 777 directory — succeeds
$ rm sticky/rootfile             # 1777 directory — as alice
rm: cannot remove 'sticky/rootfile': Operation not permitted
```

Recall from the previous page that deletion normally depends on the *directory's* write bit, not the file's. The sticky bit is the exception that makes world-writable directories usable.

## `su` — become another user

**`su`** ("substitute user") starts a shell as another user, asking for **that user's** password.

```
su [-] [USER]
```

With no username it means root. The `-` (or `-l`) makes it a **login shell**, which is almost always what you want: it runs the target user's startup files and gives you their environment, rather than carrying yours over.

```bash
$ su - alice        # become alice, with alice's environment
$ su -              # become root, with root's environment
```

`su` requires knowing the target account's password, which is why it is largely superseded by `sudo` on modern systems: root's password often does not exist at all, and handing it out to everyone who needs occasional privilege is exactly what `sudo` avoids.

## `sudo` — run one command as another user

**`sudo`** runs a single command as another user — root by default — after checking a central policy file for permission. You authenticate with **your own** password, not the target's.

```
sudo COMMAND
sudo -u USER COMMAND
sudo -i
sudo -l
```

```bash
$ sudo systemctl restart nginx      # run one command as root
$ sudo -u postgres psql             # run as another user
$ sudo -i                           # an interactive root login shell
$ sudo -l                           # list what you are allowed to run
```

`sudo` is itself a setuid-root binary — that is the mechanism by which it can change identity at all:

```bash
$ stat -c '%A %U' /usr/bin/sudo
-rwsr-xr-x root
```

Three properties make it preferable to `su`: each user authenticates as themselves, so no shared root password exists; permission can be granted **per command** rather than wholesale; and every use is logged, giving an audit trail of who did what. A successful authentication is cached briefly, so a run of `sudo` commands does not re-prompt each time.

## `/etc/sudoers` — the policy

**`/etc/sudoers`** defines who may run what, as whom. A user rule has four parts:

```
ubuntu   ALL=(root)   NOPASSWD:   /usr/bin/systemctl restart nginx
  │       │    │         │              │
  who     │    │         │              └── the commands permitted (or ALL)
          │    │         └── optional tags, e.g. NOPASSWD
          │    └── the identity the command may be run as
          └── which hosts the rule applies to (ALL in nearly all cases)
```

A name beginning with **`%`** is a group, not a user. That is how administrative access is normally granted — membership in a group, rather than a rule per person. These are the real rules from a stock Ubuntu system:

```bash
root    ALL=(ALL:ALL) ALL          # root may run anything, as anyone
%admin  ALL=(ALL) ALL              # members of group 'admin'
%sudo   ALL=(ALL:ALL) ALL          # members of group 'sudo'
@includedir /etc/sudoers.d
```

So adding a user to the `sudo` group grants them full administrative rights — the reason `usermod -aG sudo alice` is the usual way to make someone an administrator, and the reason `groups` on the previous page is a meaningful security check.

**`NOPASSWD`** removes the password prompt for the listed commands. Its legitimate use is automation, where no one is present to type a password, and it should always be paired with a specific command rather than `ALL`:

```bash
# reasonable: one exact command, no password
deploy  ALL=(root) NOPASSWD: /usr/bin/systemctl restart myapp

# dangerous: unrestricted root with no authentication at all
deploy  ALL=(ALL) NOPASSWD: ALL
```

Note also that granting a single command is not always as narrow as it looks: a command that can run other programs — an editor, an interpreter, a tool with a shell escape — gives away root entirely, whatever the rule says.

## `visudo` — edit the policy safely

**`visudo`** opens `/etc/sudoers` for editing and **checks the syntax before saving**. This matters more than it sounds: a syntax error in `sudoers` can make `sudo` refuse to work for everyone, and if root has no password, the machine becomes unadministrable. `visudo` also takes a lock, so two administrators cannot overwrite each other.

```bash
$ sudo visudo                          # edit the main file, validated on save
$ sudo visudo -f /etc/sudoers.d/deploy # edit a drop-in file, also validated
$ sudo visudo -c                       # check the current files without editing
/etc/sudoers: parsed OK
/etc/sudoers.d/README: parsed OK
```

Never edit `/etc/sudoers` with an ordinary editor. Prefer adding a file under **`/etc/sudoers.d/`** — the `@includedir` line pulls it in — since a self-contained drop-in is easier to review and to remove than an edit buried in the main file.