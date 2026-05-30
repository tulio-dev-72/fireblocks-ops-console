"use client";

import { type Tx } from "@/lib/types";

function bucket(status: string): "done" | "hold" | "fail" | "prog" {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "done";
  if (s.startsWith("PENDING")) return "hold";
  if (["FAILED", "REJECTED", "BLOCKED", "CANCELLED", "CANCELED"].includes(s)) return "fail";
  return "prog";
}

function explorer(txHash?: string) {
  if (!txHash) return undefined;
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

function fmtAmt(v?: string) {
  if (!v) return "";
  const n = Number(v);
  return isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : v;
}

export default function TxFeed({ txs, loading }: { txs: Tx[]; loading: boolean }) {
  if (loading && txs.length === 0) {
    return (
      <div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skel" key={i} style={{ height: 58, marginBottom: 10 }} />
        ))}
      </div>
    );
  }

  if (txs.length === 0) {
    return (
      <div className="empty">
        No transactions yet. Submit a transfer and it will appear here as it
        moves through the Fireblocks lifecycle.
      </div>
    );
  }

  return (
    <div>
      {txs.map((t) => {
        const b = bucket(t.status);
        const url = explorer(t.txHash);
        return (
          <div className="tx" key={t.id}>
            <div className={`tx-rail rail-${b}`} />
            <span className={`status-pill s-${b}`}>{t.status.replace(/_/g, " ")}</span>
            <div className="tx-mid">
              <div className="tx-route">
                {t.sourceName ?? "—"} <span className="arr">→</span> {t.destName ?? "—"}
              </div>
              <div className="tx-sub">
                {t.subStatus ? `${t.subStatus} · ` : ""}
                {t.id.slice(0, 10)}…
              </div>
            </div>
            <div className="tx-right">
              <div className="tx-amt">
                {fmtAmt(t.amount)} {t.assetId ?? ""}
              </div>
              {url && (
                <a className="tx-link" href={url} target="_blank" rel="noreferrer">
                  explorer ↗
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
