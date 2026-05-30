# Custody Ops Console (Fireblocks core API)

A real custody-operations console wired directly to the **Fireblocks core API**.
It lists the live vault accounts in your sandbox workspace, lets you initiate
transfers (vault → vault or vault → external address), and tracks each
transaction through the **real Fireblocks lifecycle** — including holds created
by your **Transaction Authorization Policy (TAP)**.

Unlike a front-end demo, this app actually drives the platform: every vault and
balance you see is read from your workspace, and every transfer is a real
Fireblocks transaction governed by your policies.

## Why this is the "real" one

- It calls the Fireblocks core API (`@fireblocks/ts-sdk`), authenticated with
  JWT signatures from your **RSA secret key** — exactly how production
  integrations work.
- The secret never touches the browser. All Fireblocks calls run in **server-side
  API routes** (`app/api/*`, Node runtime). The client only talks to those
  routes.
- It connects to the **same sandbox** where your vaults, tokens, and TAP rules
  already live — so it operates the infrastructure you built, not a toy copy.

## Security model (read this)

This app holds **no secret in client code**. You provide credentials server-side:

- `FIREBLOCKS_API_KEY` — your sandbox API user key (UUID).
- Your **RSA private key**, provided either as a `fireblocks_secret.key` file at
  the project root (gitignored) or pasted into `FIREBLOCKS_SECRET_KEY`.

Never commit the key. Never prefix Fireblocks credentials with `NEXT_PUBLIC_`.
The `.gitignore` already excludes `*.key` and `.env.local`.

## 1. Prerequisites

- Node.js 18.18+ (or 20+)
- A Fireblocks **sandbox** workspace with at least one vault (you already have
  several).
- An **API user** in the Console (Settings → API Users): create one, generate a
  CSR / RSA key pair, and assign it a role. To submit transactions, the API user
  needs signing rights (or an API co-signer). A read-only role still powers the
  vault and transaction views.

## 2. Run locally

```bash
cp .env.local.example .env.local           # set FIREBLOCKS_API_KEY + env
cp /path/to/your/fireblocks_secret.key .   # place the RSA key at project root
npm install
npm run dev
```

Open http://localhost:3000. If credentials resolve, the header shows
**Connected** and your real vaults load.

## 3. Demo flow (what to record)

1. Vaults load with live balances from your sandbox.
2. Pick a source vault, a destination vault (or external address), asset
   (`AMOY_POLYGON_TEST` by default), and amount → **Submit transfer**.
3. Watch the transaction appear in the lifecycle feed and move through statuses:
   `SUBMITTED → PENDING_AUTHORIZATION → QUEUED → BROADCASTING → COMPLETED`.
4. **The money shot:** if a TAP rule requires approval, the transfer is *accepted
   but held* in `PENDING_AUTHORIZATION`. The console says so explicitly. Approve
   it in the Fireblocks Console and watch it proceed. That hold is the proof the
   platform — not the app — is enforcing governance.

Whether a transfer auto-completes or pauses for approval depends on the API
user's role and your TAP policy. That's the point: the app submits; Fireblocks
governs.

## 4. Deploy to Vercel

1. Push to GitHub, import in Vercel.
2. Add env vars in project settings:
   - `FIREBLOCKS_API_KEY`
   - `FIREBLOCKS_SECRET_KEY` — paste the full PEM as **one line with `\n`** between
     lines (Vercel env vars are single-line). The app converts `\n` back to real
     newlines.
   - `FIREBLOCKS_ENV=sandbox`, `NEXT_PUBLIC_DEFAULT_ASSET=AMOY_POLYGON_TEST`
   - `APP_ACCESS_USER` and `APP_ACCESS_PASSWORD` — **required for a public URL.**
     This app authenticates as you, so without a gate anyone with the link can
     operate your sandbox vaults. Setting these puts a password in front of the
     whole app (including the API). Share the URL + password only with people you
     want to have access.
3. Deploy. The API routes run as Node serverless functions.

> **Public-access warning:** this is a privileged single-operator tool, not a
> multi-user app. The `APP_ACCESS_USER`/`APP_ACCESS_PASSWORD` gate is the minimum
> protection for any internet-facing deployment. (For an app designed to be open
> to many users, that's the embedded-wallet pattern, which is non-custodial and
> per-user.)

## Structure

```
app/
  layout.tsx           fonts
  globals.css          institutional ops styling
  page.tsx             console UI (health gate, polling)
  api/
    health/route.ts    is the server configured? (no secrets leaked)
    vaults/route.ts    GET live vault accounts + balances
    transactions/route.ts  GET recent txs · POST create transfer
components/
  VaultGrid.tsx        vault cards
  TransferPanel.tsx    governed transfer form
  TxFeed.tsx           lifecycle feed
lib/
  fireblocks.ts        SERVER-ONLY SDK init + helpers
  types.ts             shared client-safe types
```

## Notes

- SDK version is pinned to current-major (`@fireblocks/ts-sdk ^7`); run
  `npm install` for the live build.
- This is sandbox-only by design. Pointing it at a production workspace pulls in
  real custody, approver quorums, and compliance you don't want for a portfolio
  piece — the `FIREBLOCKS_ENV` switch exists but keep it on `sandbox`.
