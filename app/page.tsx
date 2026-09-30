"use client";

import { useState } from "react";
import {
  FlowBox,
  Connector,
  Badge,
  Chip,
  ResultCard,
  type ResultHit,
  panelStyle,
} from "./components/visuals";
import { SetupView } from "./components/SetupView";

type Mode = "setup" | "search" | "rag" | "agent";

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "setup", label: "Setup", blurb: "How MongoDB is configured — the behind-the-scenes." },
  { id: "search", label: "Search", blurb: "Semantic code search: $vectorSearch (+ $rerank)." },
  { id: "rag", label: "RAG", blurb: "Retrieve with MongoDB, then an LLM answers." },
  { id: "agent", label: "Agent", blurb: "Decides, retrieves, remembers — multi-turn." },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("setup");

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "36px 24px 80px" }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 36, margin: 0 }}>Code Aisle</h1>
          <span
            style={{
              fontSize: 13,
              color: "#0b1020",
              background: "var(--accent)",
              padding: "4px 10px",
              borderRadius: 999,
              fontWeight: 700,
            }}
          >
            MongoDB Atlas
          </span>
        </div>
      </header>

      {/* Segmented control = the demo progression */}
      <div style={{ display: "flex", gap: 6, background: "var(--panel-2)", borderRadius: 12, padding: 6 }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              flex: 1,
              fontSize: 17,
              fontWeight: 700,
              padding: "10px 8px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              color: mode === m.id ? "#0b1020" : "var(--text)",
              background: mode === m.id ? "var(--accent)" : "transparent",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 16, margin: "10px 2px 20px" }}>
        {MODES.find((m) => m.id === mode)!.blurb}
      </p>

      <section style={panelStyle}>
        {mode === "setup" && <SetupView />}
        {(mode === "search" || mode === "rag") && <QueryPanel mode={mode} />}
        {mode === "agent" && <AgentPanel />}
      </section>
    </main>
  );
}

/* ----------------------------- Search / RAG ----------------------------- */

interface Generation {
  answer: string;
  model: string;
  ok: boolean;
  note?: string;
}
interface CodeHit extends ResultHit {
  name?: string;
}
interface AskResponse {
  reranked: boolean;
  results: (CodeHit & { vectorScore?: number; rerankScore?: number })[];
  note?: string;
  generation: Generation | null;
  meta?: { embedModel: string; rerankModel: string; numCandidates: number; vectorLimit: number };
  error?: string;
}

const PRESETS = [
  "Where is customer authentication handled?",
  "How do we handle failed payments and retries?",
  "Where do we send notifications to customers?",
];

