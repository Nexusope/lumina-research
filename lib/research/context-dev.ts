import { classifySource, faviconFor, publisherFor, scoreSource } from "./scoring";
import type { ResearchSource } from "./types";

type ContextDevResult = {
  title?: string;
  url?: string;
  href?: string;
  link?: string;
  content?: string;
  text?: string;
  snippet?: string;
  description?: string;
  published_at?: string;
  publishedAt?: string;
  date?: string;
  image?: string;
  thumbnail?: string;
  markdown?: { markdown?: string } | string;
};

const CONTEXT_DEV_SEARCH_URL = process.env.CONTEXTDEV_BASE_URL || "https://api.context.dev/v1/web/search";

export async function searchContextDev(query: string, expansion: string[], signal?: AbortSignal) {
  const apiKey = process.env.CONTEXT_DEV_API_KEY || process.env.CONTEXTDEV_API_KEY;
  if (!apiKey) {
    throw new Error("Missing CONTEXTDEV_API_KEY. Add it to .env.local before running research.");
  }

  const searches = [query, ...expansion].slice(0, 5);
  const settled = await Promise.allSettled(
    searches.map((q) =>
      fetch(CONTEXT_DEV_SEARCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          query: q,
          queryFanout: true, markdownOptions: { enabled: true, timeoutMS: 15000 }, timeoutMS: 30000
        }),
        signal,
        next: { revalidate: 1800 }
      }).then(async (response) => {
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Context.dev returned ${response.status}: ${text.slice(0, 180)}`);
        }
        return response.json();
      })
    )
  );

  const raw = settled.flatMap((result) => {
    if (result.status === "rejected") return [];
    const value = result.value;
    if (Array.isArray(value)) return value as ContextDevResult[];
    if (Array.isArray(value.results)) return value.results as ContextDevResult[];
    if (Array.isArray(value.data)) return value.data as ContextDevResult[];
    if (Array.isArray(value.items)) return value.items as ContextDevResult[];
    return [];
  });

  return raw.flatMap(normalizeContextResult);
}

function normalizeContextResult(item: ContextDevResult): ResearchSource[] {
  const url = item.url || item.href || item.link;
  if (!url) return [];
  const title = item.title || publisherFor(url);
  const sourceType = classifySource(url, title);
  const base = {
    id: crypto.randomUUID(),
    title,
    url,
    publisher: publisherFor(url),
    publicationDate: item.published_at || item.publishedAt || item.date,
    snippet: item.snippet || item.description || item.content || item.text || markdownText(item.markdown),
    favicon: faviconFor(url),
    image: item.image || item.thumbnail,
    sourceType,
    retrievedAt: new Date().toISOString()
  };

  return [{ ...base, score: scoreSource(base) }];
}

function markdownText(value: ContextDevResult['markdown']) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.markdown;
}



