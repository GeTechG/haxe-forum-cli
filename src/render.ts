/**
 * Convert Discourse "cooked" HTML into readable, colored terminal text.
 * Kept intentionally small: handles the elements that actually appear in
 * forum posts (paragraphs, code, lists, quotes, links, emphasis).
 */
import chalk from "chalk";
import { parse, HTMLElement, Node, NodeType } from "node-html-parser";

const INDENT = "  ";

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

/** Render inline content (text + inline tags) to a single string. */
function renderInline(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return decodeEntities(node.rawText).replace(/\s+/g, " ");
  }
  if (!isElement(node)) return "";

  const el = node;
  const inner = el.childNodes.map(renderInline).join("");

  switch (el.tagName) {
    case "CODE":
      return chalk.cyan(inner);
    case "STRONG":
    case "B":
      return chalk.bold(inner);
    case "EM":
    case "I":
      return chalk.italic(inner);
    case "A": {
      const href = el.getAttribute("href") ?? "";
      if (href && href !== inner && !inner.includes(href)) {
        return `${chalk.underline(inner)} ${chalk.dim(`(${href})`)}`;
      }
      return chalk.underline(inner);
    }
    case "BR":
      return "\n";
    case "IMG": {
      const alt = el.getAttribute("alt") || el.getAttribute("title") || "image";
      return chalk.dim(`[img: ${alt}]`);
    }
    default:
      return inner;
  }
}

