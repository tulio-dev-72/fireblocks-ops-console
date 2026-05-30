"use client";

import { useEffect, useRef, useState } from "react";
import { type Vault } from "@/lib/types";
import { positiveAssets } from "@/lib/format";

export default function VaultSelect({
  vaults,
  value,
  onChange,
  onArm,
  placeholder,
  requireFunds,
  exclude,
}: {
  vaults: Vault[];
  value: string;
  onChange: (id: string) => void;
  onArm?: () => void;
  placeholder: string;
  requireFunds?: boolean;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const list = vaults.filter((v) => {
    if (v.id === exclude) return false;
    if (requireFunds && positiveAssets(v.assets).length === 0) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return v.name.toLowerCase().includes(t) || v.id.includes(t);
  });

  const sel = vaults.find((v) => v.id === value);

  return (
    <div className="vsel" ref={ref}>
      <button
        type="button"
        className={`vsel-trigger ${open ? "open" : ""}`}
        onClick={() => {
          onArm?.();
          setOpen((o) => !o);
        }}
      >
        {sel ? (
          <>
            <span className="vsel-name">{sel.name}</span>
            <span className="vsel-id">#{sel.id}</span>
          </>
        ) : (
          <span className="vsel-ph">{placeholder}</span>
        )}
        <span className="vsel-caret">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="vsel-menu">
          <input
            className="vsel-search"
            autoFocus
            placeholder="Search vaults…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="vsel-list">
            {list.length === 0 && <div className="vsel-none">No matches</div>}
            {list.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`vsel-opt ${v.id === value ? "on" : ""}`}
                onClick={() => {
                  onChange(v.id);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="vsel-opt-name">{v.name}</span>
                <span className="vsel-opt-id">#{v.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
