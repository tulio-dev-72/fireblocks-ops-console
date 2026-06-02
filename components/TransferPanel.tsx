"use client";

import { useEffect, useState } from "react";
import { type Vault } from "@/lib/types";
import { assetTicker, fmtNum, positiveAssets } from "@/lib/format";
import VaultSelect from "./VaultSelect";
import InfoTip from "./InfoTip";

type Target = "source" | "dest" | null;
type Result =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; id: string; status: string }
  | { kind: "err"; message: string };

const HOLD = ["PENDING_AUTHORIZATION", "PENDING_SIGNATURE", "PENDING_3RD_PARTY"];
const isAddress = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);

export default function TransferPanel({
  vaults,
  source,
  dest,
  mode,
  targeting,
  setSource,
  setDest,
  setMode,
  setTargeting,
  onSubmitted,
}: {
  vaults: Vault[];
  source: string;
  dest: string;
  mode: "vault" | "external";
  targeting: Target;
  setSource: (id: string) => void;
  setDest: (id: string) => void;
  setMode: (m: "vault" | "external") => void;
  setTargeting: (t: Target) => void;
  onSubmitted: () => void;
}) {
  const [destAddr, setDestAddr] = useState("");
  const [asset, setAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const srcVault = vaults.find((v) => v.id === source);
  const srcAssets = srcVault ? positiveAssets(srcVault.assets) : [];

  useEffect(() => {
    if (srcAssets.length > 0) {
      if (!srcAssets.find((a) => a.id === asset)) setAsset(srcAssets[0].id);
    } else if (asset) {
      setAsset("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, vaults]);

  const selAsset = srcAssets.find((a) => a.id === asset);
  const avail = selAsset ? Number(selAsset.total) : 0;
  const overBal = Number(amount) > avail;
  const badAddr = mode === "external" && destAddr.length > 0 && !isAddress(destAddr);

  const valid =
    source && asset && Number(amount) > 0 && !overBal &&
    (mode === "vault" ? dest && dest !== source : isAddress(destAddr));

  const submit = async () => {
    setResult({ kind: "sending" });
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset,
          amount,
          sourceVaultId: source,
          destVaultId: mode === "vault" ? dest : undefined,
          destAddress: mode === "external" ? destAddr : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transaction failed");
      setResult({ kind: "ok", id: data.id, status: data.status });
      setAmount("");
      onSubmitted();
    } catch (e: any) {
      setResult({ kind: "err", message: e.message });
    }
  };

  const PickBtn = ({ which }: { which: "source" | "dest" }) => (
    <button
      className={`pickbtn ${targeting === which ? "on" : ""}`}
      onClick={() => setTargeting(targeting === which ? null : which)}
    >
      {targeting === which ? "✕ cancel" : "pick from cards"}
    </button>
  );

  return (
    <div className="panel">
      <h3>
        New transfer{" "}
        <InfoTip
          label="What does this panel do?"
          content="Submits a real transaction to the Fireblocks core API. The app only requests the transfer; Fireblocks policy decides whether it signs immediately, is held for approval, or is blocked."
        />
      </h3>
      <p className="route-hint">Pick from the dropdowns, the per-card buttons, or “pick from cards” then click a card.</p>

      <div className={`field ${targeting === "source" ? "armed-source" : ""}`}>
        <label className="label-row">
          <span>
            From (source){" "}
            <InfoTip
              label="What is the source?"
              content="The Fireblocks vault the assets move out of. Only funded vaults can be a source; funds leave MPC custody only after policy authorizes and Fireblocks signs."
            />
          </span>
          <PickBtn which="source" />
        </label>
        <VaultSelect vaults={vaults} value={source} onChange={setSource} placeholder="Select source vault…" requireFunds exclude={dest} />
      </div>

      <div className="route-arrow">↓</div>

      <div className="seg-row">
        <div className="seg">
          <button className={mode === "vault" ? "on" : ""} onClick={() => setMode("vault")}>To vault</button>
          <button className={mode === "external" ? "on" : ""} onClick={() => setMode("external")}>To address</button>
        </div>
        <InfoTip
          label="Vault vs address?"
          content="“To vault” moves assets between two vaults in this workspace. “To address” sends to an external on-chain address. External destinations are exactly where allowlist and policy controls matter most."
        />
      </div>

      {mode === "vault" ? (
        <div className={`field ${targeting === "dest" ? "armed-dest" : ""}`}>
          <label className="label-row"><span>To (destination)</span><PickBtn which="dest" /></label>
          <VaultSelect vaults={vaults} value={dest} onChange={setDest} placeholder="Select destination vault…" exclude={source} />
        </div>
      ) : (
        <div className="field">
          <label>Destination address</label>
          <input className="input" placeholder="0x…" value={destAddr} spellCheck={false} onChange={(e) => setDestAddr(e.target.value.trim())} />
          {badAddr && <p className="hint err">Not a valid address.</p>}
        </div>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <label>
          Asset{" "}
          <InfoTip
            label="What is the asset?"
            content="Which asset to move, scoped to what the source vault actually holds. Fireblocks identifies each asset by an ID (e.g. ETH_TEST5), shown with the available balance."
          />
        </label>
        <select className="select" value={asset} disabled={!source} onChange={(e) => setAsset(e.target.value)}>
          {srcAssets.length === 0 && <option value="">Pick a source vault first</option>}
          {srcAssets.map((a) => (
            <option key={a.id} value={a.id}>{assetTicker(a.id)} · {fmtNum(a.total)} available</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label-row">
          <span>
            Amount{" "}
            <InfoTip
              label="What about the amount?"
              content="How much to transfer. Larger amounts and external destinations are the kind of conditions a Transaction Authorization Policy can route to approval or block before anything signs."
            />
          </span>
          {selAsset && <button className="max" onClick={() => setAmount(String(avail))}>max {fmtNum(avail)}</button>}
        </label>
        <input className="input" placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
        {overBal && <p className="hint err">Exceeds available balance.</p>}
      </div>

      <button className="submit" disabled={!valid || result.kind === "sending"} onClick={submit}>
        {result.kind === "sending" ? "Submitting to Fireblocks…" : "Submit transfer"}
      </button>

      {result.kind === "ok" && (
        <div className={`note ${HOLD.includes(result.status) ? "hold" : "ok"}`}>
          {HOLD.includes(result.status) ? (
            <>Accepted and held by policy: <strong>{result.status}</strong>. Approve it in the Fireblocks Console.</>
          ) : (
            <>Submitted: <strong>{result.status}</strong>.</>
          )}
          <br />
          <span className="mono" style={{ fontSize: 11 }}>{result.id}</span>
        </div>
      )}
      {result.kind === "err" && <div className="note err">{result.message}</div>}
    </div>
  );
}
