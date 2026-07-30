# Merkle Proof Instruments

An interactive visualization of sparse Merkle trees and append-only Merkle logs.
Edit state, append events, and inspect the sibling hashes required to reconstruct
each committed root.

## Run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Checks

```bash
npm run build
npm run lint
```

The demo uses deterministic, domain-separated SHA-256 hashes and runs entirely
in the browser.
