# CLAUDE.md

This project is `hxf` (haxe-forum-cli), a CLI to search and read the Haxe
community forum (community.haxe.org).

## Agent usage

The full agent-facing guide — when to use the tool, the exact commands, and the
`--json` output schemas — lives in **@AGENTS.md**. Read it before using `hxf`.

A reusable Claude Skill is also available at
`.claude/skills/haxe-forum/SKILL.md`.

## Working on the code

- Source is TypeScript in `src/`, compiled to `dist/` with `npm run build`.
- `npm run dev -- <args>` runs the CLI without building (via `tsx`).
- Layout: `api.ts` (Discourse client), `render.ts` (HTML→terminal/Markdown),
  `normalize.ts` (raw API → compact JSON shapes), `format.ts` (dates/tags),
  `skill.ts` (`install-skill`: agent targets + arrow-key menu), `cli.ts`
  (commander commands & output).
- `install-skill` copies `.claude/skills/haxe-forum/SKILL.md` into a project for
  a chosen agent. That source file ships in the npm package (`files` in
  `package.json`); keep it listed there or installs from npm will break.
- Keep `--json` output **normalized and stable** — agents and scripts depend on
  the schema documented in `AGENTS.md`. If you change it, update that doc.
