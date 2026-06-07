#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import {
  search,
  getTopic,
  getLatest,
  getCategories,
  getCategoryTopics,
  getPostsByIds,
  topicUrl,
  type Post,
} from "./api.js";
import { renderHtml, htmlToMarkdown } from "./render.js";
import { relativeTime, terminalWidth, heading, badge, formatTags } from "./format.js";
import {
  normalizeSearch,
  normalizeTopic,
  normalizeTopicListItem,
  normalizeCategory,
  type TopicSummary,
} from "./normalize.js";

const program = new Command();

program
  .name("hxf")
  .description("Search and read the Haxe community forum (community.haxe.org)")
  .version("0.1.0");

const isTTY = Boolean(process.stdout.isTTY);

/** Print JSON in a stable, parse-friendly way. */
function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/** Decorative hints/footers — only useful for humans at a terminal. */
function hint(text: string): void {
  if (isTTY) console.log(chalk.dim(text));
}

/** True when the user asked for machine-readable output. */
function wantsJson(opts: { json?: boolean }): boolean {
  return Boolean(opts.json);
}

function fail(err: unknown, asJson = false): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (asJson) {
    printJson({ error: msg });
  } else {
    console.error(chalk.red("Error: ") + msg);
  }
  process.exit(1);
}

// ---- search ----
program
  .command("search <query...>")
  .description("Search the forum for topics matching a query")
  .option("-l, --limit <n>", "max number of results", "15")
  .option("-p, --page <n>", "results page", "1")
  .option("--json", "output normalized JSON")
  .option("--md", "output Markdown")
  .action(async (queryParts: string[], opts) => {
    try {
      const query = queryParts.join(" ");
      const res = await search(query, Number(opts.page));
      const normalized = normalizeSearch(res);
      normalized.query = normalized.query || query;
      const limit = Number(opts.limit);
      normalized.results = normalized.results.slice(0, limit);
      normalized.count = normalized.results.length;

      if (wantsJson(opts)) return printJson(normalized);
      if (opts.md) return console.log(searchToMarkdown(normalized));

      if (normalized.results.length === 0) {
        console.log(chalk.yellow(`No results for "${query}".`));
        return;
      }
      console.log(heading(`\nResults for "${query}":\n`));
      normalized.results.forEach((t, i) => {
        console.log(`${chalk.dim(`${i + 1}.`)} ${chalk.bold(t.title)} ${chalk.dim(`#${t.id}`)}`);
        console.log("   " + chalk.dim(summaryMeta(t)));
        if (t.blurb) console.log("   " + chalk.gray(t.blurb.slice(0, 160)));
        console.log();
      });
      hint("Read a topic with:  hxf read <id>");
    } catch (e) {
      fail(e, wantsJson(opts));
    }
  });

// ---- read ----
program
  .command("read <topicId>")
  .description("Read a topic and its replies")
  .option("-p, --page <n>", "page of the topic (20 posts per page)", "1")
  .option("-l, --limit <n>", "max posts to show")
  .option("--all", "fetch the entire thread (may make several requests)")
  .option("--json", "output normalized JSON (post bodies as Markdown)")
  .option("--md", "output Markdown")
  .action(async (topicId: string, opts) => {
    try {
      const id = Number(topicId);
      const topic = await getTopic(id, Number(opts.page));
      let posts: Post[] = topic.post_stream.posts;

      if (opts.all) {
        const have = new Set(posts.map((p) => p.id));
        const missing = topic.post_stream.stream.filter((pid) => !have.has(pid));
        for (let i = 0; i < missing.length; i += 50) {
          const chunk = missing.slice(i, i + 50);
          const extra = await getPostsByIds(id, chunk);
          posts = posts.concat(extra.post_stream.posts);
        }
        posts.sort((a, b) => a.post_number - b.post_number);
      }

      if (opts.limit) posts = posts.slice(0, Number(opts.limit));

      if (wantsJson(opts)) return printJson(normalizeTopic(topic, posts));
      if (opts.md) return console.log(topicToMarkdown(topic, posts));

      const width = terminalWidth();
      console.log();
      console.log(heading(topic.fancy_title ?? topic.title));
      const head = [
        `#${topic.id}`,
        `${topic.posts_count} posts`,
        topic.views ? `${topic.views} views` : null,
        formatTags(topic.tags),
      ]
        .filter(Boolean)
        .join(chalk.dim(" · "));
      console.log(chalk.dim(head));
      console.log(chalk.dim(topicUrl(topic.id)));
      console.log(chalk.dim("─".repeat(Math.min(width, 80))));

      for (const post of posts) {
        const num = chalk.dim(`#${post.post_number}`);
        const who = chalk.bold.cyan(post.username);
        const when = chalk.dim(relativeTime(post.created_at));
        const likes = post.like_count ? chalk.red(` ♥ ${post.like_count}`) : "";
        const solved = post.accepted_answer ? " " + badge("✓ ANSWER") : "";
        console.log(`\n${who} ${num} ${when}${likes}${solved}`);
        console.log(renderHtml(post.cooked, width));
      }

      const shown = posts.length;
      if (!opts.all && topic.post_stream.stream.length > shown) {
        hint(
          `\n… ${topic.post_stream.stream.length - shown} more posts. Use --all or --page <n>.`
        );
      }
    } catch (e) {
      fail(e, wantsJson(opts));
    }
  });

// ---- latest ----
program
  .command("latest")
  .description("Show the latest topics")
  .option("-l, --limit <n>", "max number of results", "15")
  .option("--json", "output normalized JSON")
  .option("--md", "output Markdown")
  .action(async (opts) => {
    try {
      const res = await getLatest();
      const topics = res.topic_list.topics
        .slice(0, Number(opts.limit))
        .map(normalizeTopicListItem);
      if (wantsJson(opts)) return printJson({ count: topics.length, results: topics });
      if (opts.md) return console.log(topicListToMarkdown(topics, "Latest topics"));
      printTopicList(topics, "Latest topics");
    } catch (e) {
      fail(e, wantsJson(opts));
    }
  });

// ---- category ----
program
  .command("category [slugOrId]")
  .description("List categories, or topics within a category")
  .option("-l, --limit <n>", "max number of results", "15")
  .option("--json", "output normalized JSON")
  .option("--md", "output Markdown")
  .action(async (slugOrId: string | undefined, opts) => {
    try {
      if (!slugOrId) {
        const res = await getCategories();
        const cats = res.category_list.categories.map(normalizeCategory);
        if (wantsJson(opts)) return printJson({ count: cats.length, categories: cats });
        if (opts.md) {
          const lines = cats.map(
            (c) => `- **${c.name}** \`#${c.id}\` (\`${c.slug}\`, ${c.topic_count} topics)`
          );
          return console.log(`## Categories\n\n${lines.join("\n")}`);
        }
        console.log(heading("\nCategories:\n"));
        for (const c of cats) {
          console.log(`${chalk.bold(c.name)} ${chalk.dim(`#${c.id}`)}`);
          if (c.description) console.log("   " + chalk.gray(c.description.slice(0, 120)));
          console.log(
            "   " +
              chalk.dim([`${c.topic_count} topics`, c.slug].join(chalk.dim(" · "))) +
              "\n"
          );
        }
        hint("Browse one with:  hxf category <slug>");
        return;
      }
      const res = await getCategoryTopics(slugOrId);
      const topics = res.topic_list.topics
        .slice(0, Number(opts.limit))
        .map(normalizeTopicListItem);
      if (wantsJson(opts)) return printJson({ count: topics.length, results: topics });
      if (opts.md) return console.log(topicListToMarkdown(topics, `Topics in "${slugOrId}"`));
      printTopicList(topics, `Topics in "${slugOrId}"`);
    } catch (e) {
      fail(e, wantsJson(opts));
    }
  });

// ---- shared output helpers ----

function summaryMeta(t: TopicSummary): string {
  return [
    `${t.posts_count} ${t.posts_count === 1 ? "post" : "posts"}`,
    t.likes ? `♥ ${t.likes}` : null,
    t.views ? `${t.views} views` : null,
    relativeTime(t.last_posted_at ?? t.created_at),
    t.tags.length ? t.tags.map((x) => `#${x}`).join(" ") : null,
  ]
    .filter(Boolean)
    .join(chalk.dim(" · "));
}

function printTopicList(topics: TopicSummary[], label: string): void {
  if (!topics.length) {
    console.log(chalk.yellow("Nothing found."));
    return;
  }
  console.log(heading(`\n${label}:\n`));
  topics.forEach((t, i) => {
    console.log(`${chalk.dim(`${i + 1}.`)} ${chalk.bold(t.title)} ${chalk.dim(`#${t.id}`)}`);
    console.log("   " + chalk.dim(summaryMeta(t)) + "\n");
  });
  hint("Read a topic with:  hxf read <id>");
}

function searchToMarkdown(n: { query: string; results: TopicSummary[] }): string {
  if (!n.results.length) return `No results for "${n.query}".`;
  const lines = n.results.map((t) => {
    const meta = [`${t.posts_count} posts`, `${t.likes} likes`, `${t.views} views`]
      .filter(Boolean)
      .join(", ");
    const tags = t.tags.length ? ` _${t.tags.map((x) => `#${x}`).join(" ")}_` : "";
    const blurb = t.blurb ? `\n  ${t.blurb}` : "";
    return `- **${t.title}** (\`#${t.id}\`) — ${meta} — ${t.url}${tags}${blurb}`;
  });
  return `## Search: "${n.query}"\n\n${lines.join("\n")}`;
}

function topicListToMarkdown(topics: TopicSummary[], label: string): string {
  if (!topics.length) return "Nothing found.";
  const lines = topics.map(
    (t) => `- **${t.title}** (\`#${t.id}\`) — ${t.posts_count} posts, ${t.views} views — ${t.url}`
  );
  return `## ${label}\n\n${lines.join("\n")}`;
}

function topicToMarkdown(
  topic: { id: number; title: string; fancy_title?: string; posts_count: number; views?: number; tags?: unknown },
  posts: Post[]
): string {
  const out: string[] = [];
  out.push(`# ${topic.fancy_title ?? topic.title}`);
  const tags = formatTagsPlain(topic.tags);
  out.push(
    `_${topic.posts_count} posts · ${topic.views ?? 0} views${tags ? ` · ${tags}` : ""}_  \n${topicUrl(topic.id)}`
  );
  for (const p of posts) {
    const solved = p.accepted_answer ? " ✓ ACCEPTED ANSWER" : "";
    out.push(
      `---\n\n### ${p.username} · post #${p.post_number} · ${p.like_count ?? 0} likes${solved}\n\n${htmlToMarkdown(p.cooked)}`
    );
  }
  return out.join("\n\n");
}

function formatTagsPlain(tags: unknown): string | null {
  if (!Array.isArray(tags) || !tags.length) return null;
  const names = tags
    .map((t) => (typeof t === "string" ? t : t && typeof t === "object" ? (t as any).name : null))
    .filter(Boolean);
  return names.length ? names.map((n) => `#${n}`).join(" ") : null;
}

program.parseAsync(process.argv).catch((e) => fail(e));
