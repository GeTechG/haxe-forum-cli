# CLAUDE.md

This project is `hxf` (haxe-forum-cli), a CLI to search and read the Haxe
community forum (community.haxe.org).

## Agent usage

The full agent-facing guide — when to use the tool, the exact commands, and the
`--json` output schemas — lives in **@AGENTS.md**. Read it before using `hxf`.

A reusable, agent-agnostic skill template lives at `skill/SKILL.md` (this is the
source `install-skill` copies into projects).

## Working on the code

- Source is TypeScript in `src/`, compiled to `dist/` with `npm run build`.
- `npm run dev -- <args>` runs the CLI without building (via `tsx`).
- Layout: `api.ts` (Discourse client), `render.ts` (HTML→terminal/Markdown),
  `normalize.ts` (raw API → compact JSON shapes), `format.ts` (dates/tags),
  `skill.ts` (`install-skill`: agent targets + arrow-key menu), `cli.ts`
  (commander commands & output).
- `install-skill` copies `skill/SKILL.md` into a project for a chosen agent (to
  each agent's own path, e.g. `.claude/skills/haxe-forum/SKILL.md` for Claude —
  see `TARGETS` in `skill.ts`). That source file ships in the npm package
  (`files` in `package.json`); keep it listed there or installs from npm break.
- Keep `--json` output **normalized and stable** — agents and scripts depend on
  the schema. It is documented in **two** places that must stay in sync: the
  full reference in `AGENTS.md`, and the self-contained copy in the installable
  `skill/SKILL.md`. If you change the schema, update both.
- `AGENTS.md` is the in-repo guide (agents.md convention) and is **not** shipped
  to projects via `install-skill` — only `skill/SKILL.md` is, so keep it
  self-contained.
