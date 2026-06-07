# Agent guide — `hxf` (haxe-forum-cli)

> This file is read by AI coding agents (OpenAI Codex, Cursor, Zed, Gemini CLI,
> Aider, and others that follow the [AGENTS.md](https://agents.md) convention).
> Claude Code reads `CLAUDE.md`, which imports this file. A Claude *Skill* lives
> in `.claude/skills/haxe-forum/SKILL.md`.

## What this tool does

`hxf` searches and reads the **Haxe community forum** (https://community.haxe.org,
a public Discourse instance) from the command line. Use it to answer Haxe
questions with real, cited community discussion — macros, build config,
libraries, target-specific issues, idioms, etc.

No API key or login is required (read-only public JSON API).

## When to use it (as an agent)

- The user asks a Haxe question that may have been discussed by the community.
- You need authoritative, real-world examples or accepted answers for Haxe.
- You want to cite a forum thread (`url` is included in every result).

## How to call it for machine consumption

**Always pass `--json`** when you will parse the output, or **`--md`** when you
want clean text to drop into your own context. Output has no ANSI colors when
piped, and errors print `{"error": "..."}` with a non-zero exit code.

```bash
# 1) Find relevant threads (compact JSON: id, title, url, blurb, tags, ...)
hxf search "build macro type expr" --json --limit 5

# 2) Read a thread; post bodies come back as Markdown
hxf read 3556 --json          # first page (20 posts)
hxf read 3556 --json --all    # entire thread
hxf read 3556 --md            # whole thread as Markdown, ready to read

# 3) Browse
hxf latest --json
hxf category --json           # list categories
hxf category haxe --json      # topics in a category
```

If `hxf` is not on `PATH`, run from the repo with `node dist/cli.js <args>`
(after `npm run build`) or `npm run dev -- <args>`.

## Output schemas

`search --json`:
```jsonc
{ "query": "...", "count": 5, "results": [
  { "id": 3556, "title": "...", "url": "https://community.haxe.org/t/3556",
    "posts_count": 2, "likes": 0, "views": 387,
    "created_at": "...", "last_posted_at": "...",
    "tags": ["macro"], "blurb": "first matching post, plain text" } ] }
```

`read --json`:
```jsonc
{ "id": 3556, "title": "...", "url": "...", "posts_count": 2, "views": 387,
  "tags": ["macro"], "created_by": "Geokureli",
  "posts_shown": 2, "total_posts": 2,
  "posts": [ { "number": 1, "username": "Geokureli", "created_at": "...",
               "likes": 0, "accepted_answer": false,
               "content": "post body as Markdown" } ] }
```

`latest --json` / `category <x> --json`: `{ "count": N, "results": [ <topic summary>, ... ] }`
`category --json` (no arg): `{ "count": N, "categories": [ { "id", "name", "slug", "topic_count", "description" }, ... ] }`

## Recommended agent workflow

1. `hxf search "<user question keywords>" --json --limit 5`
2. Pick the most relevant `id` (prefer higher `likes`/`posts_count`).
3. `hxf read <id> --json --all` and look for `"accepted_answer": true` posts first.
4. Answer the user, citing the thread `url`.

## Tips

- Search supports Discourse operators: `hxf search "macro tags:macro" ` etc.
- Quote multi-word queries, or pass them as multiple args — both work.
- Point at another Discourse forum with `HAXE_FORUM_URL=https://other.example`.
- Be a good citizen: prefer `--limit` and avoid hammering the public API in loops.
