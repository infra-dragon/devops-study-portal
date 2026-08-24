# Links

A **link** is an extra name for a file. Linux has two kinds — hard and symbolic — and they behave quite differently. To see why, you first need to know how the filesystem keeps a file's *name* separate from the file itself.

## Inodes: the file behind the name

**Every file is really two separate things: a name, and an inode — the filesystem's record of the file itself.** The inode holds everything about the file (its size, permissions, owner, timestamps, and where its data lives on disk) *except* the name. The name is stored separately, as an entry in a directory that points to an inode number.

That separation is the whole reason links can exist: because the name and the file are decoupled, more than one name can point to the same inode.

Every inode has a number, unique within its filesystem. `ls -i` shows it:

```bash
$ ls -li original.txt
573539 -rw-r--r-- 1 alice alice 12 Jul 16 01:42 original.txt
```

The first field, `573539`, is the inode number — the actual file. `original.txt` is just a name pointing to it.

## Hard links

**A hard link is another name for the same inode — a second, equal entry pointing to the exact same file.** There is no "original" and "copy": both names *are* the file, equally.

Create one with `ln` (no flag), target first:

```bash
$ ln original.txt hardlink.txt
$ ls -li original.txt hardlink.txt
573539 -rw-r--r-- 2 alice alice 12 Jul 16 01:42 hardlink.txt
573539 -rw-r--r-- 2 alice alice 12 Jul 16 01:42 original.txt
```

Two things to notice. Both names share the **same inode number** (`573539`) — they are literally the same file. And the count in the second column is now **`2`**: that field (the "link count" you saw in `ls -l`) is the number of names pointing to the inode, and creating the hard link raised it from 1 to 2.

Because they're one file, a change made through either name is seen through the other:

```bash
$ echo "second line" >> hardlink.txt
$ cat original.txt
hello world
second line
```

Hard links have two limits, both coming from how inodes work: you can't hard-link a directory (it could create loops in the tree), and you can't hard-link across different filesystems (an inode number only means something within its own filesystem).

## Symbolic links (symlinks)

**A symbolic link is a small file that holds the *path* to another file — a pointer by name, not by inode.** It's a signpost that says "the real file is over there."

Create one with `ln -s`, again target first:

```bash
$ ln -s original.txt symlink.txt
$ ls -li original.txt symlink.txt
573539 -rw-r--r-- 2 alice alice 24 Jul 16 01:42 original.txt
573540 lrwxrwxrwx 1 alice alice 12 Jul 16 01:42 symlink.txt -> original.txt
```

Unlike a hard link, the symlink is its **own** file: it has a **different inode number** (`573540`), its type is `l` (the leading character of the permissions), and `ls -l` shows where it points with an arrow, `symlink.txt -> original.txt`. `readlink` prints that target on its own:

```bash
$ readlink symlink.txt
original.txt
```

Because it points by name, a symlink can do what a hard link can't: point across filesystems, and point to a directory. One pitfall to watch: a symlink stores the exact path you gave it, so a *relative* target (like `original.txt` above) will break if you move the link elsewhere — use an absolute path when the link might move.

## Deleting the target: the key difference

This is where the two kinds part ways. Delete the original name, and:

```bash
$ rm original.txt

$ cat hardlink.txt          # hard link — still works, data survives
hello world
second line

$ cat symlink.txt           # symbolic link — broken
cat: symlink.txt: No such file or directory
$ ls -l symlink.txt
lrwxrwxrwx 1 alice alice 12 Jul 16 01:42 symlink.txt -> original.txt
```

The **hard link** keeps working: it was one of the names on the inode, so removing the other name just dropped the link count from 2 to 1 — the file's data isn't freed until *no* names point to it. The **symbolic link** is now **dangling**: it still points at the path `original.txt`, but that name is gone, so following it fails. Notice it breaks even though the data itself still exists under `hardlink.txt` — the symlink only ever knew the *name*, not the file.

## Which to use

In practice, **symbolic links are far more common**. They're what you reach for to point a stable name at a changing target — a `current` symlink pointing at the latest release directory, a config in `/etc` linked to a file in your repo, and so on — and they can cross filesystems and point to directories. **Hard links** are a niche tool, useful mainly for space-saving deduplication where two names must refer to one file on the same filesystem. When someone says "a link" without qualifying, they almost always mean a symbolic one.