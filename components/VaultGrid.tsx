"use client";

import { useMemo, useState } from "react";
import { type Vault } from "@/lib/types";
import { assetTicker, fmtNum, vaultGroup, GROUP_ORDER, positiveAssets, assetKind } from "@/lib/format";
import { usePersistentState } from "@/lib/usePersistentState";

type Target = "source" | "dest" | null;
const vaultTotal = (v: Vault) => v.assets.reduce((s, a) => s + Number(a.total || 0), 0);

export default function VaultGrid({
  vaults,
  loading,
  source,
  dest,
  targeting,
  onSetSource,
  onSetDest,
  onPickTargeted,
}: {
  vaults: Vault[];
  loading: boolean;
  source: string;
  dest: string;
  targeting: Target;
  onSetSource: (id: string) => void;
  onSetDest: (id: string) => void;
  onPickTargeted: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [hideEmpty, setHideEmpty] = usePersistentState("coc:hideEmpty", false);
  const [sort, setSort] = usePersistentState<"id" | "name" | "balance">("coc:sort", "id");
  const [collapsed, setCollapsed] = usePersistentState<Record<string, boolean>>("coc:collapsed", {});

  const assetTotals = useMemo(() => {
    const m: Record<string, { total: number; vaults: number }> = {};
    vaults.forEach((v) =>
      v.assets.forEach((a) => {
        const n = Number(a.total);
        if (n <= 0) return;
        if (!m[a.id]) m[a.id] = { total: 0, vaults: 0 };
        m[a.id].total += n;
        m[a.id].vaults += 1;
      })
    );
    return Object.entries(m).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.total - a.total);
  }, [vaults]);

  const groups = useMemo(() => {
    let list = vaults;
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((v) => v.name.toLowerCase().includes(t) || v.id.includes(t));
    }
    if (hideEmpty) list = list.filter((v) => vaultTotal(v) > 0);
    const sorted = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "balance") return vaultTotal(b) - vaultTotal(a);
      return Number(b.id) - Number(a.id);
    });
    const m: Record<string, { label: string; items: Vault[] }> = {};
    sorted.forEach((v) => {
      const g = vaultGroup(v.name);
      if (!m[g.key]) m[g.key] = { label: g.label, items: [] };
      m[g.key].items.push(v);
    });
    return GROUP_ORDER.filter((k) => m[k]).map((k) => ({ key: k, ...m[k] }));
  }, [vaults, q, hideEmpty, sort]);

  if (loading && vaults.length === 0) {
    return (
      <div className="vault-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skel" key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      {assetTotals.length > 0 && (
        <>
          <div className="mini-label">Holdings by asset</div>
          <div className="asset-summary">
            {assetTotals.map((a) => {
              const kind = assetKind(a.id);
              return (
                <div className="asset-tile" key={a.id} title={a.id}>
                  <div className="at-head">
                    <span className="at-ticker">{assetTicker(a.id)}</span>
                    <span className={`at-kind k-${kind.key}`}>{kind.label}</span>
                  </div>
                  <div className="at-total">{fmtNum(a.total)}</div>
                  <div className="at-meta">
                    {a.vaults} vault{a.vaults === 1 ? "" : "s"}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="controls">
        <input className="search-input" placeholder="Search vaults…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="toggle">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          Hide empty
        </label>
        <select className="sort" value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="id">Sort · Vault #</option>
          <option value="name">Sort · Name</option>
          <option value="balance">Sort · Balance</option>
        </select>
      </div>

      {targeting ? (
        <div className={`targeting-banner ${targeting}`}>
          <span>
            Click any card to set it as the <strong>{targeting === "source" ? "source" : "destination"}</strong>.
          </span>
        </div>
      ) : (
        <div className="pick-hint">
          Set a transfer end with a card&rsquo;s <strong>source</strong> / <strong>dest</strong> buttons — or click
          &ldquo;pick from cards&rdquo; in the transfer panel, then click a card.
        </div>
      )}

      {groups.length === 0 && <div className="empty">No vaults match your filters.</div>}

      {groups.map((g) => (
        <div className="vgroup" key={g.key}>
          <button className="vgroup-h" onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}>
            <span className="vgroup-caret">{collapsed[g.key] ? "▸" : "▾"}</span>
            <span className="vgroup-label">{g.label}</span>
            <span className="vgroup-count">{g.items.length}</span>
          </button>
          {!collapsed[g.key] && (
            <div className="vault-grid">
              {g.items.map((v) => {
                const pos = positiveAssets(v.assets);
                const funded = pos.length > 0;
                const isSource = v.id === source;
                const isDest = v.id === dest;
                const role = isSource ? "role-source" : isDest ? "role-dest" : "";
                const pickable = targeting && !(targeting === "source" && !funded);
                return (
                  <div
                    className={`vault ${role} ${pickable ? "pickable pick-" + targeting : ""}`}
                    key={v.id}
                    onClick={pickable ? () => onPickTargeted(v.id) : undefined}
                  >
                    <div className="vault-top">
                      <span className="vault-name" title={v.name}>{v.name}</span>
                      <span className="vault-id">#{v.id}</span>
                    </div>
                    {pos.length === 0 ? (
                      <div className="asset-empty">No balance</div>
                    ) : (
                      pos.map((a) => (
                        <div className="asset-line" key={a.id}>
                          <span className="asset-sym" title={a.id}>{assetTicker(a.id)}</span>
                          <span className="asset-bal">{fmtNum(a.total)}</span>
                        </div>
                      ))
                    )}
                    <div className="vault-actions">
                      <button
                        className={`va from ${isSource ? "active" : ""}`}
                        disabled={!funded}
                        title={funded ? "Use as transfer source" : "No balance to send"}
                        onClick={(e) => { e.stopPropagation(); onSetSource(v.id); }}
                      >
                        {isSource ? "✓ source" : "source"}
                      </button>
                      <button
                        className={`va to ${isDest ? "active" : ""}`}
                        title="Use as transfer destination"
                        onClick={(e) => { e.stopPropagation(); onSetDest(v.id); }}
                      >
                        {isDest ? "✓ dest" : "dest"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
