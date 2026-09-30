"use client";

import { useEffect, useState } from "react";
import { Badge, Chip } from "./visuals";

interface IndexState {
  collection: string;
  index: string;
  count: number;
  exists: boolean;
  status: string;
  queryable: boolean;
}

interface SetupData {
  embedModel: string;
  rerankModel: string;
  llmModel: string;
  code: IndexState;
  memory: IndexState;
  error?: string;
}

/**
 * Behind-the-scenes map: how MongoDB is configured for the demo. Two autoEmbed
 * pipelines (code + memory) both feed the internal vector store — shown as a
 * visual, not prose. Values are live from /api/setup.
 */
export function SetupView() {
  const [data, setData] = useState<SetupData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <p style={{ color: "#ffd7de" }}>Setup unavailable: {err}</p>;
  if (!data) return <p style={{ color: "var(--muted)" }}>Loading cluster state…</p>;

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 0 }}>
        The whole configuration: two collections, two <b>autoEmbed</b> indexes,
        one reranker. MongoDB owns the vectors — no embedding pipeline.
      </p>

      {/* Two source collections → autoEmbed → internal vector store */}
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
          <SourceCard
            title={data.code.collection}
            note="code + metadata · no vector field"
            index={data.code}
            embedModel={data.embedModel}
          />
          <SourceCard
            title={data.memory.collection}
            note="conversation turns · no vector field"
            index={data.memory}
            embedModel={data.embedModel}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", color: "var(--muted)", fontSize: 22 }}>
          →
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 240,
            background: "var(--panel-2)",
            border: "1px dashed var(--accent)",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
            __mdb_internal_search
          </div>
          <div style={{ fontSize: 13.5, color: "var(--muted)" }}>
            MongoDB generates &amp; stores the vectors here with{" "}
            <code>{data.embedModel}</code>, and keeps them in sync automatically.
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Managed by MongoDB — never touched by the app.</div>
        </div>
      </div>

      {/* Capability badges */}
      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Query pipeline:</span>
        <Badge label="$vectorSearch" />
        <Badge label={`$rerank · ${data.rerankModel}`} color="var(--accent)" />
        <Badge label={`LLM · ${data.llmModel}`} color="var(--accent-2)" />
        <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 8 }}>
          embed: <code>{data.embedModel}</code>
        </span>
      </div>
    </div>
  );
}

function SourceCard({
  title,
  note,
  index,
  embedModel,
}: {
  title: string;
  note: string;
  index: IndexState;
  embedModel: string;
}) {
  const ready = index.queryable;
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <Chip label={`${index.count} docs`} />
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 10px" }}>{note}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Badge label={`autoEmbed · ${embedModel}`} />
        <Badge
          label={ready ? "index: READY" : `index: ${index.status}`}
          color={ready ? "var(--accent)" : "#ffb020"}
          dim={!ready}
        />
      </div>
    </div>
  );
}