function wrap(text: string, width: number, indent = ""): string {
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let line = indent;
  for (const word of words) {
    if (word === "\n") {
      lines.push(line);
      line = indent;
      continue;
    }
    // strip ANSI for length calc
    const visibleLine = line.replace(/\[[0-9;]*m/g, "");
    const visibleWord = word.replace(/\[[0-9;]*m/g, "");
    if (visibleLine.length + visibleWord.length > width && visibleLine.trim()) {
      lines.push(line.replace(/\s+$/, ""));
      line = indent + (word.trim() ? word : "");
    } else {
      line += word;
    }
  }
  if (line.trim()) lines.push(line.replace(/\s+$/, ""));
  return lines.join("\n");
}

/** Render a block-level node, producing one or more lines. */
function renderBlock(node: Node, width: number): string {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const t = decodeEntities(node.rawText).trim();
    return t ? wrap(t.replace(/\s+/g, " "), width) : "";
  }
  if (!isElement(node)) return "";
  const el = node;

  switch (el.tagName) {
    case "PRE": {
      // node-html-parser keeps <pre> content as raw text (it doesn't parse the
      // inner <code> tag), so strip any tags ourselves before decoding.
      const raw = decodeEntities(
        el.rawText
          .replace(/<\/?code[^>]*>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\n$/, "")
      );
      const lines = raw.split("\n").map((l) => chalk.green(INDENT + "│ " + l));
      return lines.join("\n");
    }
    case "P":
      return wrap(el.childNodes.map(renderInline).join("").trim(), width);
    case "BLOCKQUOTE": {
      const inner = el.childNodes
        .map((c) => renderBlock(c, width - 2))
        .filter(Boolean)
        .join("\n");
      return inner
        .split("\n")
        .map((l) => chalk.dim("┃ ") + chalk.italic(l))
        .join("\n");
    }
    case "ASIDE": {
      // Discourse quote of another post
      const inner = el.childNodes
        .map((c) => renderBlock(c, width - 2))
        .filter(Boolean)
        .join("\n");
      return inner
        .split("\n")
        .map((l) => chalk.dim("┃ " + l.replace(/\[[0-9;]*m/g, "")))
        .join("\n");
    }
    case "UL":
    case "OL": {
      const items = el.querySelectorAll("li");
      return items
        .map((li, i) => {
          const bullet = el.tagName === "OL" ? `${i + 1}.` : "•";
          const content = li.childNodes.map(renderInline).join("").trim();
          return wrap(`${chalk.yellow(bullet)} ${content}`, width, "");
        })
        .join("\n");
    }
    case "H1":
    case "H2":
    case "H3":
    case "H4":
      return chalk.bold.underline(el.childNodes.map(renderInline).join("").trim());
    case "HR":
      return chalk.dim("─".repeat(Math.min(width, 60)));
    case "DIV":
    case "DETAILS":
      return el.childNodes
        .map((c) => renderBlock(c, width))
        .filter(Boolean)
        .join("\n\n");
    default: {
      const inline = el.childNodes.map(renderInline).join("").trim();
      return inline ? wrap(inline, width) : "";
    }
  }
}

export function renderHtml(html: string, width = 80): string {
  const root = parse(html);
  return root.childNodes
    .map((c) => renderBlock(c, width))
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
}

/** Strip HTML to plain text (used for short blurbs / one-liners). */
export function htmlToText(html: string): string {
  const root = parse(html);
  return decodeEntities(root.structuredText).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Markdown rendering (agent-friendly: clean text, real ```lang code fences)
// ---------------------------------------------------------------------------

function mdInline(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return decodeEntities(node.rawText).replace(/\s+/g, " ");
  }
  if (!isElement(node)) return "";
  const el = node;
  const inner = el.childNodes.map(mdInline).join("");
  switch (el.tagName) {
    case "CODE":
      return `\`${inner}\``;
    case "STRONG":
    case "B":
      return `**${inner}**`;
    case "EM":
    case "I":
      return `*${inner}*`;
    case "A": {
      const href = el.getAttribute("href") ?? "";
      return href ? `[${inner}](${href})` : inner;
    }
    case "BR":
      return "\n";
    case "IMG": {
      const alt = el.getAttribute("alt") || el.getAttribute("title") || "";
      const src = el.getAttribute("src") || "";
      return src ? `![${alt}](${src})` : `[img: ${alt}]`;
    }
    default:
      return inner;
  }
}

function mdBlock(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return decodeEntities(node.rawText).replace(/\s+/g, " ").trim();
  }
  if (!isElement(node)) return "";
  const el = node;
  switch (el.tagName) {
    case "PRE": {
      const langMatch = el.rawText.match(/class="[^"]*lang-([a-z0-9+#]+)/i);
      const lang = langMatch ? langMatch[1] : "";
      const code = decodeEntities(
        el.rawText
          .replace(/<\/?code[^>]*>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\n$/, "")
      );
      return "```" + lang + "\n" + code + "\n```";
    }
    case "P":
      return el.childNodes.map(mdInline).join("").trim();
    case "BLOCKQUOTE":
    case "ASIDE": {
      const inner = el.childNodes.map(mdBlock).filter(Boolean).join("\n\n");
      return inner
        .split("\n")
        .map((l) => "> " + l)
        .join("\n");
    }
    case "UL":
    case "OL":
      return el
        .querySelectorAll("li")
        .map((li, i) => {
          const bullet = el.tagName === "OL" ? `${i + 1}.` : "-";
          return `${bullet} ${li.childNodes.map(mdInline).join("").trim()}`;
        })
        .join("\n");
    case "H1":
      return `# ${el.childNodes.map(mdInline).join("").trim()}`;
    case "H2":
      return `## ${el.childNodes.map(mdInline).join("").trim()}`;
    case "H3":
      return `### ${el.childNodes.map(mdInline).join("").trim()}`;
    case "H4":
      return `#### ${el.childNodes.map(mdInline).join("").trim()}`;
    case "HR":
      return "---";
    case "DIV":
    case "DETAILS":
      return el.childNodes.map(mdBlock).filter(Boolean).join("\n\n");
    default: {
      const inline = el.childNodes.map(mdInline).join("").trim();
      return inline;
    }
  }
}

/** Convert Discourse "cooked" HTML to clean Markdown. */
export function htmlToMarkdown(html: string): string {
  const root = parse(html);
  return root.childNodes
    .map(mdBlock)
    .filter((s) => s.trim().length > 0)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
