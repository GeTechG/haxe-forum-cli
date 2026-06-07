---
name: haxe-forum
description: Search and read the Haxe community forum (community.haxe.org) via the `hxf` CLI. Use when answering Haxe programming questions that may have community discussion — macros, build config, libraries, target-specific issues, idioms — or when the user wants forum threads, accepted answers, or citations from community.haxe.org.
---

# Haxe forum search & read

Use the `hxf` CLI to query the public Haxe community forum (a Discourse instance).
No API key is needed. Always use `--json` for parsing or `--md` for readable text.

## Commands

```bash
hxf search "<keywords>" --json --limit 5   # find threads -> id, title, url, blurb, tags
hxf read <id> --json --all                 # read a whole thread (post bodies as Markdown)
hxf read <id> --md                         # whole thread as Markdown
hxf latest --json                          # newest topics
hxf category --json                        # list categories
hxf category <slug> --json                 # topics in a category
```

If `hxf` is not installed globally, run `node dist/cli.js <args>` from the repo
(after `npm run build`) or `npm run dev -- <args>`.

## Workflow

1. `hxf search "<question keywords>" --json --limit 5`
2. Choose the best `id` (prefer more `likes` / `posts_count`).
3. `hxf read <id> --json --all`; look for posts with `"accepted_answer": true` first.
4. Answer the user and cite the thread `url`.

## Output schemas & full reference

See `AGENTS.md` at the repo root for the complete `--json` schemas and tips
(Discourse search operators, `HAXE_FORUM_URL` override, etc.).

## Etiquette

It hits a public community API — keep `--limit` small and don't poll in tight loops.
