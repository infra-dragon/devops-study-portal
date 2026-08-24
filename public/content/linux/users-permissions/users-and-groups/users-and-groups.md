# Users and groups

## Users

A **user** is an identity the kernel attaches to every process and every file, and uses to decide what may touch what. To the kernel a user is a number, the **UID**; the login name is a label mapped onto it.

UID ranges:

| UID | Kind | Purpose |
|---|---|---|
| `0` | **root** | The superuser. Permission checks do not restrict it — it may read, write, and kill anything. |
| `1`–`999` | System accounts | Owned by services, not people. A compromised service gets only that account's access. |
| `1000`+ | Human accounts | Created for people to log in with. |

```bash
$ whoami
alice
$ id -u
1000
```

## Groups

A **group** is a named set of users, so one permission grant covers several people. It is also a number to the kernel, the **GID**.

Each user has:

- one **primary group** — assigned to the files the user creates; recorded as the GID in the user's `/etc/passwd` line.
- any number of **supplementary groups** — extra memberships; recorded as user lists in `/etc/group`.

The two therefore come from two different files, which is why a user can be a member of `developers` without it being their primary group.

## `id` — show the full identity

**`id`** prints a user's complete identity: the UID, the primary group, and every group the user belongs to, each as a name with its number.

```bash
$ id
uid=1000(alice) gid=1000(alice) groups=1000(alice),27(sudo),1001(developers)
```

The three parts of that line:

- **`uid=1000(alice)`** — the user: UID `1000`, name `alice`.
- **`gid=1000(alice)`** — the **primary** group, taken from field 4 of the user's `/etc/passwd` line.
- **`groups=…`** — every group the user is in, primary and supplementary together. The first entry repeats the primary group (`1000(alice)`), and the rest are the supplementary ones (`27(sudo)`, `1001(developers)`) collected from `/etc/group`.

So in the example, `alice` has one primary group (`alice`) and two supplementary groups (`sudo`, `developers`). Because `groups=` is the union of both kinds, it is the list that decides her access: any permission granted to any of those three groups applies to her.

By default `id` reports the current user; give it a name to inspect another account:

```bash
$ id bob
uid=1001(bob) gid=1001(bob) groups=1001(bob),1001(developers)
```

## `whoami` — show the current username

**`whoami`** prints the username of the current user, and nothing else. Its use is confirming which account you are acting as — most often after switching users, where acting as the wrong account is easy to do unnoticed:

```bash
$ whoami
alice
```

## `groups` — show group memberships

**`groups`** prints the names of the groups a user belongs to — the same set as `id`'s `groups=` field, but names only, without the numbers. It answers "what do I have access to through groups" without the rest of the `id` output:

```bash
$ groups
alice sudo developers
```

Given a username, it reports that user's groups instead, prefixed with the name:

```bash
$ groups bob
bob : bob developers
```

## `/etc/passwd` — the user accounts

**`/etc/passwd`** is the file that defines the user accounts on the system: every user known to the machine has an entry here, holding their name, their UID, their primary group, their home directory, and the shell they get on login. It is a plain text file readable by everyone, because ordinary programs need it constantly — every time a tool such as `ls -l` shows an owner's name instead of a UID, it is looking the number up here.

Despite the name, it does **not** contain passwords; those moved to `/etc/shadow` long ago, for the reason given in the next section.

The format is one line per user, with seven colon-separated fields:

```bash
$ grep '^alice:' /etc/passwd
alice:x:1000:1000:Alice Smith:/home/alice:/bin/bash
```

| Field | Value above | Meaning |
|---|---|---|
| 1 | `alice` | Username |
| 2 | `x` | Password placeholder — the hash is in `/etc/shadow` |
| 3 | `1000` | UID |
| 4 | `1000` | **Primary** GID |
| 5 | `Alice Smith` | Comment, usually the full name |
| 6 | `/home/alice` | Home directory |
| 7 | `/bin/bash` | Login shell — the program started on login |

Field 7 controls whether the account can be logged into. Service accounts use `/usr/sbin/nologin`, a program that refuses immediately:

```bash
$ /usr/sbin/nologin
This account is currently not available.
```

## `/etc/shadow` — the passwords

Holds the password **hashes**, not the passwords. It is a separate file because `/etc/passwd` must be world-readable (programs map UIDs to names), while hashes must not be. Hence root-only access:

```bash
$ ls -l /etc/shadow
-rw-r----- 1 root shadow 609 Apr 18 18:13 /etc/shadow
```

## `/etc/group` — the groups

One line per group, four fields — name, password placeholder, GID, and the comma-separated **supplementary** members:

```bash
$ grep '^developers:' /etc/group
developers:x:1001:alice,bob
```

Note the asymmetry: this list holds supplementary members only. `alice`'s primary group is not shown here — it is the GID in her `/etc/passwd` line.