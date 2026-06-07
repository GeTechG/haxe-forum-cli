# haxe-forum-cli (`hxf`)

A small command-line tool to **search and read the [Haxe community forum](https://community.haxe.org/)** right from your terminal.

The forum runs on [Discourse](https://www.discourse.org/), which exposes a public read-only JSON API — so this tool needs no login, no API key, and no scraping.

## Install

```bash
npm install        # install dependencies
npm run build      # compile TypeScript -> dist/
npm link           # (optional) make the `hxf` command available globally
```

Without `npm link` you can run it via `node dist/cli.js <command>` or `npm run dev -- <command>`.

Requires Node.js 18+ (uses the built-in `fetch`).

## Usage

```bash
hxf search <query...>      # search topics
hxf read <topicId>         # read a topic and its replies
hxf latest                 # newest topics
hxf category [slugOrId]    # list categories, or topics in a category
```

### Examples

```bash
hxf search build macro              # search for "build macro"
hxf search "abstract enum" -l 5     # limit to 5 results
hxf read 3556                       # read topic #3556 (first 20 posts)
hxf read 3556 --all                 # read the whole thread
hxf read 3556 --page 2              # read the next page of posts
hxf latest -l 20                    # 20 most recent topics
hxf category                        # list all categories
hxf category haxe                   # topics in the "haxe" category
```

### Common options

| Option            | Commands               | Meaning                                  |
| ----------------- | ---------------------- | ---------------------------------------- |
| `-l, --limit <n>` | search/latest/category | max results to show                      |
| `-p, --page <n>`  | search/read            | page of results / thread                 |
| `--all`           | read                   | fetch every post in the thread           |
| `--json`          | all                    | normalized, compact JSON (for scripting) |
| `--md`            | all                    | clean Markdown output                    |

## Agent / scripting friendly

The tool is designed to be consumed by LLM agents and scripts, not just humans:

- **`--json`** emits a **normalized, compact** schema (only the useful fields,
  with resolved `url`s and string `tags`) — not the raw, noisy Discourse dump.
  Post bodies come back as **Markdown**, not HTML.
- **`--md`** prints clean Markdown with real ` ```haxe ` code fences — ideal to
  paste straight into an LLM context.
- **No color or decorative hints when piped.** Output auto-detects a TTY
  (honors `NO_COLOR`); footers like "Read a topic with: …" are shown only to
  interactive users, so piped output stays clean.
- **Errors are structured.** With `--json`, failures print `{"error": "..."}`
  and exit non-zero, so callers can branch on it.

```bash
hxf search macros --json | jq -r '.results[] | "\(.id)\t\(.title)"'
hxf read 3556 --json | jq -r '.posts[] | select(.accepted_answer) | .content'
hxf read 3556 --md          # full thread as Markdown for an LLM
```

### JSON shapes

```jsonc
// hxf search <q> --json
{ "query": "macros", "count": 2,
  "results": [ { "id": 3556, "title": "...", "url": "...", "posts_count": 2,
                 "likes": 0, "views": 387, "created_at": "...",
                 "last_posted_at": "...", "tags": ["macro"], "blurb": "..." } ] }

// hxf read <id> --json
{ "id": 3556, "title": "...", "url": "...", "posts_count": 2, "views": 387,
  "tags": ["macro"], "created_by": "Geokureli",
  "posts_shown": 2, "total_posts": 2,
  "posts": [ { "number": 1, "username": "Geokureli", "created_at": "...",
               "likes": 0, "accepted_answer": false, "content": "<markdown>" } ] }
```

## Configuration

By default the tool targets `https://community.haxe.org`. Point it at another
Discourse instance with an environment variable:

```bash
HAXE_FORUM_URL=https://meta.discourse.org hxf latest
```

## How it works

| Feature   | Endpoint                          |
| --------- | --------------------------------- |
| search    | `GET /search.json?q=...`          |
| read      | `GET /t/{id}.json`                |
| latest    | `GET /latest.json`                |
| category  | `GET /categories.json`, `/c/{slug}.json` |

Post bodies (Discourse "cooked" HTML) are rendered to colored terminal text,
preserving code blocks, quotes, lists, and links.

## Project layout

```
src/
  api.ts      # Discourse JSON API client
  render.ts   # HTML -> colored terminal text
  format.ts   # dates, tags, headings
  cli.ts      # commander commands & output
```

## License

MIT
