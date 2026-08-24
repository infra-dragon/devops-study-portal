# Downloading and transferring files

## `curl`

**`curl` ("Client URL") sends a request to a URL and writes the server's response to standard output.**

Takes an address, performs the request, and prints the response.

```
curl [OPTIONS] URL
```

With no options it fetches the URL and prints the result:

```bash
$ curl http://example.com/hello.txt
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100    27  100    27    0     0   2259      0 --:--:-- --:--:-- --:--:--  2454
Hello from the test server
```

Two separate things are printed there. The table is a **progress meter**, written to standard error. The last line is the response body, written to standard output.

Because the body goes to standard output rather than to a file, it drops straight into a pipeline — the `curl … | jq` pairing from the text processing chapter is exactly this. The meter does not interfere, since a pipe carries standard output only.

### Getting the output where you want it

```bash
$ curl -s URL              # silent: suppress the progress meter
$ curl -o notes.txt URL    # save, naming the file yourself
$ curl -O URL              # save, taking the name from the URL
```

**`-O`** takes the filename from the end of the URL. Fetching `http://example.com/report.txt` with `-O` creates `report.txt` in the current directory:

```bash
$ curl -sO http://example.com/report.txt
$ ls
report.txt
```

That saves typing the name twice, but only works when the URL actually ends in a filename — a URL like `http://example.com/download?id=42` has no name to take, and `-o` is needed.

**`-s`** removes the progress meter shown above, leaving only the response:

```bash
$ curl -s http://example.com/hello.txt
Hello from the test server
```

The meter is useful at a terminal for a large download and unwanted everywhere else, which makes `-s` near-automatic in scripts.

Lowercase `-o` takes a name from you; uppercase `-O` takes it from the URL.

### Working with APIs

This is what `curl` is for, and where it has no real competition.

| Flag | Purpose |
|---|---|
| `-X METHOD` | the HTTP method — `GET` by default, or `POST`, `PUT`, `DELETE` |
| `-H "Header: value"` | add a request header |
| `-d 'data'` | send a request body (implies `POST`) |
| `-I` | fetch the response headers only |
| `-L` | follow redirects |
| `-u user:pass` | HTTP authentication |

A typical API call sends a body and an authentication header:

```bash
$ curl -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer token123" \
    -d '{"name":"test"}' \
    https://api.example.com/items
{"received": {"name":"test"}}
```

**`-I`** asks for headers alone, which answers "is this URL alive and what does it serve" without downloading anything:

```bash
$ curl -sI http://example.com/hello.txt
HTTP/1.0 200 OK
Content-type: text/plain
Content-Length: 27
Last-Modified: Sun, 23 Aug 2026 03:04:48 GMT
```

**`-L`** follows redirects. Without it, a URL that has moved returns a short redirect response and nothing else — a common cause of "the download produced an empty file".

### Seeing the whole exchange

**`-v`** prints the request and the response headers, marking sent lines with `>` and received lines with `<`:

```bash
$ curl -sv -H "Authorization: Bearer secret" https://api.example.com/items
> GET /items HTTP/1.1
> Host: api.example.com
> User-Agent: curl/8.5.0
> Authorization: Bearer secret
>
< HTTP/1.0 200 OK
< Content-type: application/json
< Content-Length: 29
```

When an API rejects a request, this shows exactly what was sent — usually revealing a missing header or a body that did not go out as intended.

### `-f` — treat HTTP errors as failures

**`curl` does not treat an HTTP error as a failure.** A 404 still exits zero, because the request itself succeeded:

```bash
$ curl -s http://example.com/missing.txt > out.txt; echo $?
0
```

The script continues with an error page saved as if it were the file. **`-f`** fixes this by failing on HTTP errors of 400 and above:

```bash
$ curl -sf http://example.com/missing.txt > out.txt; echo $?
22
```

### `-S`, and why `-s` alone is not enough

`-s` silences the progress meter, but it silences error messages too. A failed download then produces nothing at all:

```bash
$ curl -s http://example.com/missing
                                    # no output whatsoever
```

**`-S`** puts the errors back while leaving the meter suppressed:

```bash
$ curl -sS http://unreachable.example.com/file
curl: (7) Failed to connect to unreachable.example.com port 80: Couldn't connect to server
```

The two are used together — `-sS` means "quiet, unless something is wrong", which is what a script wants.

### The four together

Scripts commonly use `-fsSL`, which is those flags combined into one word. Each does one thing:

| Flag | What it does |
|---|---|
| `-f` | fail on an HTTP error instead of saving the error page |
| `-s` | suppress the progress meter |
| `-S` | but still print error messages |
| `-L` | follow redirects |

```bash
$ curl -fsSL https://example.com/install.sh -o install.sh
```

Fail loudly on a bad response, stay quiet on a good one, say something if the connection breaks, and follow the URL if it has moved.

### `-w` — print just the status code

**`-w`** prints a chosen value after the transfer, most usefully the status code:

```bash
$ curl -s -o /dev/null -w "%{http_code}\n" http://example.com/hello.txt
200
$ curl -s -o /dev/null -w "%{http_code}\n" http://example.com/missing.txt
404
```

`-o /dev/null` discards the body, leaving just the number — a compact health check.

## `wget`

**`wget` downloads files over HTTP and saves them to disk.**

```
wget [OPTIONS] URL
```

Saving is the default, and it reports progress as it goes:

```bash
$ wget http://example.com/hello.txt
Saving to: 'hello.txt'
hello.txt          100%[==================>]      27  --.-KB/s    in 0s
2026-08-23 03:05:20 (6.38 MB/s) - 'hello.txt' saved [27/27]
```

```bash
$ wget -q URL                  # quiet
$ wget -O name.txt URL         # choose the filename
$ wget -P /tmp/downloads URL   # choose the directory
```

Note that `wget -O` is uppercase where `curl -o` is lowercase — a small inconsistency that costs people time.

### Resuming

**`-c`** continues a partial download instead of starting again:

```bash
$ ls -l bigfile.bin
-rw-r--r-- 1 root root 1000000 …          # interrupted at 1 MB

$ wget -c http://example.com/bigfile.bin
$ ls -l bigfile.bin
-rw-r--r-- 1 root root 2000000 …          # completed
```

Only the missing part was transferred. For a large file over an unreliable connection, this is the difference between finishing and starting over.

### Recursive download

`wget` can follow links and retrieve an entire directory or site — something `curl` cannot do at all.

```bash
$ wget -r -np http://example.com/
$ find .
./example.com/index.html
./example.com/hello.txt
./example.com/sub/index.html
./example.com/sub/nested.txt
```

| Flag | Effect |
|---|---|
| `-r` | recursive — follow links |
| `-np` | no parent — do not climb above the starting URL |
| `-l N` | limit the depth |
| `-m` | mirror: recursive, with timestamps and infinite depth |

**`-np` is important.** Without it, a link pointing upwards leads `wget` out of the directory you meant and potentially across the whole site.

Be considerate with recursive downloads: they can issue thousands of requests quickly. `--wait=1` pauses between them.

## Which to use

**`curl`** for anything involving an API, a header, a request body, or a status code — and whenever the response should go into a pipeline rather than a file.

**`wget`** for downloading files, especially large ones, unreliable connections, or whole directories.