function QueryPanel({ mode }: { mode: "search" | "rag" }) {
  const [question, setQuestion] = useState(PRESETS[0]);
  const [rerank, setRerank] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // RAG mode turns on generation; Search mode is retrieval only.
        body: JSON.stringify({ question: query, rerank, generate: mode === "rag" }),
      });
      const json: AskResponse = await res.json();
      if (!res.ok) setError(json.error || `Request failed (${res.status})`);
      else setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const hits: ResultHit[] =
    data?.results.map((r) => ({
      file: r.file,
      service: r.service,
      type: r.type,
      snippet: r.snippet,
      score: (r.rerankScore ?? r.vectorScore ?? r.score) as number,
    })) ?? [];

  return (
    <div>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") ask(question);
        }}
        rows={2}
        style={{
          width: "100%",
          fontSize: 20,
          color: "var(--text)",
          background: "var(--panel-2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "12px 14px",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => ask(question)}
          disabled={loading}
          style={primaryBtn(loading)}
        >
          {loading ? "Working…" : mode === "rag" ? "Ask (retrieve + answer)" : "Search the codebase"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, cursor: "pointer" }}>
          <input type="checkbox" checked={rerank} onChange={(e) => setRerank(e.target.checked)} style={{ width: 18, height: 18 }} />
          $rerank
        </label>
        {PRESETS.map((p) => (
          <button key={p} onClick={() => { setQuestion(p); ask(p); }} disabled={loading} style={chipBtn}>
            {p.length > 34 ? p.slice(0, 34) + "…" : p}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}

      {data && (
        <div style={{ marginTop: 20 }}>
          {/* Concise visual flow */}
          <div style={{ marginBottom: 18 }}>
            <FlowBox index={0} title="question" color="var(--muted)" subtitle={`"${question}"`} />
            <Connector />
            <FlowBox
              index={1}
              title="$vectorSearch"
              subtitle={`MongoDB embeds with ${data.meta?.embedModel ?? "voyage-code-4"} · ${
                data.meta?.numCandidates ?? 100
              } candidates`}
            />
            <Connector />
            <FlowBox
              index={2}
              title="$rerank"
              state={data.reranked ? "on" : rerank ? "failed" : "off"}
              subtitle={
                data.reranked
                  ? `reorders by relevance · ${data.meta?.rerankModel ?? "rerank-2.5"}`
                  : rerank
                    ? "unavailable on this cluster — fell back"
                    : "off — raw vector ranking"
              }
            />
            {mode === "rag" && (
              <>
                <Connector />
                <FlowBox
                  index={3}
                  title="LLM answer"
                  color="var(--accent-2)"
                  state={data.generation?.ok ? "on" : "off"}
                  subtitle={
                    data.generation?.ok
                      ? `${data.generation.model} answers from the retrieved code`
                      : "LLM unavailable — retrieval still works"
                  }
                />
              </>
            )}
          </div>

          {/* RAG answer */}
          {mode === "rag" && data.generation?.ok && (
            <div style={{ ...panelStyle, borderColor: "var(--accent-2)", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>Answer</span>
                <Badge label={`LLM · ${data.generation.model}`} color="var(--accent-2)" />
              </div>
              <p style={{ fontSize: 17, lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>
                {data.generation.answer}
              </p>
            </div>
          )}

          {/* Results with score bars */}
          <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", margin: "4px 0 10px" }}>
            {mode === "rag" ? "Sources (retrieved from MongoDB)" : "Retrieved code (ranked by MongoDB)"}
          </div>
          <ol style={{ padding: 0, margin: 0 }}>
            {hits.map((h, i) => (
              <ResultCard key={h.file} hit={h} rank={i + 1} showSnippet={mode === "search"} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Agent -------------------------------- */

interface AgentStep {
  type: "recall" | "decide" | "retrieve" | "answer";
  detail: string;
}
interface Source {
  file: string;
  service: string;
}
interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
  sources?: Source[];
}

const AGENT_PRESETS = [
  "Where is customer authentication handled?",
  "What would I change there to add MFA?",
  "How do we handle failed payments?",
];

const STEP_COLOR: Record<AgentStep["type"], string> = {
  recall: "#ffb020",
  decide: "#4f8cff",
  retrieve: "#00ed64",
  answer: "#e7ecf5",
};

function AgentPanel() {
  const [sessionId] = useState(() => `web-${Math.random().toString(36).slice(2)}-${Date.now()}`);
  const [input, setInput] = useState(AGENT_PRESETS[0]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(message: string) {
    const msg = message.trim();
    if (!msg || loading) return;
    setError(null);
    setLoading(true);
    setTurns((t) => [...t, { role: "user", content: msg }]);
    setInput("");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: msg }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || `Request failed (${res.status})`);
      else setTurns((t) => [...t, { role: "assistant", content: d.answer, steps: d.steps, sources: d.sources }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <Chip label="MongoDB = retrieval tool + memory" color="var(--accent)" />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>steps shown per turn</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
              <div style={{ background: "var(--accent-2)", color: "#0b1020", padding: "10px 14px", borderRadius: "12px 12px 2px 12px", fontSize: 16, fontWeight: 600 }}>
                {turn.content}
              </div>
            </div>
          ) : (
            <div key={i} style={{ alignSelf: "flex-start", width: "100%" }}>
              {turn.steps && turn.steps.length > 0 && <AgentTrace steps={turn.steps} />}
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 2px", padding: "12px 16px", fontSize: 16, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {turn.content}
                {turn.sources && turn.sources.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {turn.sources.slice(0, 3).map((s) => (
                      <Chip key={s.file} label={s.file} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "var(--muted)", fontSize: 15 }}>
            Agent working… (decide → search MongoDB → answer)
          </div>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <div style={{ marginTop: 18 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(input);
          }}
          rows={2}
          placeholder="Ask the agent…"
          style={{ width: "100%", fontSize: 17, color: "var(--text)", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => send(input)} disabled={loading} style={primaryBtn(loading)}>
            {loading ? "Working…" : "Send"}
          </button>
          {AGENT_PRESETS.map((p) => (
            <button key={p} onClick={() => send(p)} disabled={loading} style={chipBtn}>
              {p.length > 34 ? p.slice(0, 34) + "…" : p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentTrace({ steps }: { steps: AgentStep[] }) {
  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 8, background: "var(--bg)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, letterSpacing: 1 }}>AGENT STEPS</div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s, i) => (
          <li key={i} className="stage" style={{ animationDelay: `${i * 150}ms`, display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: STEP_COLOR[s.type], minWidth: 66 }}>
              {s.type}
            </span>
            <span style={{ fontSize: 14 }}>{s.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------- shared -------------------------------- */

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "#3a1720", border: "1px solid #7a2436", color: "#ffd7de" }}>
      <strong>Error:</strong> {message}
    </div>
  );
}

function primaryBtn(loading: boolean): React.CSSProperties {
  return {
    fontSize: 17,
    fontWeight: 700,
    color: "#0b1020",
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    cursor: loading ? "default" : "pointer",
    opacity: loading ? 0.6 : 1,
  };
}

const chipBtn: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "6px 12px",
  cursor: "pointer",
};
