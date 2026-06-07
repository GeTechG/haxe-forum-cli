/**
 * Convert raw Discourse API responses into compact, stable shapes that are
 * cheap to parse for agents/scripts — only the fields that matter, with
 * resolved URLs and normalized tags.
 */
import {
  topicUrl,
  type Post,
  type Topic,
  type SearchResult,
  type Category,
} from "./api.js";
import { htmlToMarkdown, htmlToText } from "./render.js";

function tagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (typeof t === "string" ? t : t && typeof t === "object" ? (t as any).name : null))
    .filter((n): n is string => Boolean(n));
}

export interface TopicSummary {
  id: number;
  title: string;
  url: string;
  posts_count: number;
  likes: number;
  views: number;
  created_at: string;
  last_posted_at: string | null;
  tags: string[];
  blurb?: string;
}

export function normalizeSearch(res: SearchResult): {
  query: string;
  count: number;
  results: TopicSummary[];
} {
  const blurbByTopic = new Map<number, string>();
  for (const p of res.posts ?? []) {
    if (!blurbByTopic.has(p.topic_id) && p.blurb) {
      blurbByTopic.set(p.topic_id, htmlToText(p.blurb));
    }
  }
  const results = (res.topics ?? []).map((t) => {
    const summary: TopicSummary = {
      id: t.id,
      title: t.fancy_title ?? t.title,
      url: topicUrl(t.id),
      posts_count: t.posts_count,
      likes: t.like_count ?? 0,
      views: t.views ?? 0,
      created_at: t.created_at,
      last_posted_at: t.last_posted_at ?? null,
      tags: tagNames(t.tags),
    };
    const blurb = blurbByTopic.get(t.id);
    if (blurb) summary.blurb = blurb;
    return summary;
  });
  return {
    query: res.grouped_search_result?.term ?? "",
    count: results.length,
    results,
  };
}

export function normalizeTopicListItem(t: any): TopicSummary {
  return {
    id: t.id,
    title: t.fancy_title ?? t.title,
    url: topicUrl(t.id),
    posts_count: t.posts_count,
    likes: t.like_count ?? 0,
    views: t.views ?? 0,
    created_at: t.created_at,
    last_posted_at: t.last_posted_at ?? null,
    tags: tagNames(t.tags),
  };
}

export interface PostJson {
  number: number;
  username: string;
  name?: string;
  created_at: string;
  likes: number;
  accepted_answer: boolean;
  content: string; // markdown
}

export function normalizePost(p: Post): PostJson {
  return {
    number: p.post_number,
    username: p.username,
    name: p.name || undefined,
    created_at: p.created_at,
    likes: p.like_count ?? 0,
    accepted_answer: Boolean(p.accepted_answer),
    content: htmlToMarkdown(p.cooked),
  };
}

export function normalizeTopic(topic: Topic, posts: Post[]) {
  return {
    id: topic.id,
    title: topic.fancy_title ?? topic.title,
    url: topicUrl(topic.id),
    posts_count: topic.posts_count,
    views: topic.views ?? 0,
    likes: topic.like_count ?? 0,
    category_id: topic.category_id ?? null,
    tags: tagNames(topic.tags),
    created_by: topic.details?.created_by?.username ?? null,
    posts_shown: posts.length,
    total_posts: topic.post_stream.stream.length,
    posts: posts.map(normalizePost),
  };
}

export function normalizeCategory(c: Category) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    topic_count: c.topic_count ?? 0,
    post_count: c.post_count ?? 0,
    description: c.description_text ?? null,
  };
}
