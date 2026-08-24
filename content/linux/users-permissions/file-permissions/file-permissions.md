# File permissions

## The model

Every file and directory has an **owner** (a user) and a **group**. Against those, the system stores three sets of permissions — one for the owner, one for members of the group, one for everybody else — and each set holds three bits: **read**, **write**, **execute**.

The three sets are called **classes**:

| Class | Symbol | Applies to |
|---|---|---|
| user (owner) | `u` | the user who owns the file |
| group | `g` | users in the file's group |
| other | `o` | everyone else |

**Exactly one class applies to any given access, the first that matches.** The kernel checks: are you the owner? Then only the owner bits are used. Otherwise, are you in the file's group? Then only the group bits are used. Otherwise the other bits. Nothing is combined, and later classes are never consulted — so a file with mode `-rw----r--` denies a group member entirely, even though `other` has read, because the group bits matched first and they are empty.

## Reading `ls -l`

```bash
$ ls -l
drwxr-xr-x 2 alice devs 4096 Jul 26 23:10 docs
-rw-r--r-- 1 alice devs    0 Jul 26 23:10 notes.txt
```

The first column is ten characters: a **type** character, then the three classes in order, three bits each.

```
-  rw-  r--  r--
│   │    │    └── other:  read only
│   │    └─────── group:  read only
│   └──────────── owner:  read and write
└──────────────── type:   '-' regular file, 'd' directory, 'l' symbolic link
```

A letter means the bit is set, a `-` means it is not: `r` read, `w` write, `x` execute. After that column come the owner (`alice`) and the group (`devs`).

## What r, w, x mean

The three bits mean different things for a file and for a directory.

**On a regular file:**

| Bit | Permits |
|---|---|
| `r` | reading the contents |
| `w` | changing the contents |
| `x` | running it as a program |

**On a directory:**

| Bit | Permits |
|---|---|
| `r` | listing the names inside it |
| `w` | creating, renaming, and deleting entries inside it |
| `x` | entering it — using it as part of a path to reach what is inside |

**A symbolic link** has its own permission bits, and they're always `lrwxrwxrwx`.

Two consequences follow, both counterintuitive and both worth knowing.

**`r` and `x` on a directory are independent.** With `r` but no `x` you can list the names but cannot reach anything; with `x` but no `r` you can read a file whose name you already know but cannot list the directory:

```bash
$ chmod 444 d          # r, no x
$ ls d
file.txt
$ cat d/file.txt
cat: d/file.txt: Permission denied

$ chmod 111 d          # x, no r
$ ls d
ls: cannot open directory 'd': Permission denied
$ cat d/file.txt
secret content
```

This is why a useful directory needs both, and why `r-x` (`5`) is the normal "readable directory" setting.

**Deleting a file depends on the directory's `w`, not the file's.** A file's own permissions do not protect it from deletion, because removing a name is a change to the directory that contains it:

```bash
$ ls -l d/victim.txt
-r-xr-xr-x 1 root root 2 Jul 26 23:14 d/victim.txt    # read-only file
$ rm d/victim.txt                                      # succeeds: directory d is writable
```

## Octal notation

Each class's three bits form one octal digit, so a full mode is three digits. The values are `r`=4, `w`=2, `x`=1, added together:

| Digit | Bits | Meaning |
|---|---|---|
| `7` | `rwx` | read, write, execute |
| `6` | `rw-` | read, write |
| `5` | `r-x` | read, execute |
| `4` | `r--` | read only |
| `0` | `---` | nothing |

The three digits are owner, group, other, in that order:

```bash
644  ->  -rw-r--r--     # owner rw, group r, other r
600  ->  -rw-------     # owner rw, nobody else anything
755  ->  -rwxr-xr-x     # owner rwx, group and other r-x
700  ->  -rwx------     # owner only
777  ->  -rwxrwxrwx     # everyone everything
```

`644` for files and `755` for directories and programs are the everyday defaults; `600` and `700` are for private data.

## `chmod` — change permissions

**`chmod`** sets the permission bits of a file or directory. It takes the mode in either notation:

```
chmod [-R] MODE FILE...
```

**Octal (absolute)** — sets all nine bits at once, replacing whatever was there:

```bash
$ chmod 644 notes.txt
$ chmod 700 ~/.ssh
```

