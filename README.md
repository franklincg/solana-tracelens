# Solana TraceLens

**Read-only Solana transaction observability and execution-log debugger.**

Solana TraceLens turns raw Solana RPC responses into a compact debugging view for developers. It helps inspect a transaction's execution path, program logs, fees, compute consumption, account keys, balance deltas, and public account metadata without connecting a wallet or signing anything.

**Live demo:** https://franklincg.github.io/solana-tracelens/

## What it does

### Transaction Inspector
Paste a Solana transaction signature and TraceLens loads the transaction from the selected JSON-RPC endpoint. It surfaces:

- execution status and error state
- slot, block time, fee, and compute units
- top-level instructions and program IDs
- program logs
- an invoke / success / failure execution timeline
- account keys involved in the transaction
- native SOL balance deltas

### Account Lens
Inspect a public Solana account with `getAccountInfo` and see:

- owner program
- SOL balance / lamports
- executable flag
- rent epoch metadata
- account data size information when available

### Meteora DBC Lens
Inspect a Meteora Dynamic Bonding Curve program-owned account from the same read-only interface. TraceLens:

- verifies the account owner against Meteora's published DBC program ID
- loads recent signatures for the account
- samples the corresponding transactions
- detects DBC program participation
- surfaces Anchor instruction labels from program logs when available
- never creates a pool, signs, or submits a transaction

This integration is intentionally observational. It uses live Solana RPC data and keeps the existing no-wallet safety model.

### Compare
Load two transaction signatures side by side and compare:

- status
- fee
- compute consumption
- instruction count
- log volume
- slot

## Safety model

TraceLens is intentionally **read-only**.

It does **not**:

- request private keys
- connect a wallet
- sign messages
- sign or submit transactions
- move assets
- take custody of funds

The application currently uses public Solana JSON-RPC read methods. A custom RPC URL can also be entered for the current browser session.

## Architecture

TraceLens is a static browser application:

```
Browser
  |
  +-- getTransaction
  +-- getAccountInfo
  |
Solana JSON-RPC
  |
  +-- normalized transaction summary
  +-- execution timeline
  +-- instruction view
  +-- program logs
  +-- account metadata
  +-- balance deltas
```

There is no backend custody layer and no wallet adapter.

## Run locally

No build step is required.

```bash
git clone https://github.com/franklincg/solana-tracelens.git
cd solana-tracelens
python -m http.server 8080
```

Then open:

```
http://localhost:8080
```

A local example dataset is included in the UI so the presentation can be explored without relying on a live transaction.

## Repository structure

- `index.html` — application layout and interface
- `app.js` — RPC client, validation, normalization, comparison, and rendering
- `styles.css` — responsive visual system

## Crypto World's Fair 2026

TraceLens is being prepared as an open-source developer-infrastructure project for the Solana Crypto World's Fair build window.

The current product is deliberately narrow: make public Solana execution data easier to inspect while keeping the tool safe, non-custodial, and simple enough to run as a static app.

### Current build

- public repository
- public live demo
- mainnet-beta and devnet support
- optional custom RPC
- transaction inspection
- public account inspection
- transaction comparison
- live Meteora DBC account/activity inspection
- responsive UI
- no paid API dependency
- no wallet or signing requirement

### Next technical milestones

- deeper Meteora DBC account decoding through the official SDK/IDL
- richer inner-instruction visualization
- token balance deltas
- common Solana program labels
- deeper error context
- expanded support for versioned transaction metadata
- optional Panta data integration for the Panta API sidetrack once authorized API credentials are available

## Links

- Live demo: https://franklincg.github.io/solana-tracelens/
- Repository: https://github.com/franklincg/solana-tracelens
