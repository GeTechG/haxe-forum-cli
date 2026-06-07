import chalk from "chalk";

/** Human-friendly relative time, e.g. "3d ago", "2mo ago". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [30, "d"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];
  let value = sec;
  let unit = "s";
  for (const [div, name] of units) {
    if (value < div) {
      unit = name;
      break;
    }
    value = Math.floor(value / div);
    unit = name;
  }
  return `${value}${unit} ago`;
}

export function terminalWidth(): number {
  return Math.min(process.stdout.columns || 80, 100);
}

export function heading(text: string): string {
  return chalk.bold.hex("#FA8C00")(text); // Haxe orange
}

export function badge(text: string): string {
  return chalk.bgHex("#FA8C00").black(` ${text} `);
}

/**
 * Discourse returns tags as plain strings in topic lists but as
 * `{name, slug}` objects in search results — normalize both.
 */
export function formatTags(tags: unknown): string | null {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const names = tags
    .map((t) => (typeof t === "string" ? t : t && typeof t === "object" ? (t as any).name : null))
    .filter((n): n is string => Boolean(n));
  return names.length ? names.map((n) => `#${n}`).join(" ") : null;
}
