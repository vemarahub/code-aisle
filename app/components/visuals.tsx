"use client";

import type { ReactNode, CSSProperties } from "react";

/**
 * Shared visual vocabulary for the demo — one consistent language reused by
 * every segment (Setup / Search / RAG / Agent). Concise visuals, minimal text:
 * labeled boxes that light up in sequence, arrows, badges, and score bars.
 */

export const SERVICE_COLORS: Record<string, string> = {
  "auth-service": "#00ed64",
  "payments-service": "#4f8cff",
  "notifications-service": "#ffb020",
};

type BoxState = "on" | "off" | "failed";

/** A vertical stage box that fades in (sequenced via `index`). */
export function FlowBox({
  index = 0,
  title,
  subtitle,
  color = "var(--accent)",
  state = "on",
  children,
}: {
  index?: number;
  title: string;
  subtitle?: string;
  color?: string;
  state?: BoxState;
  children?: ReactNode;
}) {
  const dim = state !== "on";
  const borderColor =
    state === "on" ? color : state === "failed" ? "#7a5a24" : "var(--border)";
  return (
    <div
      className="stage"
      style={{
        animationDelay: `${index * 180}ms`,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 10,
        padding: "12px 16px",
        opacity: dim ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color }}>{title}</span>
        {state === "off" && <span style={{ fontSize: 12, color: "var(--muted)" }}>skipped</span>}
        {state === "failed" && <span style={{ fontSize: 12, color: "#ffd7a0" }}>fallback</span>}
      </div>
      {subtitle && (
        <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{subtitle}</div>
      )}
      {children}
    </div>
  );
}

/** A short vertical connector between flow boxes. */
export function Connector() {
  return (
    <div
      aria-hidden
      style={{ width: 2, height: 14, background: "var(--border)", margin: "2px 0 2px 24px" }}
    />
  );
}

/** A small pill badge. `alt` uses the blue accent; dim greys it out. */
export function Badge({
  label,
  color = "var(--accent)",
  dim = false,
}: {
  label: string;
  color?: string;
  dim?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: 12.5,
        padding: "3px 10px",
        borderRadius: 999,
        border: `1px solid ${dim ? "var(--border)" : color}`,
        color: dim ? "var(--muted)" : color,
        opacity: dim ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/** A horizontal relevance bar (0..1). Animates its width on (re)render. */
export function ScoreBar({ value, color = "var(--accent-2)" }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      style={{
        flex: 1,
        height: 8,
        background: "var(--panel-2)",
        borderRadius: 999,
        overflow: "hidden",
        minWidth: 80,
      }}
    >
      <div
        className="scorebar-fill"
        key={value} /* re-animate when the score changes (rerank) */
        style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }}
      />
    </div>
  );
}

export interface ResultHit {
  file: string;
  service: string;
  type?: string;
  snippet?: string;
  score: number;
}

/** A result row: rank, file, service dot, score bar + value. Re-sorts smoothly. */
export function ResultCard({
  hit,
  rank,
  showSnippet = false,
}: {
  hit: ResultHit;
  rank: number;
  showSnippet?: boolean;
}) {
  const color = SERVICE_COLORS[hit.service] ?? "#9aa7c2";
  return (
    <li
      className="result-row"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 8,
        listStyle: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--muted)", minWidth: 26 }}>
          #{rank}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{hit.file}</span>
        <span style={{ fontSize: 13, color }}>{hit.service}</span>
        <ScoreBar value={hit.score} />
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 14,
            color: "var(--accent-2)",
            minWidth: 56,
            textAlign: "right",
          }}
        >
          {hit.score.toFixed(4)}
        </span>
      </div>
      {showSnippet && hit.snippet && (
        <pre
          style={{
            margin: "8px 0 0",
            padding: 10,
            background: "var(--panel-2)",
            borderRadius: 8,
            fontSize: 12.5,
            color: "#cdd6ea",
            whiteSpace: "pre-wrap",
          }}
        >
          {hit.snippet.trim()}
        </pre>
      )}
    </li>
  );
}

/** Small labeled "chip" used for sources and memory. */
export function Chip({ label, color = "var(--muted)" }: { label: string; color?: string }) {
  return (
    <span
      style={{
        fontSize: 12.5,
        padding: "3px 9px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        color,
        background: "var(--panel-2)",
      }}
    >
      {label}
    </span>
  );
}

/** Container style helper for a titled panel. */
export const panelStyle: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
};
