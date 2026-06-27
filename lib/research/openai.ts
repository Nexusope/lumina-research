import type { ResearchReport, ResearchSource } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

export async function expandQuery(query: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackExpansion(query);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content:
            "Expand a research question into precise retrieval queries. Return only JSON with a queries string array. Include government/statistical/report/news/PDF/table angles when relevant."
        },
        { role: "user", content: query }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "query_expansion",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { queries: { type: "array", items: { type: "string" }, maxItems: 6 } },
            required: ["queries"]
          }
        }
      }
    })
  });

  if (!response.ok) return fallbackExpansion(query);
  const json = await response.json();
  const text = extractText(json);
  try {
    const parsed = JSON.parse(text || "{}");
    return Array.isArray(parsed.queries) ? parsed.queries.slice(0, 6) : fallbackExpansion(query);
  } catch {
    return fallbackExpansion(query);
  }
}

export async function generateReport(query: string, sources: ResearchSource[]): Promise<ResearchReport> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return generateEvidenceOnlyReport(query, sources);
  }

  const evidence = sources.slice(0, 18).map((source, index) => ({
    citation: index + 1,
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    publicationDate: source.publicationDate,
    sourceType: source.sourceType,
    score: source.score,
    snippet: source.snippet?.slice(0, 1800)
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a cautious research analyst. Use only the provided evidence. Do not invent facts, numbers, publication dates, URLs, or citations. If evidence conflicts, state the conflict and lower confidence. Every factual claim must be traceable to a source id. Produce concise, investor-grade output."
        },
        {
          role: "user",
          content: JSON.stringify({ query, evidence }, null, 2)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "research_report",
          schema: reportSchema()
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI Responses API returned ${response.status}: ${text.slice(0, 220)}`);
  }

  const json = await response.json();
  const text = extractText(json);
  const parsed = JSON.parse(text);
  return {
    ...parsed,
    query,
    sources,
    images: mergeImages(parsed.images || [], sources),
    markdown: parsed.markdown || toMarkdown(query, parsed, sources),
    json: parsed
  };
}

function generateEvidenceOnlyReport(query: string, sources: ResearchSource[]): ResearchReport {
  const top = sources.slice(0, 8);
  const statistics = extractStatistics(top);
  const confidenceScore = Math.min(82, Math.max(35, Math.round(top.reduce((sum, source) => sum + source.score, 0) / Math.max(top.length, 1))));
  const keyFindings = top.slice(0, 5).map((source) => {
    const snippet = source.snippet?.replace(/\s+/g, " ").trim();
    return snippet ? `${snippet.slice(0, 220)}${snippet.length > 220 ? "..." : ""} [${source.publisher}]` : `Relevant evidence found from ${source.publisher}: ${source.title}`;
  });
  const report = {
    query,
    summary:
      "Lumina retrieved and ranked real sources for this question. Add OPENAI_API_KEY to enable synthesized reasoning; this fallback report intentionally avoids unsupported conclusions and shows only cited evidence snippets.",
    confidenceScore,
    keyFindings,
    statistics,
    sources,
    images: sources
      .filter((source) => source.image)
      .slice(0, 8)
      .map((source) => ({ url: source.image as string, alt: source.title, attribution: source.publisher, sourceId: source.id })),
    charts: buildChart(statistics),
    timeline: sources
      .filter((source) => source.publicationDate)
      .slice(0, 6)
      .map((source) => ({ date: source.publicationDate as string, event: source.title, sourceId: source.id })),
    comparisonTables: [
      {
        title: "Ranked evidence",
        columns: ["Publisher", "Source type", "Score", "Title"],
        rows: top.map((source) => [source.publisher, source.sourceType.replace("_", " "), `${source.score}%`, source.title])
      }
    ],
    pros: [],
    cons: [],
    followUpQuestions: [`Find primary data for ${query}`, `Compare only government or filing sources`, `Continue research with newer publications`],
    conclusion: "The system found evidence but did not generate a final synthesized answer because the OpenAI Responses API key is not configured.",
    markdown: "",
    json: {}
  } satisfies ResearchReport;

  return { ...report, markdown: toMarkdown(query, report, sources), json: report };
}

function extractStatistics(sources: ResearchSource[]) {
  const stats: ResearchReport["statistics"] = [];
  for (const source of sources) {
    const snippet = source.snippet || "";
    const matches = snippet.match(/(?:\$|Rs\.?|₹)?\s?\d+(?:\.\d+)?\s?(?:%|million|billion|trillion|crore|lakh|units|vehicles|startups|companies|users|revenue|sales)?/gi) || [];
    for (const match of matches.slice(0, 2)) {
      stats.push({ label: source.title.slice(0, 70), value: match.trim(), sourceId: source.id, note: source.publisher });
      if (stats.length >= 6) return stats;
    }
  }
  return stats;
}

function buildChart(statistics: ResearchReport["statistics"]): ResearchReport["charts"] {
  const data = statistics
    .map((stat) => ({ label: stat.label.slice(0, 18), value: Number.parseFloat(stat.value.replace(/[^0-9.]/g, "")) }))
    .filter((item) => Number.isFinite(item.value));
  if (data.length < 2) return [];
  return [{ title: "Detected numerical evidence", kind: "bar", xKey: "label", yKey: "value", data }];
}

function fallbackExpansion(query: string) {
  return [
    `${query} official statistics`,
    `${query} annual report PDF`,
    `${query} government data`,
    `${query} market research`,
    `${query} latest news`
  ];
}

function extractText(json: any) {
  if (typeof json.output_text === "string") return json.output_text;
  const chunks = json.output?.flatMap((item: any) => item.content ?? []) ?? [];
  return chunks
    .map((chunk: any) => chunk.text || chunk.output_text || (typeof chunk === "string" ? chunk : ""))
    .filter(Boolean)
    .join("");
}

function mergeImages(images: ResearchReport["images"], sources: ResearchSource[]) {
  const sourceImages = sources
    .filter((source) => source.image)
    .slice(0, 8)
    .map((source) => ({
      url: source.image as string,
      alt: source.title,
      attribution: source.publisher,
      sourceId: source.id
    }));
  return [...images, ...sourceImages].filter((image, index, all) => image.url && all.findIndex((i) => i.url === image.url) === index);
}

function toMarkdown(query: string, report: Partial<ResearchReport>, sources: ResearchSource[]) {
  return [
    `# ${query}`,
    "",
    `## Summary`,
    report.summary || "",
    "",
    `## Confidence`,
    `${report.confidenceScore || 0}%`,
    "",
    `## Key Findings`,
    ...(report.keyFindings || []).map((finding) => `- ${finding}`),
    "",
    `## Sources`,
    ...sources.map((source, index) => `${index + 1}. [${source.title}](${source.url}) - ${source.publisher}`)
  ].join("\n");
}

function reportSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      confidenceScore: { type: "number", minimum: 0, maximum: 100 },
      keyFindings: { type: "array", items: { type: "string" } },
      statistics: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            unit: { type: "string" },
            sourceId: { type: "string" },
            note: { type: "string" }
          },
          required: ["label", "value"]
        }
      },
      images: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            url: { type: "string" },
            alt: { type: "string" },
            attribution: { type: "string" },
            sourceId: { type: "string" }
          },
          required: ["url", "alt", "attribution"]
        }
      },
      charts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            kind: { type: "string", enum: ["bar", "line", "area", "pie", "scatter"] },
            xKey: { type: "string" },
            yKey: { type: "string" },
            data: { type: "array", items: { type: "object", additionalProperties: { anyOf: [{ type: "string" }, { type: "number" }] } } }
          },
          required: ["title", "kind", "xKey", "yKey", "data"]
        }
      },
      timeline: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { date: { type: "string" }, event: { type: "string" }, sourceId: { type: "string" } },
          required: ["date", "event"]
        }
      },
      comparisonTables: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            columns: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } }
          },
          required: ["title", "columns", "rows"]
        }
      },
      pros: { type: "array", items: { type: "string" } },
      cons: { type: "array", items: { type: "string" } },
      followUpQuestions: { type: "array", items: { type: "string" } },
      conclusion: { type: "string" },
      markdown: { type: "string" }
    },
    required: [
      "summary",
      "confidenceScore",
      "keyFindings",
      "statistics",
      "images",
      "charts",
      "timeline",
      "comparisonTables",
      "pros",
      "cons",
      "followUpQuestions",
      "conclusion",
      "markdown"
    ]
  };
}
