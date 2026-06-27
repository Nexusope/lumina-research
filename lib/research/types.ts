export type SourcePriority =
  | "government"
  | "research"
  | "annual_report"
  | "company_filing"
  | "university"
  | "major_news"
  | "industry_report"
  | "blog"
  | "reddit"
  | "unknown";

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publicationDate?: string;
  snippet?: string;
  favicon?: string;
  image?: string;
  sourceType: SourcePriority;
  score: number;
  retrievedAt: string;
};

export type StatCard = {
  label: string;
  value: string;
  unit?: string;
  sourceId?: string;
  note?: string;
};

export type ChartSpec = {
  title: string;
  kind: "bar" | "line" | "area" | "pie" | "scatter";
  xKey: string;
  yKey: string;
  data: Record<string, string | number>[];
};

export type TimelineItem = {
  date: string;
  event: string;
  sourceId?: string;
};

export type ComparisonTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type ResearchReport = {
  query: string;
  summary: string;
  confidenceScore: number;
  keyFindings: string[];
  statistics: StatCard[];
  sources: ResearchSource[];
  images: Array<{ url: string; alt: string; attribution: string; sourceId?: string }>;
  charts: ChartSpec[];
  timeline: TimelineItem[];
  comparisonTables: ComparisonTable[];
  pros: string[];
  cons: string[];
  followUpQuestions: string[];
  conclusion: string;
  markdown: string;
  json: unknown;
};

export type ResearchProgress = {
  stage: string;
  detail: string;
  progress: number;
};

export type ResearchEvent =
  | { type: "progress"; payload: ResearchProgress }
  | { type: "source"; payload: ResearchSource }
  | { type: "report"; payload: ResearchReport }
  | { type: "error"; payload: { message: string } };
