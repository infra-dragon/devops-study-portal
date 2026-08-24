# Structured data

Not all data is flat text. JSON and YAML store its values inside nesting (structure data), so you want to address them by their structure. Two tools do exactly that: **`jq`** for JSON and **`yq`** for YAML.

## `jq` — query and transform JSON

**`jq`** is a command-line JSON processor. It reads JSON, applies a *filter* — an expression written in jq's query language — and writes the result to stdout. The general form of an invocation is:

```
jq [OPTIONS] '<filter>' [FILE...]
```
The filter is enclosed in single quotes to stop the shell from interpreting its characters.
If no file is given, `jq` reads from stdin, which is why it is most often the final stage of a pipe (`curl … | jq '<filter>'`).


Let's see a few examples given this JSON file:

```bash
$ cat services.json
{
  "env": "prod",
  "conf": {
    "port": 9090,
    "debug": false
  }
  "services": [
    { "name": "web", "port": 80,   "replicas": 3 },
    { "name": "api", "port": 8080, "replicas": 2 }
  ]
}
```

Field access is written `.key` and evaluates to the value stored under that key in an object.

```bash
$ jq '.env' services.json
"prod"
```

Nested fields are reached by chaining accessors (`.a.b.c`).

```bash
$ jq '.conf.port' services.json
9090
```

An array is indexed with `[N]`, zero-based; and the iterator `[]` evaluates to every element of an array in turn. 

```bash
$ jq '.services[0].name' services.json
"web"

$ jq '.services[].name' services.json     # [] evaluates to each element
"web"
"api"
```

A filter of `.` alone names no key and returns the whole input, so `jq .` prints the entire document and by default beautifies it:

```bash
$ echo '{"name":"web","port":80}' | jq .
{
  "name": "web",
  "port": 80
}
```

By default, string values are printed with their enclosing double quotes. The **`-r`** (raw output) flag prints them without:

```bash
$ jq -r '.services[].name' services.json
web
api
```

Filters are combined with the pipe operator `|`: the value produced by the filter on the left becomes the input to the filter on the right. Here `.services[]` produces each service object, and piping into `.name` extracts that field from each:

```bash
$ jq '.services[] | .name' services.json
"web"
"api"
```

jq provides built-in functions for use within such pipelines. `select(f)` returns its input only when the expression `f` is true for it; `length` returns the size of an array, object, or string; `keys` returns an object's keys as a sorted array; `map(f)` applies `f` to every element of an array:

```bash
# keep services with more than 2 replicas
$ jq '.services[] | select(.replicas > 2)' services.json
{
  "name": "web",
  "port": 80,
  "replicas": 3
}

# number of services
$ jq '.services | length' services.json
2

# the top-level keys
$ jq 'keys' services.json
[
  "conf",
  "env",
  "services"
]

# every port, collected into an array
$ jq '.services | map(.port)' services.json
[
  80,
  8080
]
```

jq can also construct new JSON rather than only extract it. Object construction uses `{}` and array construction uses `[]`. A key computed from the data, rather than written as a literal, must be parenthesized — hence `(.name)`:

```bash
# turn each service into a name → port pair
$ jq '.services[] | {(.name): .port}' services.json
{ "web": 80 }
{ "api": 8080 }
```

The **`-c`** (compact output) flag prints each JSON value on a single line instead of across multiple indented lines:

```bash
$ jq -c '.services[]' services.json
{"name":"web","port":80,"replicas":3}
{"name":"api","port":8080,"replicas":2}
```

The most common pairing in practice is `curl … | jq`: fetch JSON from an HTTP API and extract or reshape the required fields in a single pipeline.

## `yq` — query and transform YAML

**`yq`** is the equivalent processor for YAML.

We use the mikefarah build of `yq` — the standalone Go binary (v4).

Fields are addressed by their path, `.spec.replicas`, with array elements selected by `[N]` or `[]`:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: web
          image: nginx:1.21
```

```bash
$ yq '.kind' deployment.yaml
Deployment

$ yq '.spec.replicas' deployment.yaml
3

$ yq '.spec.template.spec.containers[].image' deployment.yaml
nginx:1.21
```

The **`-i`** (in-place) flag writes the result back to the file instead of printing to stdout:

```bash
$ yq -i '.spec.replicas = 5' deployment.yaml
```

Because `yq` also reads and writes JSON, it serves as a YAML↔JSON converter:

```bash
$ yq -o json deployment.yaml     # YAML → JSON
$ yq -o yaml data.json           # JSON → YAML
```

`yq` also handles multi-document YAML — files whose documents are separated by `---` — through the `eval-all` command, which applies an expression across all of them at once.