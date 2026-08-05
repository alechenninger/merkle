# Merkle Proof Instruments

An interactive visualization of sparse Merkle trees and append-only Merkle logs,
with a protocol-shaped Key Transparency client walkthrough at
`/key-transparency`.

## Key Transparency

The Key Transparency page walks through one two-query story from
[draft-ietf-keytrans-protocol-05](https://www.ietf.org/archive/id/draft-ietf-keytrans-protocol-05.html): Bob verified a tree of size 5, Alice rotated to key version 1, two log entries were appended, and Bob searched for Alice's latest key with `last = 5`.
It keeps `SearchRequest`, `SearchResponse`, `BinaryLadderStep`,
`CombinedTreeProof`, retained full-subtree heads, frontier entries, and the
root-reconstruction checks visible. The prefix tree is a subordinate inspector
for the selected binary-ladder step.

The app uses deterministic, domain-separated SHA-256 values as visual stand-ins
for VRF proofs, HMAC commitments, signatures, and wire encoding. It models this
single search path and its verification state; it is not a production
implementation of every draft operation, deployment mode, or wire serializer.

## Run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

The demo is also hosted at https://alechenninger.github.io/merkle/.

## Checks

```bash
npm run build
npm run lint
npm test
```

The demo uses deterministic, domain-separated SHA-256 hashes and runs entirely
in the browser.
