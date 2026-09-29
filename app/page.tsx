"use client";

import { useState } from "react";

interface CodeHit {
  repository: string;
  service: string;
  file: string;
  name: string;
  type: string;
  language: string;
  snippet: string;
  vectorScore?: number;
  rerankScore?: number;
}

interface Generation {
  answer: string;
  model: string;
  ok: boolean;
  note?: string;
}

interface RetrievalMeta {
  index: string;
  embedModel: string;
  rerankModel: string;
  numCandidates: number;
  vectorLimit: number;
  finalLimit: number;
  stages: string[];
  autoEmbedded: boolean;
}

interface AskResponse {
  reranked: boolean;
  results: CodeHit[];
  note?: string;
  question: string;
  generation: Generation | null;
  meta?: RetrievalMeta;
  retrievalMs?: number;
  latencyMs: number;
  error?: string;
}

const PRESETS = [
  "Where is customer authentication handled, and what would I change to add MFA?",
  "How do we handle failed payments and retries?",
  "Where do we send notifications to customers?",
];

const SERVICE_COLORS: Record<string, string> = {
  "auth-service": "#00ed64",
  "payments-service": "#4f8cff",
  "notifications-service": "#ffb020",
};

export default function Home() {
  const [question, setQuestion] = useState(PRESETS[0]);
  const [useRerank, setUseRerank] = useState(true);
  const [useLlm, setUseLlm] = useState(true);
  const [showFlow, setShowFlow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setData(null);
    setShowFlow(false);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, rerank: useRerank, generate: useLlm }),
      });
      const json: AskResponse = await res.json();
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
      } else {
        setData(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "40px 24px 80px",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 40, margin: 0 }}>Code Aisle</h1>
          <span
            style={{
              fontSize: 14,
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
        <p style={{ color: "var(--muted)", fontSize: 20, marginTop: 8 }}>
          Ask the codebase in plain English. Retrieval runs on MongoDB —
          Automated Embeddings (voyage-code-4) + Vector Search
          {" "}+ native <code>$rerank</code>.
        </p>
      </header>

      <section
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 20,
          boxShadow: "var(--shadow)",
        }}
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") ask(question);
          }}
          rows={2}
          placeholder="e.g. Where is customer authentication handled?"
          style={{
            width: "100%",
            fontSize: 22,
            lineHeight: 1.4,
            color: "var(--text)",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => ask(question)}
            disabled={loading}
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#0b1020",
              background: "var(--accent)",
              border: "none",
              borderRadius: 10,
              padding: "12px 22px",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Searching…" : "Ask the codebase"}
          </button>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>
            ⌘/Ctrl + Enter
          </span>
          <label
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 15,
              color: "var(--text)",
              cursor: "pointer",
            }}
            title="On: $vectorSearch → $rerank (rerank-2.5). Off: raw $vectorSearch ranking. Toggle to compare."
          >
            <input
              type="checkbox"
              checked={useRerank}
              onChange={(e) => setUseRerank(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            $rerank
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 15,
              color: "var(--text)",
              cursor: "pointer",
            }}
            title="Retrieval is always MongoDB. This toggles the separate Ollama answer stage."
          >
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            LLM answer (Ollama)
          </label>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setQuestion(p);
                ask(p);
              }}
              disabled={loading}
              style={{
                fontSize: 14,
                color: "var(--text)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "6px 12px",
                cursor: loading ? "default" : "pointer",
              }}
            >
              {p.length > 52 ? p.slice(0, 52) + "…" : p}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 10,
            background: "#3a1720",
            border: "1px solid #7a2436",
            color: "#ffd7de",
            fontSize: 16,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <section style={{ marginTop: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ fontSize: 24, margin: 0 }}>Results</h2>
            <RerankBadge reranked={data.reranked} />
            {data.meta && (
              <button
                onClick={() => setShowFlow((s) => !s)}
                style={{
                  marginLeft: "auto",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--accent-2)",
                  background: "transparent",
                  border: "1px solid var(--accent-2)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                {showFlow ? "Hide how it works ▴" : "How it works ▾"}
              </button>
            )}
          </div>

          {data.meta && showFlow && <PipelineFlow meta={data.meta} data={data} />}

          {data.note && (
            <p
              style={{
                color: "var(--muted)",
                fontSize: 15,
                marginTop: 0,
                marginBottom: 16,
              }}
            >
              {data.note}
            </p>
          )}

          {data.generation && <AnswerPanel generation={data.generation} />}

          <h3
            style={{
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--muted)",
              margin: "8px 0 12px",
            }}
          >
            {data.generation
              ? "Retrieved code (MongoDB) — the LLM's sources"
              : "Retrieved code (MongoDB)"}
          </h3>

          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.results.map((hit, i) => (
              <ResultCard key={hit.file} hit={hit} rank={i + 1} />
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

function AnswerPanel({ generation }: { generation: Generation }) {
  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--accent-2)",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700 }}>Answer</span>
        <span
          style={{
            fontSize: 12,
            color: "var(--accent-2)",
            border: "1px solid var(--accent-2)",
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          LLM · {generation.model}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          generated from the retrieved code
        </span>
      </div>
      {generation.ok ? (
        <p style={{ fontSize: 18, lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>
          {generation.answer}
        </p>
      ) : (
        <p style={{ fontSize: 15, color: "var(--muted)", margin: 0 }}>
          {generation.note ?? "LLM answer unavailable — showing retrieval only."}
        </p>
      )}
    </div>
  );
}

function PipelineFlow({ meta, data }: { meta: RetrievalMeta; data: AskResponse }) {
  const [showAuto, setShowAuto] = useState(false);

  const rerankFailed = data.meta?.stages.some((s) => s.includes("failed"));
  let i = 0; // running index for stagger delay

  return (
    <div style={{ marginBottom: 22 }}>
      {/* Stage 0 — the question */}
      <FlowStage
        i={i++}
        title="Your question"
        color="var(--muted)"
        state="on"
        detail={`"${data.question}"`}
      />
      <StageConnector />

      {/* Stage 1 — $vectorSearch (MongoDB, autoEmbed) */}
      <FlowStage
        i={i++}
        title="$vectorSearch"
        color="var(--accent)"
        state="on"
        detail={`MongoDB embeds the query with ${meta.embedModel} · searches ${meta.numCandidates} candidates · keeps ${meta.vectorLimit}`}
        footer={
          <button
            onClick={() => setShowAuto((s) => !s)}
            style={{
              fontSize: 12.5,
              color: "var(--accent-2)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "3px 9px",
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            {showAuto ? "Hide: how does it embed with no pipeline?" : "How does it embed with no pipeline? ▾"}
          </button>
        }
      >
        {showAuto && <AutoEmbedExplainer embedModel={meta.embedModel} />}
      </FlowStage>
      <StageConnector />

      {/* Stage 2 — $rerank */}
      <FlowStage
        i={i++}
        title="$rerank"
        color="var(--accent)"
        state={data.reranked ? "on" : rerankFailed ? "failed" : "off"}
        detail={
          data.reranked
            ? `MongoDB reorders by relevance with ${meta.rerankModel}`
            : rerankFailed
              ? `Unavailable on this cluster — fell back to vector ranking`
              : `Turned off — showing raw vector ranking`
        }
      />
      <StageConnector />

      {/* Stage 3 — results */}
      <FlowStage
        i={i++}
        title={`Top ${meta.finalLimit} code files`}
        color="var(--accent)"
        state="on"
        detail="Returned from MongoDB (see below)"
      />

      {/* Stage 4 — LLM (only if requested) */}
      {data.generation && (
        <>
          <StageConnector />
          <FlowStage
            i={i++}
            title="LLM answer"
            color="var(--accent-2)"
            state={data.generation.ok ? "on" : "off"}
            detail={
              data.generation.ok
                ? `Ollama · ${data.generation.model} reads the retrieved code and answers`
                : `LLM stage unavailable — retrieval still worked`
            }
          />
        </>
      )}
    </div>
  );
}

function AutoEmbedExplainer({ embedModel }: { embedModel: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginTop: 10,
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--accent)",
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 6, fontSize: 13 }}>
          With Automated Embedding (this app)
        </div>
        <pre style={preStyle}>
{`// index definition — that's it
{ type: "autoEmbed",
  path: "content",
  model: "${embedModel}" }

// query: just text
$vectorSearch({ query: "…" })
// MongoDB embeds + stores + syncs`}
        </pre>
      </div>
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--muted)", marginBottom: 6, fontSize: 13 }}>
          Without it (the usual glue)
        </div>
        <pre style={preStyle}>
{`// you run an embedding pipeline
const v = await embedder.embed(doc)
await coll.insertOne({ ...doc, v })
// keep vectors in sync on change
// embed the query yourself too
const qv = await embedder.embed(query)
$vectorSearch({ queryVector: qv })`}
        </pre>
      </div>
      <p style={{ gridColumn: "1 / -1", color: "var(--muted)", fontSize: 12.5, margin: 0 }}>
        The generated vectors live in MongoDB&apos;s internal{" "}
        <code>__mdb_internal_search</code> database — your{" "}
        <code>code_chunks</code> collection stays clean (no embedding field).
      </p>
    </div>
  );
}

const preStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#cdd6ea",
  whiteSpace: "pre-wrap",
  lineHeight: 1.45,
};

type StageState = "on" | "off" | "failed";

function FlowStage({
  i,
  title,
  detail,
  color,
  state,
  footer,
  children,
}: {
  i: number;
  title: string;
  detail: string;
  color: string;
  state: StageState;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const dim = state !== "on";
  const borderColor =
    state === "on" ? color : state === "failed" ? "#7a5a24" : "var(--border)";
  return (
    <div
      className="stage"
      style={{
        animationDelay: `${i * 180}ms`,
        borderLeft: `4px solid ${borderColor}`,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
        borderRadius: 10,
        padding: "12px 16px",
        opacity: dim ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color }}>{title}</span>
        {state === "off" && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>skipped</span>
        )}
        {state === "failed" && (
          <span style={{ fontSize: 12, color: "#ffd7a0" }}>fallback</span>
        )}
      </div>
      <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{detail}</div>
      {footer}
      {children}
    </div>
  );
}

function StageConnector() {
  return (
    <div
      aria-hidden
      style={{
        width: 2,
        height: 16,
        background: "var(--border)",
        margin: "2px 0 2px 24px",
      }}
    />
  );
}

function RerankBadge({ reranked }: { reranked: boolean }) {
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        color: reranked ? "#0b1020" : "#ffd7a0",
        background: reranked ? "var(--accent)" : "transparent",
        border: reranked ? "none" : "1px solid #7a5a24",
      }}
      title={
        reranked
          ? "Voyage rerank-2.5 reordered the candidates"
          : "Native reranking not available on this cluster (needs 8.3+)"
      }
    >
      {reranked ? "reranked ✓ ($vectorSearch → $rerank)" : "vector-only ($vectorSearch)"}
    </span>
  );
}

function ResultCard({ hit, rank }: { hit: CodeHit; rank: number }) {
  const color = SERVICE_COLORS[hit.service] ?? "#9aa7c2";
  const score = hit.rerankScore ?? hit.vectorScore;
  return (
    <li
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${color}`,
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--muted)" }}>
          #{rank}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{hit.file}</span>
        <span style={{ fontSize: 14, color }}>{hit.service}</span>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{hit.type}</span>
        {typeof score === "number" && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 15,
              fontFamily: "ui-monospace, monospace",
              color: "var(--accent-2)",
            }}
          >
            {score.toFixed(4)}
          </span>
        )}
      </div>
      <pre
        style={{
          margin: "12px 0 0",
          padding: 12,
          background: "var(--panel-2)",
          borderRadius: 8,
          overflowX: "auto",
          fontSize: 14,
          color: "#cdd6ea",
          whiteSpace: "pre-wrap",
        }}
      >
        {hit.snippet.trim()}
      </pre>
    </li>
  );
}
