/**
 * Minimal client for the Discourse JSON API used by community.haxe.org.
 * All read endpoints are public, so no authentication is required.
 */

export const BASE_URL = process.env.HAXE_FORUM_URL ?? "https://community.haxe.org";

const USER_AGENT = "haxe-forum-cli (+https://github.com/)";

async function getJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText} (${url})`);
  }
  return (await res.json()) as T;
}

// ---- Response shapes (only the fields we actually use) ----

export interface SearchTopic {
  id: number;
  title: string;
  fancy_title?: string;
  posts_count: number;
  reply_count?: number;
  created_at: string;
  last_posted_at?: string;
  category_id?: number;
  tags?: string[];
  like_count?: number;
  views?: number;
}

export interface SearchPost {
  id: number;
  topic_id: number;
  username: string;
  created_at: string;
  like_count?: number;
  blurb?: string;
  post_number?: number;
}

export interface SearchResult {
  topics: SearchTopic[];
  posts: SearchPost[];
  grouped_search_result?: {
    more_full_page_results?: boolean | null;
    term?: string;
  };
}

export interface Post {
  id: number;
  post_number: number;
  username: string;
  name?: string;
  created_at: string;
  updated_at?: string;
  cooked: string; // rendered HTML
  like_count?: number;
  reply_to_post_number?: number | null;
  accepted_answer?: boolean;
}

export interface Topic {
  id: number;
  title: string;
  fancy_title?: string;
  posts_count: number;
  created_at: string;
  views?: number;
  like_count?: number;
  category_id?: number;
  tags?: string[];
  post_stream: {
    posts: Post[];
    stream: number[];
  };
  details?: {
    created_by?: { username: string };
  };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description_text?: string;
  topic_count?: number;
  post_count?: number;
  color?: string;
}

export interface CategoryList {
  category_list: { categories: Category[] };
}

export interface TopicListItem {
  id: number;
  title: string;
  fancy_title?: string;
  posts_count: number;
  reply_count?: number;
  created_at: string;
  last_posted_at?: string;
  category_id?: number;
  tags?: string[];
  like_count?: number;
  views?: number;
}

export interface TopicList {
  topic_list: { topics: TopicListItem[] };
}

// ---- API methods ----

export function search(query: string, page = 1): Promise<SearchResult> {
  const q = encodeURIComponent(query);
  return getJson<SearchResult>(`/search.json?q=${q}&page=${page}`);
}

export function getTopic(id: number, page = 1): Promise<Topic> {
  return getJson<Topic>(`/t/${id}.json?track_visit=false&page=${page}`);
}

export function getLatest(): Promise<TopicList> {
  return getJson<TopicList>(`/latest.json`);
}

export function getCategoryTopics(slugOrId: string): Promise<TopicList> {
  return getJson<TopicList>(`/c/${slugOrId}.json`);
}

export function getCategories(): Promise<CategoryList> {
  return getJson<CategoryList>(`/categories.json`);
}

/** Fetch additional posts beyond the first page of a topic stream. */
export function getPostsByIds(topicId: number, ids: number[]): Promise<{ post_stream: { posts: Post[] } }> {
  const params = ids.map((id) => `post_ids[]=${id}`).join("&");
  return getJson(`/t/${topicId}/posts.json?${params}`);
}

export function topicUrl(id: number, slug?: string): string {
  return `${BASE_URL}/t/${slug ? `${slug}/` : ""}${id}`;
}
