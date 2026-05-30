"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Vault, type Tx } from "@/lib/types";
import VaultGrid from "@/components/VaultGrid";
import TransferPanel from "@/components/TransferPanel";
import TxFeed from "@/components/TxFeed";
import ThemeToggle from "@/components/ThemeToggle";
import { usePersistentState } from "@/lib/usePersistentState";

type Health = { configured: boolean; env: string } | null;

function Mark() {
  return (
    <svg className="logo" viewBox="0 0 38 38" fill="none" aria-hidden>
      <rect x="3" y="3" width="32" height="32" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M19 9l9 5v9l-9 5-9-5v-9l9-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="19" cy="18.5" r="2.4" fill="currentColor" />
    </svg>
  );
}

export default function Home() {
  const [health, setHealth] = useState<Health>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loadingV, setLoadingV] = useState(true);
  const [loadingT, setLoadingT] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tab, setTab] = usePersistentState<"vaults" | "activity">("coc:tab", "vaults");

  // Transfer routing state (lifted so vault cards can fill either end).
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [mode, setMode] = useState<"vault" | "external">("vault");
  const [targeting, setTargeting] = useState<"source" | "dest" | null>(null);

  const loadVaults = useCallback(async () => {
    setLoadingV(true);
    try {
      const r = await fetch("/api/vaults");
      const d = await r.json();
      if (r.ok) {
        setVaults(d.vaults);
        setApiError(null);
      } else if (d.error !== "not_configured") {
        setApiError(d.error);
      }
    } catch {
      setApiError("Could not reach the server.");
    } finally {
      setLoadingV(false);
    }
  }, []);

  const loadTxs = useCallback(async () => {
    try {
      const r = await fetch("/api/transactions");
      const d = await r.json();
      if (r.ok) setTxs(d.transactions);
    } catch {
      /* keep last good */
    } finally {
      setLoadingT(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => {
        setHealth(h);
        if (h.configured) {
          loadVaults();
          loadTxs();
        } else {
          setLoadingV(false);
          setLoadingT(false);
        }
      })
      .catch(() => setHealth({ configured: false, env: "sandbox" }));
  }, [loadVaults, loadTxs]);

  useEffect(() => {
    if (!health?.configured) return;
    const id = setInterval(loadTxs, 6000);
    return () => clearInterval(id);
  }, [health, loadTxs]);

  const stats = useMemo(() => {
    const assets = new Set<string>();
    vaults.forEach((v) => v.assets.forEach((a) => assets.add(a.id)));
    const funded = vaults.filter((v) => v.assets.some((a) => Number(a.total) > 0)).length;
    const pending = txs.filter((t) => t.status.toUpperCase().startsWith("PENDING")).length;
    return { vaults: vaults.length, funded, assets: assets.size, pending };
  }, [vaults, txs]);

  // Direct: a card's "source"/"dest" button sets that role (no modes).
  const chooseSource = (id: string) => {
    setSource(id);
    if (id === dest) setDest("");
  };
  const chooseDest = (id: string) => {
    setMode("vault");
    setDest(id);
    if (id === source) setSource("");
  };
  // When a panel field is "targeting", a card-body click fills that field.
  const pickTargeted = (id: string) => {
    if (targeting === "source") chooseSource(id);
    else if (targeting === "dest") chooseDest(id);
    setTargeting(null);
  };

  const Header = (
    <div className="hdr">
      <div className="hdr-left">
        <Mark />
        <div className="title-block">
          <h1>Custody Ops Console</h1>
          <p>Fireblocks core API · live</p>
        </div>
      </div>
      <div className="hdr-right">
        <ThemeToggle />
        <span className="chip sandbox">{health?.env ?? "sandbox"}</span>
        <span className="chip">
          <span className={`dot ${health?.configured ? "live" : "down"}`} />
          {health?.configured ? "Connected" : "Offline"}
        </span>
      </div>
    </div>
  );

  if (health && !health.configured) {
    return (
      <div className="wrap">
        {Header}
        <div className="setup">
          <h2>Connect your Fireblocks sandbox</h2>
          <p>This console talks to the real Fireblocks core API. Credentials live only on the server — never sent to the browser.</p>
          <ol>
            <li>Copy <code>.env.local.example</code> to <code>.env.local</code>.</li>
            <li>Set <code>FIREBLOCKS_API_KEY</code> to your sandbox API user key.</li>
            <li>Put your RSA private key in <code>fireblocks_secret.key</code> at the project root, or paste it into <code>FIREBLOCKS_SECRET_KEY</code>.</li>
            <li>Restart the dev server.</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      {Header}

      {apiError && <div className="warn-banner">Fireblocks API error: {apiError}</div>}

      <div className="intro page-enter">
        <p className="intro-lead">
          A custody operations console wired straight to the <strong>Fireblocks core API</strong>.
          Every vault, balance, and transfer here is live — the app submits transactions, but
          Fireblocks itself governs them.
        </p>
        <div className="intro-values">
          <div className="iv">
            <div className="iv-h">MPC-secured keys</div>
            <div className="iv-b">Assets are protected by multi-party computation — no single private key ever exists to be stolen or leaked.</div>
          </div>
          <div className="iv">
            <div className="iv-h">Policy-governed</div>
            <div className="iv-b">The Transaction Authorization Policy approves, holds, or blocks every transfer at the platform layer — not in this app.</div>
          </div>
          <div className="iv">
            <div className="iv-h">One API, many chains</div>
            <div className="iv-b">Bitcoin, Ethereum, Polygon and tokenized assets all move through a single governed integration.</div>
          </div>
        </div>
      </div>

      <div className="stats page-enter">
        <div className="stat">
          <div className="stat-num">{loadingV ? "—" : stats.vaults}</div>
          <div className="stat-label">Vault accounts</div>
        </div>
        <div className="stat">
          <div className="stat-num">{loadingV ? "—" : stats.funded}</div>
          <div className="stat-label">Funded vaults</div>
        </div>
        <div className="stat">
          <div className={`stat-num ${stats.pending > 0 ? "accent" : ""}`}>{loadingT ? "—" : stats.pending}</div>
          <div className="stat-label">Pending approval</div>
        </div>
        <div className="stat">
          <div className="stat-num">{loadingV ? "—" : stats.assets}</div>
          <div className="stat-label">Assets tracked</div>
        </div>
      </div>

      <div className="grid page-enter">
        <div>
          <div className="tabs">
            <button className={`tab ${tab === "vaults" ? "on" : ""}`} onClick={() => setTab("vaults")}>
              Vaults <span className="tab-count">{vaults.length || ""}</span>
            </button>
            <button className={`tab ${tab === "activity" ? "on" : ""}`} onClick={() => setTab("activity")}>
              Activity <span className="tab-count">{txs.length || ""}</span>
            </button>
            {tab === "vaults" && (
              <button className="refresh tab-right" onClick={loadVaults} disabled={loadingV}>
                {loadingV ? "loading…" : "refresh"}
              </button>
            )}
            {tab === "activity" && <span className="tab-right meta">auto · 6s</span>}
          </div>

          {tab === "vaults" ? (
            <VaultGrid
              vaults={vaults}
              loading={loadingV}
              source={source}
              dest={dest}
              targeting={targeting}
              onSetSource={chooseSource}
              onSetDest={chooseDest}
              onPickTargeted={pickTargeted}
            />
          ) : (
            <TxFeed txs={txs} loading={loadingT} />
          )}
        </div>

        <TransferPanel
          vaults={vaults}
          source={source}
          dest={dest}
          mode={mode}
          targeting={targeting}
          setSource={chooseSource}
          setDest={chooseDest}
          setMode={setMode}
          setTargeting={setTargeting}
          onSubmitted={() => {
            setTab("activity");
            loadTxs();
            setTimeout(loadVaults, 1500);
          }}
        />
      </div>
    </div>
  );
}