**Symbolic (relative)** — adjusts specific bits, leaving the rest alone. Write a class (`u`, `g`, `o`, `a` for all), an operator (`+` add, `-` remove, `=` set exactly), and the bits:

```bash
$ chmod u+rw  f        # -rw-------   give the owner read and write
$ chmod g+r   f        # -rw-r-----   add read for the group
$ chmod o-r   f        # -rw-r-----   remove read from other
$ chmod a+x   f        # -rwxr-x--x   add execute for everyone
$ chmod u=rw,go=r f    # -rw-r--r--   set owner to rw, group and other to r
```

Omitting the class applies it according to `umask`, so `chmod +x script.sh` is the usual way to make a script executable. **`-R`** applies the change to a directory and everything beneath it:

```bash
$ chmod -R 700 tree/
```

Use octal when you know the exact mode you want, symbolic when you want to change one bit without disturbing the others.

**Who may run it.** Only two parties can change a file's permissions: **the file's owner, and root.** Nobody else, whatever the current mode says:

```bash
$ ls -l report.txt
-rw-rw-rw- 1 root root 0 Jul 26 23:40 report.txt      # owned by root, writable by everyone
$ chmod 600 report.txt                                 # attempted as alice
chmod: changing permissions of 'report.txt': Operation not permitted
```

Note what that example rules out: having **write** permission on a file does not let you change its mode. Write governs the file's *contents*; the permission bits are metadata, and only the owner controls them. Group membership does not help either — being in a file's group grants whatever the group bits allow, never the right to rewrite those bits.

Notice: `chmod` on a symlink changes the target, not the link.

## `chown` — change the owner

**`chown`** ("change owner") sets which user owns a file or directory, and can set the group at the same time. Ownership matters because the owner is the class the permission check tries first, and the owner is who may run `chmod` on it — so transferring ownership transfers control of the file.

```
chown [-R] USER FILE...
chown [-R] USER:GROUP FILE...
chown [-R] :GROUP FILE...
```

Give a username to change the owner alone, `user:group` to change both, or `:group` to change only the group:

```bash
$ chown alice f
$ stat -c '%U:%G' f
alice:root

$ chown alice:devs f        # owner and group together
$ stat -c '%U:%G' f
alice:devs
```

**`-R`** applies the change to a directory and everything inside it — the usual way to hand a whole directory tree to the account that should own it:

```bash
$ chown -R www-data:www-data /srv/app
```

**Who may run it.** Changing a file's owner requires **root**. An ordinary user cannot give a file away, not even one they own:

```bash
$ chown root myfile          # attempted as alice, on alice's own file
chown: changing ownership of 'myfile': Operation not permitted
```

The restriction exists because ownership carries privilege and cost: if users could hand files to each other, one could plant a file in another account's name — evading disk quotas, or leaving a file that appears to be someone else's work.

## `chgrp` — change the group

**`chgrp`** ("change group") sets a file's group, and nothing else. It is `chown`'s `:group` form as a separate command.

```
chgrp [-R] GROUP FILE...
```

```bash
$ chgrp devs f
$ stat -c '%U:%G' f
alice:devs
$ chgrp -R devs /srv/shared
```

**Who may run it.** Root always can. An ordinary user can change the group of a file they **own**, but only to a group they are themselves a **member** of:

```bash
$ chgrp sudo myfile        # alice owns the file and is in 'sudo'
$ chgrp shadow myfile      # alice is not in 'shadow'
chgrp: changing group of 'myfile': Operation not permitted
```

This is looser than `chown` because it is not a giveaway: you can only move your own file into a group you already belong to, so it grants no access you did not already have.

## `umask` — default permissions for new files

**`umask`** sets which permission bits are **withheld** from files the shell creates. It is a mask of bits to remove, not to grant: the system offers `666` for a new file and `777` for a new directory, and the umask subtracts from that.

```bash
$ umask
0022
$ umask -S
u=rwx,g=rx,o=rx
```

With the common umask of `022` — remove write from group and other — new files come out `644` and new directories `755`. A umask of `077` removes everything for group and other, giving `600` and `700`:

| umask | New file | New directory |
|---|---|---|
| `022` | `644` | `755` |
| `077` | `600` | `700` |

New files never get `x` from this: the base is `666`, which has no execute bit, which is why a fresh script must be made executable with `chmod +x`.

Set it by passing the value; the setting applies to the current shell only, so make it permanent in a startup file:

```bash
$ umask 077
```