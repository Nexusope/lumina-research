"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  Clipboard,
  Command,
  Download,
  FileJson,
  FileText,
  Globe2,
  Image as ImageIcon,
  Moon,
  Pin,
  Search,
  Share2,
  Sparkles,
  Sun,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ChartSpec, ResearchEvent, ResearchProgress, ResearchReport, ResearchSource } from "@/lib/research/types";
import { cn } from "@/lib/utils";

const examples = [
  "How many AirPods were sold this year?",
  "How much money did OpenAI make in 2025?",
  "Compare EV sales in India vs China",
  "How many AI startups were founded in 2025?"
];

const trending = ["AI chip revenue 2025", "India EV sales", "OpenAI revenue", "US inflation outlook", "AirPods annual sales"];

type SavedReport = { id: string; query: string; createdAt: string; pinned: boolean; report: ResearchReport };

export default function Home() {
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lumina-history");
    if (saved) setHistory(JSON.parse(saved));
    const savedTheme = localStorage.getItem("lumina-theme") as "dark" | "light" | null;
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("lumina-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pinned = history.filter((item) => item.pinned);

  async function runResearch(nextQuery = query) {
    const clean = nextQuery.trim();
    if (!clean || loading) return;
    setQuery(clean);
    setLoading(true);
    setError("");
    setReport(null);
    setSources([]);
    setProgress({ stage: "Starting", detail: "Opening research pipeline.", progress: 3 });

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: clean })
      });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => null))?.error || "Research request failed.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line) as ResearchEvent, clean);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleEvent(event: ResearchEvent, activeQuery: string) {
    if (event.type === "progress") setProgress(event.payload);
    if (event.type === "source") setSources((current) => [...current, event.payload]);
    if (event.type === "error") setError(event.payload.message);
    if (event.type === "report") {
      setReport(event.payload);
      const item: SavedReport = {
        id: crypto.randomUUID(),
        query: activeQuery,
        createdAt: new Date().toISOString(),
        pinned: false,
        report: event.payload
      };
      setHistory((current) => {
        const next = [item, ...current.filter((entry) => entry.query !== activeQuery)].slice(0, 20);
        localStorage.setItem("lumina-history", JSON.stringify(next));
        return next;
      });
    }
  }

  function loadSaved(item: SavedReport) {
    setQuery(item.query);
    setReport(item.report);
    setSources(item.report.sources);
    setProgress({ stage: "Loaded report", detail: "Restored from local history.", progress: 100 });
    setPaletteOpen(false);
  }

  function togglePin(item: SavedReport) {
    const next = history.map((entry) => (entry.id === item.id ? { ...entry, pinned: !entry.pinned } : entry));
    setHistory(next);
    localStorage.setItem("lumina-history", JSON.stringify(next));
  }

  return (
    <main className="relative min-h-screen overflow-hidden aurora">
      <TopNav theme={theme} setTheme={setTheme} onPalette={() => setPaletteOpen(true)} />
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <Hero query={query} setQuery={setQuery} onSubmit={runResearch} loading={loading} />
        <QuickPrompts onPick={runResearch} />
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Pipeline progress={progress} loading={loading} sources={sources} />
            {error && <ErrorPanel message={error} />}
            <AnimatePresence mode="popLayout">{report && <ReportView report={report} onImage={setLightbox} />}</AnimatePresence>
          </div>
          <aside className="space-y-5">
            <HistoryPanel title="Recent searches" items={history} onLoad={loadSaved} onPin={togglePin} />
            <HistoryPanel title="Pinned reports" items={pinned} onLoad={loadSaved} onPin={togglePin} empty="Pin reports to build collections." />
          </aside>
        </div>
      </section>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={runResearch} history={history} onLoad={loadSaved} />
      <AnimatePresence>
        {lightbox && (
          <motion.button
            className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/80 p-6"
            onClick={() => setLightbox(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-glow" />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}

function TopNav({ theme, setTheme, onPalette }: { theme: "dark" | "light"; setTheme: (theme: "dark" | "light") => void; onPalette: () => void }) {
  return (
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/25 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-fuchsia-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">Lumina</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="glass hidden h-9 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground sm:flex" onClick={onPalette}>
            <Command className="h-4 w-4" /> Search actions
          </button>
          <button className="glass grid h-9 w-9 place-items-center rounded-full" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ query, setQuery, onSubmit, loading }: { query: string; setQuery: (query: string) => void; onSubmit: () => void; loading: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-12 text-center">
      <motion.div className="mb-7 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-blue-200" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        Evidence-first AI research
      </motion.div>
      <motion.h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-7xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        Research anything.
        <span className="block bg-gradient-to-r from-blue-200 via-cyan-200 to-fuchsia-300 bg-clip-text text-transparent">Know everything.</span>
      </motion.h1>
      <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
        Ask a hard question. Lumina retrieves evidence from Context.dev, ranks sources, compares conflicts, and produces cited conclusions.
      </p>
      <form
        className="glass mt-10 flex w-full items-center gap-3 rounded-2xl p-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask anything, e.g. OpenAI revenue in 2025"
          className="min-w-0 flex-1 bg-transparent text-left text-base outline-none placeholder:text-muted-foreground"
        />
        <button disabled={loading} className="rounded-xl bg-gradient-to-r from-blue-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50">
          {loading ? "Researching" : "Search"}
        </button>
      </form>
    </div>
  );
}

function QuickPrompts({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="mb-6 space-y-5">
      <div className="flex flex-wrap justify-center gap-2">
        {examples.map((example) => (
          <button key={example} onClick={() => onPick(example)} className="glass rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:-translate-y-0.5 hover:text-foreground">
            {example}
          </button>
        ))}
      </div>
      <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
        {trending.slice(0, 3).map((item) => (
          <button key={item} onClick={() => onPick(item)} className="glass rounded-lg p-4 text-left transition hover:-translate-y-1 hover:border-blue-400/40">
            <div className="mb-3 grid h-7 w-7 place-items-center rounded-md bg-white/10 text-blue-200">
              <Globe2 className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium">{item}</p>
            <p className="mt-1 text-xs text-muted-foreground">Trending research</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Pipeline({ progress, loading, sources }: { progress: ResearchProgress | null; loading: boolean; sources: ResearchSource[] }) {
  if (!progress && sources.length === 0) return null;
  return (
    <section className="glass rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{progress?.stage || "Ready"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{progress?.detail || "No active run."}</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <div className="h-3 w-3 animate-ping rounded-full bg-cyan-300" />}
          <span className="font-mono text-sm text-blue-200">{progress?.progress || 0}%</span>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500" animate={{ width: `${progress?.progress || 0}%` }} />
      </div>
      {sources.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {sources.map((source) => (
            <SourceCard compact key={source.id} source={source} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportView({ report, onImage }: { report: ResearchReport; onImage: (url: string) => void }) {
  return (
    <motion.section className="space-y-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className="glass rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Summary</p>
            <p className="mt-2 max-w-3xl text-lg leading-8">{report.summary}</p>
          </div>
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-blue-400/30 bg-blue-500/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-100">{Math.round(report.confidenceScore)}%</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
            </div>
          </div>
        </div>
        <ExportBar report={report} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Key findings" icon={<Check className="h-4 w-4" />}>
          <ul className="space-y-3">
            {report.keyFindings.map((finding) => (
              <li key={finding} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-muted-foreground">{finding}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Statistics" icon={<BookOpen className="h-4 w-4" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.statistics.map((stat) => (
              <div key={`${stat.label}-${stat.value}`} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold">{stat.value}{stat.unit ? <span className="ml-1 text-sm text-muted-foreground">{stat.unit}</span> : null}</p>
                {stat.note && <p className="mt-2 text-xs text-muted-foreground">{stat.note}</p>}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {report.charts.length > 0 && <Charts charts={report.charts} />}
      {report.comparisonTables.length > 0 && <ComparisonTables report={report} />}
      <div className="grid gap-5 xl:grid-cols-2">
        {report.timeline.length > 0 && (
          <Panel title="Timeline" icon={<Sparkles className="h-4 w-4" />}>
            <div className="space-y-3">
              {report.timeline.map((item) => (
                <div key={`${item.date}-${item.event}`} className="border-l border-blue-400/40 pl-4">
                  <p className="text-sm font-medium">{item.date}</p>
                  <p className="text-sm text-muted-foreground">{item.event}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {(report.pros.length > 0 || report.cons.length > 0) && (
          <Panel title="Pros / Cons" icon={<FileText className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ListBlock title="Pros" items={report.pros} />
              <ListBlock title="Cons" items={report.cons} />
            </div>
          </Panel>
        )}
      </div>
      {report.images.length > 0 && (
        <Panel title="Images" icon={<ImageIcon className="h-4 w-4" />}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.images.map((image) => (
              <button key={image.url} className="overflow-hidden rounded-lg border border-white/10 text-left" onClick={() => onImage(image.url)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.alt} loading="lazy" className="aspect-video w-full object-cover" />
                <p className="p-3 text-xs text-muted-foreground">{image.attribution}</p>
              </button>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="Sources" icon={<Globe2 className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          {report.sources.map((source) => <SourceCard key={source.id} source={source} />)}
        </div>
      </Panel>
      <Panel title="AI conclusion" icon={<Sparkles className="h-4 w-4" />}>
        <p className="text-base leading-7 text-muted-foreground">{report.conclusion}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {report.followUpQuestions.map((question) => (
            <span key={question} className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground">{question}</span>
          ))}
        </div>
      </Panel>
    </motion.section>
  );
}

function Charts({ charts }: { charts: ChartSpec[] }) {
  return (
    <Panel title="Graphs" icon={<Sparkles className="h-4 w-4" />}>
      <div className="grid gap-4 xl:grid-cols-2">
        {charts.map((chart) => (
          <div key={chart.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-sm font-medium">{chart.title}</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">{renderChart(chart)}</ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function renderChart(chart: ChartSpec) {
  const common = <><CartesianGrid stroke="rgba(255,255,255,0.08)" /><XAxis dataKey={chart.xKey} stroke="rgba(255,255,255,0.45)" /><YAxis stroke="rgba(255,255,255,0.45)" /><Tooltip contentStyle={{ background: "#0b1020", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} /></>;
  if (chart.kind === "line") return <LineChart data={chart.data}>{common}<Line type="monotone" dataKey={chart.yKey} stroke="#60a5fa" strokeWidth={3} /></LineChart>;
  if (chart.kind === "area") return <AreaChart data={chart.data}>{common}<Area type="monotone" dataKey={chart.yKey} stroke="#22d3ee" fill="rgba(34,211,238,0.22)" /></AreaChart>;
  if (chart.kind === "pie") return <PieChart><Tooltip contentStyle={{ background: "#0b1020", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} /><Pie data={chart.data} dataKey={chart.yKey} nameKey={chart.xKey} fill="#60a5fa" /></PieChart>;
  if (chart.kind === "scatter") return <ScatterChart>{common}<Scatter data={chart.data} fill="#c084fc" /></ScatterChart>;
  return <BarChart data={chart.data}>{common}<Bar dataKey={chart.yKey} fill="#60a5fa" radius={[6, 6, 0, 0]} /></BarChart>;
}

function ComparisonTables({ report }: { report: ResearchReport }) {
  return (
    <Panel title="Comparison tables" icon={<FileJson className="h-4 w-4" />}>
      <div className="space-y-4">
        {report.comparisonTables.map((table) => (
          <div key={table.title} className="overflow-x-auto rounded-lg border border-white/10">
            <p className="border-b border-white/10 p-3 text-sm font-medium">{table.title}</p>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-white/[0.04] text-muted-foreground"><tr>{table.columns.map((column) => <th key={column} className="p-3 font-medium">{column}</th>)}</tr></thead>
              <tbody>{table.rows.map((row, index) => <tr key={index} className="border-t border-white/10">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3 text-muted-foreground">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ExportBar({ report }: { report: ResearchReport }) {
  const copy = async (text: string) => navigator.clipboard.writeText(text);
  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <ActionButton icon={<Clipboard className="h-4 w-4" />} label="Copy" onClick={() => copy(report.markdown)} />
      <ActionButton icon={<Download className="h-4 w-4" />} label="Markdown" onClick={() => download("research-report.md", report.markdown, "text/markdown")} />
      <ActionButton icon={<FileJson className="h-4 w-4" />} label="JSON" onClick={() => download("research-report.json", JSON.stringify(report, null, 2), "application/json")} />
      <ActionButton icon={<FileText className="h-4 w-4" />} label="Word" onClick={() => download("research-report.doc", report.markdown, "application/msword")} />
      <ActionButton icon={<FileText className="h-4 w-4" />} label="PDF" onClick={() => window.print()} />
      <ActionButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={() => copy(location.href)} />
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <button className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground" onClick={onClick}>{icon}{label}</button>;
}

function SourceCard({ source, compact = false }: { source: ResearchSource; compact?: boolean }) {
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className={cn("block rounded-lg border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-blue-400/40", compact ? "w-64 shrink-0 p-3" : "p-4")}>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {source.favicon ? <img src={source.favicon} alt="" className="mt-1 h-5 w-5 rounded" loading="lazy" /> : <Globe2 className="mt-1 h-5 w-5 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium">{source.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{source.publisher}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-200">{source.score}%</span>
            <span>{source.sourceType.replace("_", " ")}</span>
            {source.publicationDate && <span>{source.publicationDate}</span>}
            {!compact && <ArrowUpRight className="h-3 w-3" />}
          </div>
        </div>
      </div>
    </a>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="glass rounded-lg p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      {children}
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div><p className="mb-2 text-sm font-medium">{title}</p><ul className="space-y-2">{items.map((item) => <li key={item} className="text-sm text-muted-foreground">{item}</li>)}</ul></div>;
}

function HistoryPanel({ title, items, onLoad, onPin, empty = "No searches yet." }: { title: string; items: SavedReport[]; onLoad: (item: SavedReport) => void; onPin: (item: SavedReport) => void; empty?: string }) {
  return (
    <section className="glass rounded-lg p-5">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <div className="space-y-2">
          {items.slice(0, 8).map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
              <button className="min-w-0 flex-1 text-left text-sm text-muted-foreground hover:text-foreground" onClick={() => onLoad(item)}>{item.query}</button>
              <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10" onClick={() => onPin(item)} aria-label="Pin report">
                {item.pinned ? <Pin className="h-4 w-4 text-blue-200" /> : <Bookmark className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{message}</div>;
}

function CommandPalette({ open, onClose, onPick, history, onLoad }: { open: boolean; onClose: () => void; onPick: (query: string) => void; history: SavedReport[]; onLoad: (item: SavedReport) => void }) {
  const [value, setValue] = useState("");
  const suggestions = useMemo(() => [...examples, ...trending].filter((item) => item.toLowerCase().includes(value.toLowerCase())).slice(0, 6), [value]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="mx-auto mt-20 max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-[#080c16] shadow-glow">
            <div className="flex items-center gap-3 border-b border-white/10 p-4">
              <Command className="h-5 w-5 text-muted-foreground" />
              <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search prompts, recent reports, or type a new question" className="flex-1 bg-transparent outline-none" />
              <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {value.trim().length > 3 && <PaletteItem label={`Research "${value}"`} onClick={() => { onPick(value); onClose(); }} />}
              {suggestions.map((item) => <PaletteItem key={item} label={item} onClick={() => { onPick(item); onClose(); }} />)}
              {history.slice(0, 6).map((item) => <PaletteItem key={item.id} label={`Recent: ${item.query}`} onClick={() => onLoad(item)} />)}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PaletteItem({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground" onClick={onClick}><Search className="h-4 w-4" />{label}</button>;
}
