import { type VaultAsset } from "./types";

// Turn a long Fireblocks asset id into a clean ticker for display.
export function assetTicker(id: string): string {
  if (id === "AMOY_POLYGON_TEST") return "POL";
  if (id.startsWith("ETH_TEST")) return "ETH";
  if (id.startsWith("BTC_TEST")) return "BTC";
  return id.split("_")[0];
}

export function fmtNum(v: string | number): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return String(v);
  if (n === 0) return "0";
  if (n > 0 && n < 0.0001) return "<0.0001";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function vaultGroup(name: string): { key: string; label: string } {
  const n = name.toLowerCase();
  if (n.startsWith("am-")) return { key: "am", label: "Asset Manager" };
  if (n.startsWith("psp-"))
    return { key: "psp", label: "Payment Service Provider" };
  if (n.startsWith("td-")) return { key: "td", label: "Trading Desk" };
  return { key: "other", label: "Other" };
}

export const GROUP_ORDER = ["am", "psp", "td", "other"];

export function positiveAssets(assets: VaultAsset[]): VaultAsset[] {
  return assets.filter((a) => Number(a.total) > 0);
}

// Classify an asset as a native coin, a stablecoin, or a generic token.
export function assetKind(id: string): { key: "coin" | "stablecoin" | "token"; label: string } {
  const u = id.toUpperCase();
  if (/^(USDC|USDT|DAI|DBUSD|PYUSD|TUSD|BUSD|USDP)/.test(u) || u.includes("USD"))
    return { key: "stablecoin", label: "Stablecoin" };
  if (
    u === "AMOY_POLYGON_TEST" ||
    u.startsWith("ETH_TEST") ||
    u.startsWith("BTC_TEST") ||
    ["ETH", "BTC", "POL", "MATIC", "SOL"].includes(u)
  )
    return { key: "coin", label: "Coin" };
  return { key: "token", label: "Token" };
}
