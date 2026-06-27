import { NextRequest } from "next/server";
import { z } from "zod";
import { searchContextDev } from "@/lib/research/context-dev";
import { generateReport, expandQuery } from "@/lib/research/openai";
import { dedupeSources } from "@/lib/research/scoring";
import type { ResearchEvent, ResearchProgress } from "@/lib/research/types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  query: z.string().trim().min(4).max(500)
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter a research question with at least 4 characters." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ResearchEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        progress(send, "Query expansion", "Building official, PDF, statistical, and news search angles.", 8);
        const expansion = await expandQuery(parsed.data.query);

        progress(send, "Parallel Context.dev retrieval", "Searching web, PDFs, news, tables, images, and reports.", 24);
        const sources = await searchContextDev(parsed.data.query, expansion, request.signal);

        if (sources.length === 0) {
          throw new Error("Context.dev returned no sources for this query. Try a more specific question or verify Context.dev access.");
        }

        progress(send, "Deduplication", "Merging duplicate URLs and scoring publishers by evidence quality.", 45);
        const ranked = dedupeSources(sources).slice(0, 24);
        ranked.slice(0, 12).forEach((source) => send({ type: "source", payload: source }));

        progress(send, "Evidence scoring", "Prioritizing government, research, filings, annual reports, and major news.", 58);
        const selected = ranked.filter((source) => source.score >= 35);

        progress(send, "AI reasoning", "Generating a cited report from retrieved evidence only.", 76);
        const report = await generateReport(parsed.data.query, selected.length ? selected : ranked);

        progress(send, "Final report", "Research complete with cited evidence, charts, and export-ready structure.", 100);
        send({ type: "report", payload: report });
      } catch (error) {
        send({ type: "error", payload: { message: error instanceof Error ? error.message : "Research failed." } });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function progress(send: (event: ResearchEvent) => void, stage: string, detail: string, progressValue: number) {
  const payload: ResearchProgress = { stage, detail, progress: progressValue };
  send({ type: "progress", payload });
}
