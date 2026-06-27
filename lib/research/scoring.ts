import type { ResearchSource, SourcePriority } from "./types";

const priorityWeights: Record<SourcePriority, number> = {
  government: 98,
  research: 94,
  annual_report: 91,
  company_filing: 90,
  university: 86,
  major_news: 78,
  industry_report: 72,
  blog: 42,
  reddit: 18,
  unknown: 35
};

const knownDomains: Array<[RegExp, SourcePriority]> = [
  [/\.(gov|gov\.[a-z]{2}|nic\.in|europa\.eu)$/i, "government"],
  [/(sec\.gov|companieshouse\.gov\.uk|mca\.gov\.in)/i, "company_filing"],
  [/(arxiv\.org|doi\.org|nature\.com|science\.org|ssrn\.com|pubmed\.ncbi\.nlm\.nih\.gov)/i, "research"],
  [/\.(edu|ac\.[a-z]{2})$/i, "university"],
  [/(reuters\.com|apnews\.com|bloomberg\.com|ft\.com|wsj\.com|nytimes\.com|economist\.com|bbc\.com|theguardian\.com)/i, "major_news"],
  [/(iea\.org|counterpointresearch\.com|canalys\.com|gartner\.com|idc\.com|statista\.com|mckinsey\.com|pwc\.com|deloitte\.com)/i, "industry_report"],
  [/(reddit\.com)/i, "reddit"],
  [/(medium\.com|substack\.com|blog)/i, "blog"]
];

export function classifySource(url: string, title = ""): SourcePriority {
  const host = safeHost(url);
  const haystack = `${host} ${title}`;
  const match = knownDomains.find(([pattern]) => pattern.test(haystack));
  if (match) return match[1];
  if (/annual report|10-k|form 20-f|investor relations/i.test(title)) return "annual_report";
  return "unknown";
}

export function scoreSource(source: Omit<ResearchSource, "score">): number {
  let score = priorityWeights[source.sourceType];
  if (source.publicationDate) score += 4;
  if (source.snippet && source.snippet.length > 180) score += 3;
  if (/\.pdf($|\?)/i.test(source.url)) score += 3;
  return Math.max(1, Math.min(100, Math.round(score)));
}

export function faviconFor(url: string) {
  const host = safeHost(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : "";
}

export function publisherFor(url: string) {
  const host = safeHost(url).replace(/^www\./, "");
  return host || "Unknown publisher";
}

export function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function dedupeSources(sources: ResearchSource[]) {
  const seen = new Map<string, ResearchSource>();
  for (const source of sources) {
    const key = source.url.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
    const existing = seen.get(key);
    if (!existing || source.score > existing.score) seen.set(key, source);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}
