# DevOps Learning Portal — Architecture Documentation

**Version:** 1.3
**Status:** Draft — supersedes approved v1.2 upon review
**Purpose:** Complete reference for both human developers and AI agents working on this project. This document is the single source of truth for all architectural decisions, folder structures, data contracts, routing logic, and component responsibilities. No ambiguity is intentional. If a question is not answered here, the document is defective and must be amended — not worked around.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack & Local Development](#2-technology-stack--local-development)
3. [Repository Structure](#3-repository-structure)
4. [Content Architecture](#4-content-architecture)
5. [Manifest System](#5-manifest-system)
6. [URL Routing & Resolution](#6-url-routing--resolution)
7. [Component Architecture](#7-component-architecture)
8. [Data Fetching & Caching](#8-data-fetching--caching)
9. [Navigation & Scroll Behaviour](#9-navigation--scroll-behaviour)
10. [Error Handling](#10-error-handling)
11. [Markdown Authoring Rules](#11-markdown-authoring-rules)
12. [Naming Conventions](#12-naming-conventions)
13. [Adding New Content](#13-adding-new-content)
14. [Build & Deployment](#14-build--deployment)
15. [Future Extensions (Non-Binding)](#15-future-extensions-non-binding)
16. [Architectural Decision Log](#16-architectural-decision-log)
17. [Revision History](#17-revision-history)

---

## 1. Project Overview

A static, client-side documentation portal for learning DevOps and related topics. Content is stored as Markdown files and served as static assets. The application is a React SPA (Single Page Application) with no backend — all data loading happens via `fetch()` calls to static files in the `public/` directory. The entire application ships as static assets; there is no server-side code anywhere in the system.

### Core User Flow

```
Home (topic cards)
  └── Click topic card  →  Topic view (sidebar + content panel)
        └── Click section   →  Section title links directly OR expands sub-pages
              └── Click sub-page  →  Markdown content renders in content panel
```

### Design Principles

- **Content is decoupled from code.** All written content lives in Markdown files under `public/content/`. No content is embedded in JSX or JS files.
- **Lazy loading.** Manifests and Markdown files are only fetched when the user navigates to them.
- **Shareable URLs.** Every page has a unique, bookmarkable URL derived directly from the content folder path.
- **Graceful degradation.** Every fetch failure renders a user-friendly error state, never a crash.
- **Extensible by design.** Adding a new topic or section requires no code changes — only new files and a manifest entry.
- **One way to do everything.** For every authoring or implementation task there is exactly one sanctioned pattern, defined in this document. Alternatives are not "also fine."

---

## 2. Technology Stack & Local Development

| Layer | Choice | Reason |
|---|---|---|
| Bundler | Vite | Fast dev server, minimal config, native ESM |
| UI Framework | React 18 | Component model suits the sidebar + panel layout; hooks suit the async data fetching pattern |
| Routing | react-router-dom v6 | Declarative URL routing; `useParams` maps directly to fetch paths |
| Markdown Renderer | react-markdown | Runtime rendering; no build-time coupling between content and code |
| Markdown Plugins | remark-gfm, remark-frontmatter | GFM: tables, task lists, strikethrough. Frontmatter: tokenizes the YAML metadata block so it is never rendered as visible page text (ADR-009) |
| Syntax Highlighting | rehype-highlight + highlight.js | Code block highlighting; `highlight.js` is a direct dependency because the theme stylesheet and extra grammars are imported from it (§2.3) |
| Anchor IDs | rehype-slug | Auto-generates `id` attributes on headings; required for in-page anchor links (§11.4) |
| Styling | Plain CSS with CSS variables | No framework dependency; easy to theme |

### 2.1 Dependency Install Reference

```bash
npm create vite@latest devops-portal -- --template react
cd devops-portal
npm install react-router-dom react-markdown remark-gfm remark-frontmatter rehype-highlight rehype-slug highlight.js
```

`highlight.js` is installed explicitly — not left as a transitive dependency — because the theme CSS and additional language grammars are imported from it directly. Relying on transitive resolution breaks under strict package managers.

### 2.2 Node Version & Scripts

Node 20 LTS or newer.

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR. SPA fallback is built in. |
| `npm run build` | Production build → `dist/`. Copies `public/` verbatim (§14.1). |
| `npm run preview` | Serves `dist/` locally with SPA fallback. **The required smoke test before every deploy.** |

### 2.3 Syntax Highlighting Setup

Both steps below are properties of the `rehype-highlight` dependency already declared in the stack (§2). They are setup requirements of that dependency, not statements about content:

**1. Theme stylesheet** — imported once in `src/main.jsx`:

```js
import 'highlight.js/styles/github-dark.css'
```

Without this import, rehype-highlight adds CSS classes but nothing is visibly highlighted. Swapping themes means swapping this one import.

**2. Grammar registration mechanism** — rehype-highlight ships with only the highlight.js *common* grammar set. A fenced block whose language is outside the registered set renders as plain, unhighlighted code — never a crash. The one sanctioned way to extend the set:

```js
// src/components/ContentPanel.jsx
import rehypeHighlight from 'rehype-highlight'
import someLanguage from 'highlight.js/lib/languages/someLanguage'

export const highlightOptions = {
  languages: { someLanguage },
}
// usage: rehypePlugins={[rehypeSlug, [rehypeHighlight, highlightOptions]]}
```

**Which grammars to register is a content-level decision and is deliberately not specified here.** This document defines only the mechanism and the single place it lives. When content introduces a language outside the common set, add its import and one `languages` entry above — nothing else changes — and record it here so the registered set stays documented in one place.

Automatic language detection stays disabled (the default). Every fenced block declares its language explicitly (§11.5).

---

## 3. Repository Structure

```
devops-portal/
│
├── public/
│   ├── _redirects                            # OPTIONAL — Netlify only (§14.2)
│   └── content/                              # All written content lives here
│       ├── manifest.json                     # Root manifest: list of all topics
│       │
│       ├── linux/                            # topic type: "topic"
│       │   ├── manifest.json                 # Lists Linux sections
│       │   ├── files-filesystem/             # section type: "section" (has sub-pages)
│       │   │   ├── manifest.json             # Lists sub-pages
│       │   │   ├── navigation/
│       │   │   │   └── navigation.md
│       │   │   └── operations/
│       │   │       └── operations.md
│       │   └── processes/                    # section type: "page" (single page)
│       │       └── processes.md
│       │
│       ├── docker/                           # topic type: "topic"
│       │   ├── manifest.json                 # Lists Docker sections
│       │   └── images/                       # section type: "page" (single page)
│       │       └── images.md
│       │
│       └── cheatsheet/                       # topic type: "page" (single page, no sidebar)
│           └── cheatsheet.md
│
├── src/
│   ├── main.jsx                              # React root, BrowserRouter mount, theme CSS import
│   ├── App.jsx                               # Layout shell, top nav, route outlet
│   ├── router.jsx                            # All route definitions in one place
│   │
│   ├── components/
│   │   ├── TopicGrid.jsx                     # Home screen: renders topic cards
│   │   ├── Sidebar.jsx                       # Topic view: section + sub-page navigation
│   │   ├── ContentPanel.jsx                  # Renders fetched Markdown via react-markdown
│   │   └── NotFound.jsx                      # 404 fallback for unknown routes and missing content
│   │
│   ├── hooks/
│   │   ├── useManifest.js                    # Fetches and caches any manifest.json
│   │   └── useContent.js                     # Fetches and caches any .md file
│   │
│   └── styles/
│       └── main.css                          # Global styles and CSS variables
│
├── index.html
├── vite.config.js
└── package.json
```

---

## 4. Content Architecture

### Two Rules

The entire content structure is governed by two independent rules:

**Rule 1 — Topic level:** A topic is either a single page or a collection of sections.

| Topic `type` | Behaviour | Sidebar |
|---|---|---|
| `"page"` | The topic card links directly to one Markdown file. | Hidden. |
| `"topic"` | The topic card opens a sidebar listing its sections. | Shown. |

**Rule 2 — Section level:** A section is either a single page or a collection of sub-pages.

| Section `type` | Behaviour | Sidebar rendering |
|---|---|---|
| `"page"` | The section title in the sidebar is a direct link to one Markdown file. | Non-expandable link. |
| `"section"` | The section title expands to reveal a list of sub-page links. | Expandable group. |

Both `type` fields are declared **explicitly in their parent manifest** — never inferred from the presence or absence of files on disk (ADR-008).

---

### Content Tree Examples

**Linux** — `topic type: "topic"`, mixed section types:

```
Linux
  ├── Files & Filesystem   (section type: "section" → has sub-pages)
  │     ├── Navigation
  │     └── Operations
  └── Processes            (section type: "page" → single page)
```

**Docker** — `topic type: "topic"`, all sections are single pages:

```
Docker
  ├── Images               (section type: "page")
  └── Networking           (section type: "page")
```

**Cheatsheet** — `topic type: "page"`, no sidebar:

```
Cheatsheet                 (single Markdown file, no sections)
```

---

### Folder Structure Rule

Every unit of content lives in its own folder named with its `id`. The Markdown file inside is named identically to its parent folder.

```
# Topic type: "page"
content/{topicId}/
└── {topicId}.md

# Section type: "page"  (inside a topic type: "topic")
content/{topicId}/{sectionId}/
└── {sectionId}.md

# Section type: "section"  (inside a topic type: "topic")
content/{topicId}/{sectionId}/
├── manifest.json
└── {pageId}/
      └── {pageId}.md
```

**The Markdown file name always matches its parent folder name.** This is what allows fetch paths to be derived mechanically from URL params (see §6).

### Assets

Images or supplementary files for a page are placed in the same folder as the Markdown file and referenced with a **relative** path:

```
content/linux/files-filesystem/navigation/
├── navigation.md
└── directory-tree.png        ← referenced in navigation.md as ./directory-tree.png
```

Relative references are mandatory, not a stylistic preference. The page URL (`/linux/files-filesystem/navigation`) is not the file URL (`/content/linux/files-filesystem/navigation/...`), so the browser cannot resolve these paths natively — `ContentPanel` rewrites them at render time (§7.4, ADR-010). Authoring rules for assets: §11.3.

---

## 5. Manifest System

Manifests are JSON arrays containing structural metadata only — no body content ever appears in a manifest. Each manifest is scoped to its own folder.

### Universal Manifest Rules

These apply to **every** manifest, at every level:

1. **Ordering.** Every entry carries a required integer `order`. Entries are displayed sorted by `order` ascending; ties resolve by array position. Values need not be consecutive — leaving gaps (`10, 20, 30`) allows later insertion without renumbering neighbours. (ADR-012)
2. **Shape.** A manifest must parse as a JSON array. Anything else — parse error, JSON object, wrong root type — is treated as a Level-2 error (§10): an inline error state, never a crash.
3. **Forward compatibility.** All manifest consumers ignore unknown fields. Future features (§15) may add optional fields without breaking the current app.

### 5.1 Root Manifest — `public/content/manifest.json`

Always present. Lists every top-level topic. Loaded once on app start and cached for the session.

```json
[
  {
    "id": "linux",
    "title": "Linux",
    "icon": "🐧",
    "color": "#e8a020",
    "type": "topic",
    "order": 1
  },
  {
    "id": "docker",
    "title": "Docker",
    "icon": "🐳",
    "color": "#2496ed",
    "type": "topic",
    "order": 2
  },
  {
    "id": "cheatsheet",
    "title": "Cheatsheet",
    "icon": "📋",
    "color": "#888888",
    "type": "page",
    "order": 3
  }
]
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | URL-safe identifier. Lowercase, hyphens only. Must match folder name exactly. |
| `title` | string | yes | Display name shown on the topic card. |
| `icon` | string | yes | Emoji icon for the topic card. |
| `color` | string | yes | Hex color for the card accent. |
| `type` | `"topic"` \| `"page"` | yes | `"topic"` opens a sidebar. `"page"` links directly to a single Markdown file. |
| `order` | number | yes | Integer. Display order of topic cards (universal rule 1). |

---

### 5.2 Topic Manifest — `public/content/{topicId}/manifest.json`

Present only when the topic `type` is `"topic"`. Lists all sections within the topic. Loaded when the user first navigates to the topic.

```json
[
  {
    "id": "files-filesystem",
    "title": "Files & Filesystem",
    "type": "section",
    "order": 1
  },
  {
    "id": "processes",
    "title": "Processes",
    "type": "page",
    "order": 2
  }
]
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | URL-safe identifier. Must match folder name exactly. |
| `title` | string | yes | Display name shown in the sidebar. |
| `type` | `"section"` \| `"page"` | yes | `"section"` means this entry has sub-pages and its own `manifest.json`. `"page"` means it links directly to a single Markdown file. |
| `order` | number | yes | Integer. Display order in the sidebar (universal rule 1). |

---

### 5.3 Section Manifest — `public/content/{topicId}/{sectionId}/manifest.json`

Present only when the section `type` is `"section"`. Lists all sub-pages within the section. Loaded when the user first expands the section in the sidebar, or when resolving a URL that requires it (§6).

```json
[
  {
    "id": "navigation",
    "title": "Navigation",
    "order": 1
  },
  {
    "id": "operations",
    "title": "Operations",
    "order": 2
  }
]
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | URL-safe identifier. Must match folder name and `.md` filename exactly. |
| `title` | string | yes | Display name shown as a sub-page link in the sidebar. |
| `order` | number | yes | Integer. Display order within the section (universal rule 1). |

---

### 5.4 Manifest Presence Summary

| Situation | Root manifest | Topic manifest | Section manifest |
|---|---|---|---|
| Topic `type: "page"` | ✅ entry with `type: "page"` | ❌ not present | ❌ not present |
| Topic `type: "topic"` | ✅ entry with `type: "topic"` | ✅ lists sections | — |
| Section `type: "page"` | — | ✅ entry with `type: "page"` | ❌ not present |
| Section `type: "section"` | — | ✅ entry with `type: "section"` | ✅ lists sub-pages |

---

## 6. URL Routing & Resolution

All routes are defined in `src/router.jsx`. The URL structure directly mirrors the folder structure. URL depth is determined by the topic and section types.

### Route Definitions

| Route Pattern | Description |
|---|---|
| `/` | Home — topic card grid |
| `/:topicId` | Topic landing — renders directly if `type: "page"`; auto-redirects to first content page if `type: "topic"` |
| `/:topicId/:sectionId` | Single-page section (`section type: "page"`) — or auto-redirect to first sub-page if `section type: "section"` |
| `/:topicId/:sectionId/:pageId` | Sub-page within a multi-page section (`section type: "section"`) |
| `*` | Catch-all → `<NotFound />` |

### Base Path Rule

Every runtime URL in the application — manifest fetches, content fetches, rewritten asset `src` values, and the router itself — is built on `import.meta.env.BASE_URL`:

```js
const base = import.meta.env.BASE_URL   // "/" by default; "/repo-name/" on subpath deploys (§14.4)

// main.jsx
<BrowserRouter basename={import.meta.env.BASE_URL}>
```

Never hardcode a fetch path starting with a bare `/content/...`. With the default `base: '/'` the prefix is a no-op; it exists so subpath deployments (e.g. GitHub Pages project sites) require **zero code changes** — only a `vite.config.js` edit (§14.4).

### Resolution Algorithm (Authoritative)

**`/:topicId`**

1. Look up `topicId` in the root manifest. Unknown id → `<NotFound />`.
2. `type: "page"` → render `${base}content/{topicId}/{topicId}.md`. Full-width layout, no sidebar.
3. `type: "topic"` → load the topic manifest, take the lowest-`order` entry:
   - entry is `type: "page"` → `<Navigate replace>` to `/:topicId/:sectionId`
   - entry is `type: "section"` → load its section manifest, take its lowest-`order` entry → `<Navigate replace>` to `/:topicId/:sectionId/:pageId`

**`/:topicId/:sectionId`**

1. The topic must exist in the root manifest with `type: "topic"`. A `type: "page"` topic has no valid two-segment URLs → `<NotFound />`.
2. Look up `sectionId` in the topic manifest. Unknown id → `<NotFound />`.
3. `type: "page"` → render `${base}content/{topicId}/{sectionId}/{sectionId}.md`.
4. `type: "section"` → load the section manifest → `<Navigate replace>` to the lowest-`order` sub-page.
   *This is the **section-landing redirect**. It mirrors the topic-landing redirect and guarantees that every valid URL prefix is navigable — a shared or hand-typed link to `/linux/files-filesystem` lands on the first sub-page instead of dead-ending.*

**`/:topicId/:sectionId/:pageId`**

1. The topic must be `type: "topic"` and the section must be listed with `type: "section"` → otherwise `<NotFound />`.
2. Render `${base}content/{topicId}/{sectionId}/{pageId}/{pageId}.md`. An unknown `pageId` is caught by the content fetch itself (missing file → `<NotFound />`, §8.3); the section manifest is **not** consulted for validation at this depth.

### Depth Invariants

| URL depth | Valid only when | On violation |
|---|---|---|
| `/:topicId` | topic id exists in root manifest | `<NotFound />` |
| `/:topicId/:sectionId` | topic is `type: "topic"` **and** section id exists in topic manifest | `<NotFound />` |
| `/:topicId/:sectionId/:pageId` | ...**and** that section is `type: "section"` | `<NotFound />` |

### Deriving Fetch Paths from URL Params

The Markdown file path is derived mechanically from the URL params and the manifest `type` fields. No lookup table is needed.

```js
const base = import.meta.env.BASE_URL

// Topic type: "page"  →  route: /:topicId
const mdPath = `${base}content/${topicId}/${topicId}.md`

// Section type: "page"  →  route: /:topicId/:sectionId
const mdPath = `${base}content/${topicId}/${sectionId}/${sectionId}.md`

// Section type: "section"  →  route: /:topicId/:sectionId/:pageId
const mdPath = `${base}content/${topicId}/${sectionId}/${pageId}/${pageId}.md`
```

### Redirect Mechanics

All auto-redirects (topic landing and section landing) use `<Navigate replace>` so intermediate URLs never enter browser history. Redirect targets are computed from cached manifests when available; otherwise the redirecting component shows the loading state until the required manifest resolves (§8).

---

## 7. Component Architecture

### 7.1 `App.jsx`

Top-level layout shell. Renders the `<Outlet />` from React Router. Responsible for:

- Fetching the root `manifest.json` once on mount (via `useManifest`)
- Passing topic metadata to child routes via React Router context or props
- Rendering the top navigation bar: home link + current topic title (looked up in the root manifest by `:topicId`)

**Layout variants:**

| Route context | Layout |
|---|---|
| Home (`/`) | Topic card grid, no sidebar |
| Topic `type: "topic"` | Sidebar + content panel |
| Topic `type: "page"` | Full-width content panel, no sidebar |

**Document title.** An effect keeps the browser tab title in sync: `{Page title} · {Topic title} · DevOps Portal`, built from cached manifest titles for the current URL params. While a needed manifest is still loading, that segment is simply omitted. Home is `DevOps Portal`. No title data is ever parsed from Markdown — titles come exclusively from manifests (ADR-009).

**Responsive behaviour.** Below `768px` the sidebar is off-canvas: a toggle button in the top bar opens it as an overlay, and it closes automatically on navigation. At `768px` and above it is permanently docked. No other responsive behaviour is specified in v1.

### 7.2 `TopicGrid.jsx`

Rendered at `/`. Displays all topics as large clickable cards, sorted by `order`.

- Receives topic list from `App` (root manifest data)
- Each card shows: icon, title, color accent
- Clicking a `type: "page"` topic navigates to `/:topicId` (renders directly)
- Clicking a `type: "topic"` topic navigates to `/:topicId` (which triggers the auto-redirect)

### 7.3 `Sidebar.jsx`

Rendered for all `type: "topic"` topics. Displays section and sub-page navigation.

**Responsibilities:**

- Fetches the topic manifest (`useManifest`) to get the section list, sorted by `order`
- For `type: "section"` entries: renders as an expandable group; fetches the section manifest lazily on first expand
- For `type: "page"` entries: renders as a direct link — no expand/collapse, no sub-items
- Auto-expands the section containing the active page on mount and whenever URL params change (§9)
- Highlights the active section and active sub-page from URL params
- Never rendered for `type: "page"` topics

**Sidebar does NOT display the topic title.** The user is already inside the topic; the title is communicated by the top navigation bar in `App` (ADR-007).

**Sidebar rendering examples:**

```
Linux sidebar                          Docker sidebar
─────────────────────────────          ─────────────────
Files & Filesystem  ▾                  Images          →
  Navigation        →                  Networking      →
  Operations        →
Processes           →
```

Left column: `files-filesystem` is `type: "section"` (expandable), `processes` is `type: "page"` (direct link).
Right column: all sections are `type: "page"` (all direct links).

### 7.4 `ContentPanel.jsx`

Renders the Markdown content for the currently active page. This component owns the entire Markdown rendering contract.

**Responsibilities:**

1. Derives the fetch path from URL params and manifest `type` (§6) and fetches via `useContent`.
2. Renders the page heading: the `<h1>` is the **manifest `title`** of the current entry, rendered above the Markdown output. The H1 is never authored inside the Markdown body (§11.2, ADR-009).
3. Renders the Markdown body:

```jsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkFrontmatter]}
  rehypePlugins={[rehypeSlug, [rehypeHighlight, highlightOptions]]}
  components={{ img: MarkdownImg, a: MarkdownLink }}
>
  {markdown}
</ReactMarkdown>
```

`remark-frontmatter` tokenizes the YAML block so it is dropped from the rendered output. Without it, the raw `--- title: ... ---` block appears as visible text at the top of every page. The frontmatter is never parsed at runtime (ADR-009).

4. **`MarkdownImg` — asset resolution (ADR-010).** Relative image paths are rewritten against the page's content folder, because the browser would otherwise resolve them against the page URL, which points nowhere:

```js
// folder = the content folder of the current page, i.e. the md fetch path (§6) minus the filename
// e.g. "linux/files-filesystem/navigation"
function resolveAsset(src, folder) {
  if (/^https?:\/\//.test(src)) return src                          // external image — pass through
  if (src.startsWith('/')) return src                               // authoring error (§11.3) — pass through untouched
  return `${base}content/${folder}/${src.replace(/^\.\//, '')}`     // relative → co-located asset
}
```

5. **`MarkdownLink` — link contract (ADR-010):**

| `href` shape | Rendered as |
|---|---|
| `#...` | In-page anchor: smooth-scrolls to the matching rehype-slug id (§9) |
| `/...` (root-relative) | react-router `<Link>` — client-side navigation, no page reload |
| `http(s)://...` | `<a target="_blank" rel="noopener noreferrer">` |
| Anything else (relative) | Authoring error (§11.4) — rendered untouched |

6. Raw HTML inside Markdown is **not** rendered — `rehype-raw` is deliberately absent from the stack (ADR-011).
7. Handles `loading` state (skeleton or spinner) and `error` state per §8.3 / §10.
8. Applies the scroll rules of §9 after content renders.

### 7.5 `NotFound.jsx`

Displayed in three contexts:

1. **Route-level 404:** Unknown URL shape — rendered by the catch-all `*` route
2. **Resolution 404:** URL shape is valid but violates a depth invariant or references an unknown manifest id (§6)
3. **Content-level 404:** URL resolves correctly but the Markdown file is missing — rendered inline by `ContentPanel`

All contexts use the same component. It shows a clear message and a link back to home.

---

## 8. Data Fetching & Caching

### 8.1 `useManifest.js`

Fetches any `manifest.json` file and caches the result.

```js
// Signature
const { data, loading, error } = useManifest(path)

// Examples
const { data: topics }   = useManifest(`${base}content/manifest.json`)
const { data: sections } = useManifest(`${base}content/linux/manifest.json`)
const { data: pages }    = useManifest(`${base}content/linux/files-filesystem/manifest.json`)
```

**Return shape:** `{ data: Array | null, loading: boolean, error: string | null }`. `data` is the manifest array already sorted by `order`.

### 8.2 `useContent.js`

Fetches any `.md` file and caches the result.

```js
// Signature
const { data, loading, error } = useContent(path)

// Examples
const { data: markdown } = useContent(`${base}content/cheatsheet/cheatsheet.md`)
const { data: markdown } = useContent(`${base}content/docker/images/images.md`)
const { data: markdown } = useContent(`${base}content/linux/files-filesystem/navigation/navigation.md`)
```

**Return shape:** `{ data: string | null, loading: boolean, error: string | null }`

### 8.3 Shared Cache Mechanics (Both Hooks)

- **Cache key:** the full path string.
- **Cache scope:** a module-level `Map`, persisting for the full session, reset on page reload (ADR-005).
- **In-flight deduplication:** the `Map` stores the fetch `Promise` from the moment the request starts, so concurrent callers — including React 18 StrictMode's double-mount in development — share a single network request. The same settled promise then serves all future cache hits.
- **On cache hit:** data is returned without a fetch and without a loading flicker.
- **Failures are not cached:** an errored path is re-fetched on the next mount or on retry, so transient network failures are recoverable.

### 8.4 Error & Missing-Content Classification (ADR-013)

Both hooks classify every response as follows:

| Condition | Meaning | UI treatment |
|---|---|---|
| HTTP 404 | File or manifest does not exist | `<NotFound />` |
| HTTP 2xx but `Content-Type` contains `text/html` | The host's SPA fallback (§14.2) returned `index.html` instead of the missing asset | `<NotFound />` |
| `useManifest` only: body fails to parse as a JSON array | Malformed manifest | Generic error message + retry |
| Anything else (5xx, network failure) | Unexpected error | Generic error message + retry |

The second row is mandatory, not defensive garnish. On every production host configured per §14.2, a request for a **missing** content file returns `200` with `index.html` as the body. A status-only check would feed that HTML into `react-markdown` and render garbage instead of a not-found state.

---

## 9. Navigation & Scroll Behaviour

### Sidebar Expansion State

The sidebar tracks which `type: "section"` entries are expanded in local React state (`useState`). The section containing the currently active page (from URL params) is always expanded — on mount and whenever params change. Collapsing an expanded section does not navigate away.

`type: "page"` entries are never expanded — they have no expand state.

### Active Link Highlighting

The active section and active sub-page are highlighted. Active state is derived purely from `useParams()` — no separate state is needed.

```js
const { topicId, sectionId, pageId } = useParams()

// A section is active if its id matches sectionId
// A sub-page is active if its id matches pageId AND its parent section id matches sectionId
// A section type: "page" is active if its id matches sectionId (no pageId in the URL)
```

### Scroll Rules

1. On every pathname change, the content panel scrolls to the top (instant, not smooth).
2. If `location.hash` is present, then after the Markdown has rendered, the element with the matching rehype-slug id is scrolled into view (smooth). This makes deep links like `/linux/processes#signals` work on direct load.
3. In-page anchor clicks (§7.4 link contract) smooth-scroll without triggering navigation.

Implemented as a small effect in `ContentPanel` keyed on pathname, hash, and content readiness. Scroll-position restoration on back/forward is **not** implemented in v1.

### Breadcrumb Logic (Optional / Future)

The URL structure encodes a full breadcrumb: `Topic > Section > Page`. Any breadcrumb component can derive all labels purely from URL params and cached manifest data, with no additional state.

---

## 10. Error Handling

Error handling is implemented at three distinct levels. Each is independent.

### Level 1: Unknown Route (React Router)

A catch-all route `path="*"` at the bottom of the router renders `<NotFound />`. This catches any URL that doesn't match any defined pattern. URLs that match a pattern but violate a depth invariant or reference an unknown manifest id are also resolved to `<NotFound />` (§6).

### Level 2: Manifest Fetch Failure

If `useManifest` returns `error`, the component that called it renders an inline error state within the sidebar or `App`. Malformed manifest JSON is classified here as well (§8.4). The rest of the UI remains functional.

### Level 3: Markdown Fetch Failure

If `useContent` classifies the response as missing — a real 404 **or** a `2xx + text/html` fallback response (§8.4) — `ContentPanel` renders `<NotFound />` in the content area. For other errors, it renders a generic error message with a retry button that re-triggers the fetch.

### What Is Never Allowed

- Unhandled Promise rejections
- React rendering crashes due to null/undefined data (all data access is guarded with optional chaining or loading checks)
- Blank white screens — every loading and error state has a rendered UI
- Rendering a fallback `index.html` body as if it were Markdown

---

## 11. Markdown Authoring Rules

Normative. Every `.md` content file complies with **all** of the following. This section plus §13 is the complete authoring reference — an author needs nothing else.

### 11.1 Frontmatter

Every file starts (at byte 0) with a YAML frontmatter block:

```markdown
---
title: "Page Title"
description: "One-sentence description. Used for future search indexing."
tags: [tag1, tag2, tag3]
---
```

| Field | Required | Rules |
|---|---|---|
| `title` | yes | Must equal the `title` in this page's manifest entry, character for character. The manifest is the runtime source of truth (ADR-009); the frontmatter copy exists for future build-time tooling (§15.1). |
| `description` | yes | One sentence. |
| `tags` | no | Lowercase keywords. Strongly recommended — feeds future search (§15.1). |

Frontmatter is stripped at render time by `remark-frontmatter` and is never parsed by the running app (ADR-009). Divergence between the manifest title and the frontmatter title is an authoring bug.

### 11.2 Headings

- **No `#` (H1) anywhere in the body.** The H1 is rendered by `ContentPanel` from the manifest title (§7.4).
- The body starts at `##`. Never skip levels (`##` → `###` → `####`).
- Heading ids are auto-generated by rehype-slug using GitHub's slug algorithm: lowercase, spaces become hyphens, punctuation is dropped. `## Viewing File Content` → id `viewing-file-content`. These ids are the anchor targets for §11.4.

### 11.3 Images & Co-located Assets

- Store the asset in the same folder as the `.md` file (§4).
- Reference it relatively: `![Directory tree](./directory-tree.png)`. The `./` prefix is optional but recommended.
- **Never** use site-absolute paths (`/content/...`) — they bypass the resolver (§7.4) and break under subpath deployment (§14.4).
- External images via a full `https://` URL are allowed.

### 11.4 Links

| To link to... | Write | Example |
|---|---|---|
| Another page in the portal | Root-relative app URL — no `.md` suffix, no base prefix | `[Processes](/linux/processes)` |
| A heading on the same page | `#` + rehype-slug id | `[see below](#file-permissions)` |
| A heading on another page | App URL + hash | `[signals](/linux/processes#signals)` |
| An external site | Full URL | `[Docker docs](https://docs.docker.com)` |

Relative links between Markdown files (`../processes/processes.md`) are **forbidden** — the URL space and the file tree are different trees, and such links are broken by construction (ADR-010).

### 11.5 Code Blocks

- Always fenced, always with an explicit language tag (` ```bash `, ` ```yaml `, ` ```plaintext ` for raw terminal output, etc.).
- Available tags = the highlight.js *common* set + whatever grammars the project has registered in §2.3. A tag outside that set renders unhighlighted — harmless, but the correct fix is to register the grammar (§2.3), not to drop the tag.
- Indented (non-fenced) code blocks are forbidden.

### 11.6 Raw HTML

Forbidden. It is not rendered (ADR-011). Everything must be expressible in GitHub Flavored Markdown — tables, task lists, and strikethrough are all available via remark-gfm.

### 11.7 Reference Template

````markdown
---
title: "Navigation"
description: "Moving around the Linux filesystem from the shell."
tags: [linux, filesystem, cd, ls]
---

## Where Am I?

Body text starts at H2 because the H1 comes from the manifest.

```bash
pwd
ls -la
```

## The Directory Tree

![Directory tree](./directory-tree.png)

Related reading: [file operations](/linux/files-filesystem/operations),
and the [permissions section](#permissions) below.

## Permissions

| Symbol | Meaning |
|---|---|
| `r` | read |
| `w` | write |
````

---

## 12. Naming Conventions

These conventions are enforced across all files, folders, and IDs. Consistency here is what allows fetch paths to be derived mechanically from URLs.

| Thing | Convention | Example |
|---|---|---|
| Folder names | lowercase, hyphens | `files-filesystem` |
| Manifest `id` fields | lowercase, hyphens | `"viewing-file-content"` |
| Markdown file names | same as parent folder name | `navigation.md` inside `navigation/` |
| React component files | PascalCase | `ContentPanel.jsx` |
| Hook files | camelCase, `use` prefix | `useManifest.js` |
| CSS class names | kebab-case | `.sidebar-section-header` |
| URL segments | lowercase, hyphens | `/linux/files-filesystem/navigation` |
| Heading anchors | generated by rehype-slug (GitHub slugger) — never hand-written | `#viewing-file-content` |

**Critical rule:** A manifest `id` must exactly match its folder name, and the Markdown file inside that folder must be named `{id}.md`. Any deviation breaks the fetch path derivation.

---

## 13. Adding New Content

No code changes are ever required to add content. The steps depend only on what you are adding. Every new `.md` file must follow §11.

### Adding a sub-page to an existing `type: "section"` section

1. Create folder: `public/content/{topicId}/{sectionId}/{pageId}/`
2. Create file: `{pageId}.md` inside that folder
3. Add entry to `public/content/{topicId}/{sectionId}/manifest.json`, including an `order` value that places it where intended

### Adding a new section to an existing topic

**If the section is a single page** (`type: "page"`):

1. Create folder: `public/content/{topicId}/{sectionId}/`
2. Create file: `{sectionId}.md` inside that folder
3. Add entry to `public/content/{topicId}/manifest.json` with `"type": "page"` and an `order` value

**If the section has sub-pages** (`type: "section"`):

1. Create folder: `public/content/{topicId}/{sectionId}/`
2. Create `manifest.json` inside it listing sub-pages (each with an `order`)
3. Create sub-page folders and `.md` files inside
4. Add entry to `public/content/{topicId}/manifest.json` with `"type": "section"` and an `order` value

### Adding a new topic with sections (`type: "topic"`)

1. Create folder: `public/content/{topicId}/`
2. Create `manifest.json` listing sections (each with `"type": "page"` or `"type": "section"` and an `order`)
3. Create section folders, and sub-page folders where applicable, with `.md` files throughout
4. Add entry to `public/content/manifest.json` with `"type": "topic"` and an `order` value

### Adding a new standalone topic (`type: "page"`)

1. Create folder: `public/content/{topicId}/`
2. Create file: `{topicId}.md` inside that folder
3. Add entry to `public/content/manifest.json` with `"type": "page"` and an `order` value

### Markdown File Structure

Defined normatively in §11. The frontmatter block is required; the body starts at `##`.

### Pre-flight Checklist (Every Content Addition)

- [ ] Folder name = manifest `id` = `.md` filename (§12 critical rule)
- [ ] `type` declared explicitly in the parent manifest (ADR-008)
- [ ] `order` set; entry sorts where intended
- [ ] Frontmatter present; `title` matches the manifest `title` exactly (§11.1)
- [ ] Body starts at `##`; no `#` H1 anywhere (§11.2)
- [ ] Images relative and co-located (§11.3); links follow §11.4
- [ ] `npm run dev` → open the new page **via the sidebar** and **via a direct deep-link URL**; both must render

---

## 14. Build & Deployment

### 14.1 Build

`npm run build` produces `dist/`. Vite copies `public/` into `dist/` verbatim, so `dist/content/**` ships with every build. `npm run preview` serves the built output locally with SPA fallback behaviour — always smoke-test with it before deploying.

### 14.2 The Deep-Link Requirement

This is an SPA: `/linux/processes` is a route, not a file on disk. **Every production host must rewrite unknown paths to `index.html`**, or every deep link, bookmark, and page refresh returns a server 404.

| Host | Configuration |
|---|---|
| Netlify | File `public/_redirects` containing the single line `/*    /index.html    200` (Vite copies it into `dist/` automatically). Existing files are served before the rewrite applies. |
| Vercel | `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. Static files on disk are served before rewrites. |
| Nginx | `location / { try_files $uri $uri/ /index.html; }` |
| GitHub Pages | No rewrite support. Post-build, copy `dist/index.html` to `dist/404.html`; the 404 page boots the SPA, and the router resolves the URL. Also apply §14.4. |

### 14.3 Consequence of the Rewrite

With any of the configurations above, a request for a **missing** file under `content/` no longer returns 404 — it returns `200` with `index.html` as the body. This is exactly why §8.4 / ADR-013 classifies `2xx + text/html` responses as "not found." Do not remove that check; without it, missing pages render `index.html` as Markdown in production while working "fine" in dev.

### 14.4 Subpath Deployment (e.g. GitHub Pages Project Sites)

Set the base in `vite.config.js`:

```js
export default defineConfig({ base: '/<repo-name>/' })
```

Nothing else changes: all fetch paths, asset rewrites, and the router basename already derive from `import.meta.env.BASE_URL` (§6 base path rule). Root-domain hosts keep the default `base: '/'`.

### 14.5 Cache Headers

| Asset | Header | Why |
|---|---|---|
| `assets/*` (hashed JS/CSS) | `Cache-Control: public, max-age=31536000, immutable` | Filenames are content-hashed; safe to cache forever |
| `index.html` | `no-cache` | Must always revalidate to pick up new builds |
| `content/**` (manifests, `.md`, images) | `no-cache` | These filenames are **not** content-hashed; long-lived caching would pin users to stale content |

### 14.6 Updating Content on a Deployed Site

ADR-003's "no rebuild" means no code compilation is required — but files must still reach the host. Two sanctioned paths:

1. **Default:** edit content → commit → run the normal build + deploy pipeline. The rebuild is fast, and content-only diffs are risk-free.
2. **Direct sync** (object-storage/CDN hosts only): upload changed files under `content/` straight into the deployed static directory. Valid precisely because content is never processed at build time.

---

## 15. Future Extensions (Non-Binding)

Nothing in this section is a commitment. Each item requires its own ADR before implementation. The section exists so today's decisions don't foreclose tomorrow's features — and to record which of today's rules exist *for* tomorrow.

### 15.1 Search

Frontmatter (`title`, `description`, `tags` — §11.1) is mandatory **today** precisely so that a build-time script can later walk `public/content/**`, parse frontmatter and headings, and emit `public/search-index.json` for a client-side search UI. No runtime change and no content-schema change would be needed.

### 15.2 Quizzes

Reserved pattern: a page folder may later gain a sibling file (e.g. `quiz.json`), and manifest entries may gain an optional flag (e.g. `"quiz": true`) to surface it in the UI. Universal manifest rule 3 (§5) already guarantees the current app ignores such fields, so quiz-enabled content will not break older deployments.

### 15.3 Labs

Expected to live in external environments (hosted sandboxes, cloud playgrounds) and be linked from pages as ordinary external links (§11.4). No in-app execution environment is anticipated; if that changes, it is a new architecture document, not an amendment.

---

## 16. Architectural Decision Log

This section records why key decisions were made, so future developers (human or AI) do not re-litigate them without understanding the reasoning.

### ADR-001: Markdown over JSON for content

**Decision:** Content files are Markdown, not JSON.
**Reason:** Content is authored by humans. JSON is painful to write and maintain for long-form text. Markdown is the industry standard for technical documentation. YAML frontmatter provides structured metadata without sacrificing readability. JSON would require concatenating fields for search; Markdown is plain text by default.

### ADR-002: Distributed manifests over a single manifest

**Decision:** Each topic and section has its own `manifest.json` rather than one global manifest.
**Reason:** A single root manifest would grow large and must be loaded in full before anything renders. Distributed manifests enable lazy loading — only the manifest for the current topic or section is fetched. Adding content to one section does not require editing a global file, reducing merge conflicts in collaborative workflows.

### ADR-003: Content in `public/` not `src/`

**Decision:** All content lives under `public/content/`, served as static files.
**Reason:** Content in `src/` would be processed by Vite at build time (imported as modules). Content in `public/` is served verbatim and fetched at runtime via `fetch()`. This keeps content and code fully decoupled — content can be updated without triggering a rebuild.
**Clarified in v1.3:** "no rebuild" means no code compilation. Deploying updated content still requires shipping the files to the host — see §14.6 for the two sanctioned paths.

### ADR-004: react-markdown over MDX

**Decision:** Runtime rendering with `react-markdown`, not build-time MDX.
**Reason:** MDX embeds React components inside Markdown, which requires a build-time transform and couples content to the code layer. Content authors would need to understand React. `react-markdown` renders arbitrary Markdown fetched at runtime with no build step involvement. MDX can be adopted later for specific advanced pages if needed.

### ADR-005: Module-level cache over React Query or SWR

**Decision:** Simple module-level `Map` for caching fetched content, not a library.
**Reason:** The fetching pattern here is simple: fetch once, cache forever (content doesn't change during a session). A full data-fetching library adds dependency weight and API surface for no benefit at this scale. The `Map` stores in-flight promises to deduplicate concurrent requests (§8.3). The cache strategy can be upgraded if requirements change.

### ADR-006: URL routing with react-router-dom

**Decision:** All pages have shareable URLs via react-router-dom v6.
**Reason:** Documentation links must be shareable and bookmarkable. In-memory navigation state would make it impossible to link to a specific page or use browser back/forward correctly. The URL structure mirrors the folder structure exactly, making it self-documenting and easy to reason about.

### ADR-007: Sidebar does not display the topic title

**Decision:** The sidebar omits the topic title (e.g., "Linux") when inside a topic view.
**Reason:** The user clicked into the topic — they already know which topic they're in. The title in the sidebar would be redundant and consume vertical space. The topic context is communicated via the top navigation bar rendered by `App`.

### ADR-008: Explicit `type` field in manifests over implicit file-system signals

**Decision:** Whether a section is a single page or has sub-pages is declared via `"type": "page"` or `"type": "section"` in the topic manifest — not inferred from the presence or absence of a section `manifest.json` on disk.
**Reason:** Relying on the absence of a file as a signal is fragile. If a developer forgets to create a section manifest, the section would silently render as a single page instead of failing visibly. An explicit `type` field makes intent unambiguous, is self-documenting, and makes mismatches between the manifest declaration and the folder contents an obvious error rather than silent fallback behaviour.

### ADR-009: Frontmatter is stripped at render time; manifests are the runtime source of titles

**Decision:** `remark-frontmatter` is in the plugin stack; `ContentPanel` renders the page `<h1>` from the manifest `title`; the running app never parses YAML.
**Reason:** Without `remark-frontmatter`, react-markdown renders the metadata block as visible text at the top of every page — the v1.2 stack had this bug latent in the spec. Parsing YAML in the browser would add a dependency to obtain data the manifest already carries. Frontmatter remains mandatory as the input for future build-time tooling (§15.1). The title deliberately lives in two places; §11.1 makes the manifest authoritative and any divergence an authoring bug.

### ADR-010: Relative asset paths and a fixed link contract, resolved by the renderer

**Decision:** Images use relative paths that `ContentPanel` rewrites against the page's content folder; internal links use root-relative app URLs mapped to client-side `<Link>` navigation; relative links between Markdown files are forbidden.
**Reason:** The URL space (`/linux/.../navigation`) and the file space (`/content/linux/.../navigation/...`) are different trees, so native browser resolution of relative URLs is wrong by construction — unresolved, every co-located image 404s. Rewriting in exactly one place (the renderer) keeps authoring portable — relative images even preview correctly in Git hosting UIs — while root-relative app links keep navigation client-side with no full page reloads.

### ADR-011: Raw HTML in Markdown is disabled

**Decision:** `rehype-raw` is deliberately absent; §11.6 forbids authoring HTML.
**Reason:** Rendering raw HTML creates a sanitization burden and an XSS surface the moment content has more than one author. Pure GFM keeps rendering consistent, keeps content portable to any future renderer, and costs nothing — tables and task lists are already covered by remark-gfm.

### ADR-012: Uniform explicit `order` in every manifest, including the root

**Decision:** All manifests require an integer `order`; display sorts ascending; ties resolve by array position; value gaps are encouraged.
**Reason:** v1.2 used `order` in topic and section manifests but implicit array position at the root — two rules for one concept. A single rule is cheaper to hold in memory and to enforce. Explicit `order` also extends ADR-002's merge-friendliness: appending an entry with a suitable `order` value never forces edits to neighbouring entries.

### ADR-013: SPA-fallback-aware missing-content detection

**Decision:** The fetch hooks classify `2xx` responses whose `Content-Type` contains `text/html` as "not found," alongside real 404s.
**Reason:** The rewrites required by §14.2 make missing static files return `200` + `index.html` on every recommended host. A status-only check would pipe that HTML into the Markdown renderer. Inspecting the content type is the cheapest reliable signal that the asset did not exist. The dev server returns real 404s for missing `public/` files, which is precisely why this failure class only appears in production if unhandled.

---

## 17. Revision History

| Version | Date | Summary |
|---|---|---|
| 1.3 | 2026-07-05 | Fixed three latent spec bugs: frontmatter would have rendered as visible text (remark-frontmatter added, ADR-009); relative image paths would have 404'd (renderer-side asset resolution, ADR-010); missing files return `200 + HTML` behind SPA rewrites in production (content-type-aware detection, ADR-013). Defined previously unspecified behaviour: section-landing redirect and depth invariants (§6), base-path rule for subpath deploys (§6, §14.4), document titles, layout variants and responsive sidebar (§7.1), scroll rules (§9). Unified `order` across all manifests incl. root (ADR-012) and added universal manifest rules (§5). Banned raw HTML (ADR-011). Added syntax-highlighting setup — theme import and grammar-registration mechanism only; grammar choice stays a content decision (§2.3) — normative authoring rules (§11), pre-flight checklist (§13), Build & Deployment (§14), and non-binding future extensions for search/quizzes/labs (§15). |
| 1.2 | — | Last approved version prior to this revision. |
