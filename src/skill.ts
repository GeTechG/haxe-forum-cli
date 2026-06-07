import { promises as fs, existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline";
import chalk from "chalk";

/** A place an AI agent looks for skills/rules, relative to the project root. */
export interface SkillTarget {
  id: string;
  label: string;
  /** Destination for the skill file, relative to the project root. */
  dest: string;
}

/**
 * Where each supported agent expects project-local instructions. The same
 * `SKILL.md` is copied verbatim — its Markdown (frontmatter included) is valid
 * for every agent; only the destination path differs.
 */
export const TARGETS: SkillTarget[] = [
  { id: "claude", label: "Claude Code", dest: ".claude/skills/haxe-forum/SKILL.md" },
  { id: "codex", label: "OpenAI Codex", dest: ".codex/skills/haxe-forum/SKILL.md" },
  { id: "cursor", label: "Cursor", dest: ".cursor/rules/haxe-forum.md" },
  { id: "gemini", label: "Gemini CLI", dest: ".gemini/skills/haxe-forum/SKILL.md" },
  { id: "windsurf", label: "Windsurf", dest: ".windsurf/skills/haxe-forum/SKILL.md" },
];

const here = path.dirname(fileURLToPath(import.meta.url));

/** Locate the bundled source skill (ships in the npm package and the repo). */
function locateSkillSource(): string {
  const candidates = [
    // dist/skill.js -> package root, or src/skill.ts -> repo root
    path.resolve(here, "../.claude/skills/haxe-forum/SKILL.md"),
    path.resolve(here, "../../.claude/skills/haxe-forum/SKILL.md"),
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

export interface InstallResult {
  target: SkillTarget;
  /** Absolute path written (or that would have been written). */
  path: string;
  /** "written", "skipped" (already present, no --force), or "created-dir". */
  status: "written" | "skipped";
}

/** Copy the skill into one target inside `cwd`. */
export async function installSkill(
  target: SkillTarget,
  opts: { force?: boolean; cwd?: string } = {}
): Promise<InstallResult> {
  const cwd = opts.cwd ?? process.cwd();
  const source = locateSkillSource();
  let content: string;
  try {
    content = await fs.readFile(source, "utf8");
  } catch {
    throw new Error(
      `Could not find the bundled skill at ${source}. Reinstall hxf or run from the repo.`
    );
  }
  const dest = path.resolve(cwd, target.dest);

  let exists = false;
  try {
    await fs.access(dest);
    exists = true;
  } catch {
    /* not there — fine */
  }
  if (exists && !opts.force) {
    return { target, path: dest, status: "skipped" };
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content, "utf8");
  return { target, path: dest, status: "written" };
}

/** Resolve an agent id (case-insensitive) to a target, or null. */
export function findTarget(id: string): SkillTarget | null {
  const needle = id.trim().toLowerCase();
  return TARGETS.find((t) => t.id === needle) ?? null;
}

interface MenuItem {
  label: string;
  hint?: string;
}

/**
 * Render an arrow-key menu and resolve the chosen index, or `null` if the user
 * cancels (Esc / q / Ctrl-C). Returns `null` immediately when stdin is not a TTY.
 */
export function selectMenu(title: string, items: MenuItem[]): Promise<number | null> {
  const stdin = process.stdin;
  const stdout = process.stdout;
  if (!stdin.isTTY) return Promise.resolve(null);

  stdout.write(chalk.bold(title) + "\n");
  stdout.write(chalk.dim("Use ↑/↓ to move, Enter to select, Esc to cancel.\n"));

  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();

  let index = 0;
  let rendered = 0;

  const draw = () => {
    if (rendered > 0) readline.moveCursor(stdout, 0, -rendered);
    readline.cursorTo(stdout, 0);
    readline.clearScreenDown(stdout);
    const lines = items.map((it, i) => {
      const active = i === index;
      const pointer = active ? chalk.hex("#FA8C00")("❯") : " ";
      const label = active ? chalk.bold(it.label) : it.label;
      const hint = it.hint ? chalk.dim(`  ${it.hint}`) : "";
      return `${pointer} ${label}${hint}`;
    });
    stdout.write(lines.join("\n") + "\n");
    rendered = lines.length;
  };

  draw();

  return new Promise((resolve) => {
    const cleanup = () => {
      stdin.off("keypress", onKey);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    };
    const onKey = (_str: string, key: readline.Key | undefined) => {
      if (!key) return;
      if (key.name === "up" || key.name === "k") {
        index = (index - 1 + items.length) % items.length;
        draw();
      } else if (key.name === "down" || key.name === "j") {
        index = (index + 1) % items.length;
        draw();
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(index);
      } else if (key.name === "escape" || key.name === "q" || (key.ctrl && key.name === "c")) {
        cleanup();
        resolve(null);
      }
    };
    stdin.on("keypress", onKey);
  });
}
