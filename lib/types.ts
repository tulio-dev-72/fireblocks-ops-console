export type VaultAsset = { id: string; total: string; available: string };
export type Vault = { id: string; name: string; assets: VaultAsset[] };

export type Tx = {
  id: string;
  status: string;
  subStatus?: string;
  assetId?: string;
  amount?: string;
  sourceName?: string;
  destName?: string;
  txHash?: string;
  createdAt?: number;
};
