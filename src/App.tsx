import { useMemo, useState } from 'react'
import './App.css'

type SparseEntry = {
  id: string
  key: string
  value: string
  enabled: boolean
}

type SparseNode = {
  level: number
  index: number
  hash: string
  key?: string
  value?: string
  active?: boolean
  left?: SparseNode
  right?: SparseNode
}

type SparseProofStep = {
  level: number
  siblingHash: string
  siblingIndex: number
  currentIsLeft: boolean
  combinedHash: string
}

type LogEvent = {
  id: string
  kind: string
  actor: string
  detail: string
  timestamp: string
}

type LogNode = {
  start: number
  end: number
  depth: number
  hash: string
  left?: LogNode
  right?: LogNode
}

type LogProofStep = {
  sibling: LogNode
  currentIsLeft: boolean
  combinedHash: string
}

const SPARSE_DEPTH = 3

const INITIAL_SPARSE_ENTRIES: SparseEntry[] = [
  { id: 'state_001', key: '001', value: '42', enabled: true },
  { id: 'state_002', key: '010', value: '17', enabled: true },
  { id: 'state_003', key: '101', value: '83', enabled: true },
  { id: 'state_004', key: '110', value: '06', enabled: true },
]

const INITIAL_LOG_EVENTS: LogEvent[] = [
  { id: 'evt_001', kind: 'deposit', actor: 'Mina', detail: '80 credits', timestamp: '09:41:02' },
  { id: 'evt_002', kind: 'purchase', actor: 'Mina', detail: '12 credits', timestamp: '09:41:18' },
  { id: 'evt_003', kind: 'key rotation', actor: 'vault-7', detail: 'new signer', timestamp: '09:42:04' },
  { id: 'evt_004', kind: 'attestation', actor: 'Orion', detail: 'device 04', timestamp: '09:42:31' },
  { id: 'evt_005', kind: 'withdrawal', actor: 'Mina', detail: '9 credits', timestamp: '09:43:12' },
]

const LOG_KIND_OPTIONS = ['deposit', 'purchase', 'key rotation', 'attestation', 'withdrawal']

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664d, 0xa2bfe8a1, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits))
}

function sha256(input: string) {
  const bytes = new TextEncoder().encode(input)
  const blockLength = Math.ceil((bytes.length + 9) / 64) * 64
  const data = new Uint8Array(blockLength)
  const view = new DataView(data.buffer)
  data.set(bytes)
  data[bytes.length] = 0x80
  const bitLength = bytes.length * 8
  view.setUint32(blockLength - 8, Math.floor(bitLength / 2 ** 32))
  view.setUint32(blockLength - 4, bitLength >>> 0)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  for (let offset = 0; offset < blockLength; offset += 64) {
    const words = new Uint32Array(64)
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4)
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3)
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10)
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choose = (e & f) ^ (~e & g)
      const temp1 = (h + sigma1 + choose + SHA256_K[index] + words[index]) >>> 0
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (sigma0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('')
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}..${hash.slice(-4)}`
}

function sparseLeafHash(key: string, value: string) {
  return sha256(`smt:leaf|${key}|${value}`)
}

function sparseNodeHash(left: string, right: string) {
  return sha256(`smt:node|${left}|${right}`)
}

function buildSparseTree(entries: SparseEntry[]) {
  const emptyHashes = [sha256('smt:empty|leaf')]
  for (let level = 1; level <= SPARSE_DEPTH; level += 1) {
    emptyHashes.push(sparseNodeHash(emptyHashes[level - 1], emptyHashes[level - 1]))
  }

  const entryByKey = new Map(
    entries
      .filter((entry) => entry.enabled && /^[01]{3}$/.test(entry.key) && entry.value.trim())
      .map((entry) => [entry.key, entry]),
  )
  const leaves: SparseNode[] = Array.from({ length: 2 ** SPARSE_DEPTH }, (_, index) => {
    const key = index.toString(2).padStart(SPARSE_DEPTH, '0')
    const entry = entryByKey.get(key)
    return {
      level: 0,
      index,
      hash: entry ? sparseLeafHash(key, entry.value.trim()) : emptyHashes[0],
      key,
      value: entry?.value.trim(),
      active: Boolean(entry),
    }
  })
  const levels: SparseNode[][] = [leaves]

  for (let level = 1; level <= SPARSE_DEPTH; level += 1) {
    const previousLevel = levels[level - 1]
    levels.push(
      Array.from({ length: previousLevel.length / 2 }, (_, index) => {
        const left = previousLevel[index * 2]
        const right = previousLevel[index * 2 + 1]
        return {
          level,
          index,
          hash: sparseNodeHash(left.hash, right.hash),
          left,
          right,
        }
      }),
    )
  }

  return { depth: SPARSE_DEPTH, emptyHashes, leaves, levels, root: levels[SPARSE_DEPTH][0] }
}

function buildSparseProof(tree: ReturnType<typeof buildSparseTree>, key: string) {
  const normalizedKey = /^[01]{3}$/.test(key) ? key : '000'
  const index = Number.parseInt(normalizedKey, 2)
  const leaf = tree.leaves[index]
  const steps: SparseProofStep[] = []
  let currentHash = leaf.hash
  let currentIndex = index

  for (let level = 0; level < tree.depth; level += 1) {
    const siblingIndex = currentIndex ^ 1
    const sibling = tree.levels[level][siblingIndex]
    const currentIsLeft = currentIndex % 2 === 0
    currentHash = currentIsLeft
      ? sparseNodeHash(currentHash, sibling.hash)
      : sparseNodeHash(sibling.hash, currentHash)
    steps.push({ level: level + 1, siblingHash: sibling.hash, siblingIndex, currentIsLeft, combinedHash: currentHash })
    currentIndex = Math.floor(currentIndex / 2)
  }

  return { key: normalizedKey, leaf, steps, reconstructedRoot: currentHash, index }
}

function logLeafHash(event: LogEvent) {
  return sha256(`log:leaf|${event.id}|${event.kind}|${event.actor}|${event.detail}`)
}

function logNodeHash(left: string, right: string) {
  return sha256(`log:node|${left}|${right}`)
}

function largestPowerOfTwoLessThan(value: number) {
  let power = 1
  while (power * 2 < value) {
    power *= 2
  }
  return power
}

function buildLogTree(leafHashes: string[], start = 0, depth = 0): LogNode {
  if (leafHashes.length === 1) {
    return { start, end: start + 1, depth, hash: leafHashes[0] }
  }
  const split = largestPowerOfTwoLessThan(leafHashes.length)
  const left = buildLogTree(leafHashes.slice(0, split), start, depth + 1)
  const right = buildLogTree(leafHashes.slice(split), start + split, depth + 1)
  return { start, end: start + leafHashes.length, depth, hash: logNodeHash(left.hash, right.hash), left, right }
}

function buildLogProof(node: LogNode, index: number): LogProofStep[] {
  if (!node.left || !node.right) {
    return []
  }
  if (index < node.left.end) {
    return [
      { sibling: node.right, currentIsLeft: true, combinedHash: logNodeHash(node.left.hash, node.right.hash) },
      ...buildLogProof(node.left, index),
    ]
  }
  return [
    { sibling: node.left, currentIsLeft: false, combinedHash: logNodeHash(node.left.hash, node.right.hash) },
    ...buildLogProof(node.right, index),
  ]
}

function logTreeHeight(node: LogNode): number {
  if (!node.left || !node.right) {
    return node.depth
  }
  return Math.max(logTreeHeight(node.left), logTreeHeight(node.right))
}

function collectLogEdges(node: LogNode): Array<{ parent: LogNode; child: LogNode }> {
  if (!node.left || !node.right) {
    return []
  }
  return [
    { parent: node, child: node.left },
    { parent: node, child: node.right },
    ...collectLogEdges(node.left),
    ...collectLogEdges(node.right),
  ]
}

function eventTimestamp(index: number) {
  const minute = 44 + Math.floor(index / 4)
  const second = (8 + index * 13) % 60
  return `09:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

function App() {
  const [sparseEntries, setSparseEntries] = useState(INITIAL_SPARSE_ENTRIES)
  const [selectedSparseKey, setSelectedSparseKey] = useState('001')
  const [logEvents, setLogEvents] = useState(INITIAL_LOG_EVENTS)
  const [selectedLogIndex, setSelectedLogIndex] = useState(1)
  const [newEventKind, setNewEventKind] = useState(LOG_KIND_OPTIONS[0])
  const [newEventActor, setNewEventActor] = useState('Mina')
  const [newEventDetail, setNewEventDetail] = useState('')

  const sparseTree = useMemo(() => buildSparseTree(sparseEntries), [sparseEntries])
  const sparseProof = useMemo(() => buildSparseProof(sparseTree, selectedSparseKey), [sparseTree, selectedSparseKey])
  const activeSparseCount = sparseTree.leaves.filter((leaf) => leaf.active).length

  const logView = useMemo(() => {
    const leafHashes = logEvents.map(logLeafHash)
    const tree = leafHashes.length > 0 ? buildLogTree(leafHashes) : null
    const selectedIndex = Math.min(selectedLogIndex, Math.max(logEvents.length - 1, 0))
    const proof = tree ? buildLogProof(tree, selectedIndex).reverse() : []
    const roots = leafHashes.map((_, index) => buildLogTree(leafHashes.slice(0, index + 1)).hash)
    let reconstructedRoot = tree?.hash ?? sha256('log:empty')
    if (tree) {
      reconstructedRoot = leafHashes[selectedIndex]
      for (const step of proof) {
        reconstructedRoot = step.currentIsLeft
          ? logNodeHash(reconstructedRoot, step.sibling.hash)
          : logNodeHash(step.sibling.hash, reconstructedRoot)
      }
    }
    return { leafHashes, tree, proof, roots, selectedIndex, reconstructedRoot }
  }, [logEvents, selectedLogIndex])

  const updateSparseEntry = (entryIndex: number, field: 'key' | 'value', value: string) => {
    const nextValue = field === 'key' ? value.replace(/[^01]/g, '').slice(0, 3) : value
    if (field === 'key' && /^[01]{3}$/.test(nextValue)) {
      setSelectedSparseKey(nextValue)
    }
    setSparseEntries((entries) =>
      entries.map((entry, index) => {
        if (index !== entryIndex) {
          return entry
        }
        return { ...entry, [field]: nextValue }
      }),
    )
  }

  const addSparseEntry = () => {
    const usedKeys = new Set(sparseEntries.map((entry) => entry.key))
    const nextKey = Array.from({ length: 2 ** SPARSE_DEPTH }, (_, index) => index.toString(2).padStart(SPARSE_DEPTH, '0')).find(
      (key) => !usedKeys.has(key),
    )
    if (!nextKey) {
      return
    }
    const nextId = Math.max(...sparseEntries.map((entry) => Number(entry.id.replace('state_', '')) || 0), 0) + 1
    setSparseEntries((entries) => [...entries, { id: `state_${String(nextId).padStart(3, '0')}`, key: nextKey, value: '24', enabled: true }])
    setSelectedSparseKey(nextKey)
  }

  const removeSparseEntry = (entryIndex: number) => {
    setSparseEntries((entries) => entries.filter((_, index) => index !== entryIndex))
  }

  const resetDemo = () => {
    setSparseEntries(INITIAL_SPARSE_ENTRIES)
    setSelectedSparseKey('001')
    setLogEvents(INITIAL_LOG_EVENTS)
    setSelectedLogIndex(1)
    setNewEventKind(LOG_KIND_OPTIONS[0])
    setNewEventActor('Mina')
    setNewEventDetail('')
  }

  const appendEvent = () => {
    const detail = newEventDetail.trim()
    const actor = newEventActor.trim()
    if (!detail || !actor) {
      return
    }
    const nextEvent: LogEvent = {
      id: `evt_${String(logEvents.length + 1).padStart(3, '0')}`,
      kind: newEventKind,
      actor,
      detail,
      timestamp: eventTimestamp(logEvents.length),
    }
    setLogEvents((events) => [...events, nextEvent])
    setSelectedLogIndex(logEvents.length)
    setNewEventDetail('')
  }

  const sparseNodeX = (level: number, index: number) => (index + 0.5) * (760 / 2 ** (SPARSE_DEPTH - level))
  const sparseNodeY = (level: number) => 292 - level * 70
  const selectedSparseIndex = sparseProof.index
  const isSparsePathNode = (level: number, index: number) => index === (selectedSparseIndex >> level)
  const isSparseProofNode = (level: number, index: number) => level < SPARSE_DEPTH && index === ((selectedSparseIndex >> level) ^ 1)

  const logNodeX = (node: LogNode) => (((node.start + node.end) / 2) / Math.max(logEvents.length, 1)) * 760
  const logNodeY = (node: LogNode) => 38 + node.depth * 62
  const logHeight = logView.tree ? Math.max(260, (logTreeHeight(logView.tree) + 1) * 62 + 36) : 260
  const proofNodeKeys = new Set(logView.proof.map((step) => `${step.sibling.start}-${step.sibling.end}`))

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <i />
            <i />
          </div>
          <div>
            <span className="overline">Merkle / field notes</span>
            <h1>Proof instruments</h1>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="live-indicator"><b /> Interactive model</span>
          <span className="hash-label">SHA-256 / domain separated</span>
          <button className="reset-button" type="button" onClick={resetDemo}>Reset demo</button>
        </div>
      </header>

      <main>
        <section className="intro-band">
          <div className="intro-copy">
            <span className="section-kicker">Data integrity lab / 02 structures</span>
            <h2>Merkle structures, made inspectable.</h2>
            <p>
              Change a state or append an event. Watch one compact root commit to the whole structure, then inspect the
              sibling hashes a verifier needs to reproduce it.
            </p>
          </div>
          <div className="intro-stats" aria-label="Model summary">
            <div><strong>2</strong><span>structures</span></div>
            <div><strong>{activeSparseCount + logEvents.length}</strong><span>active records</span></div>
            <div><strong>O(log n)</strong><span>witness size</span></div>
          </div>
        </section>

        <section className="structure-section sparse-section" aria-labelledby="sparse-title">
          <div className="section-heading">
            <div className="section-number">01</div>
            <div>
              <span className="section-kicker">Keyed state / sparse commitment</span>
              <h2 id="sparse-title">Sparse Merkle tree</h2>
              <p>Prove a value, or prove that a key is empty, without sending the entire state map.</p>
            </div>
            <div className="section-tag">fixed depth / 3 bits</div>
          </div>

          <div className="sparse-layout">
            <aside className="control-rail" aria-label="Sparse state controls">
              <div className="rail-title-row">
                <div>
                  <span className="mini-label">State map</span>
                  <strong>{activeSparseCount} / 8 keys populated</strong>
                </div>
                <span className="rail-accent">editable</span>
              </div>
              <div className="state-list">
                {sparseEntries.map((entry, index) => (
                  <div className={`state-row ${entry.key === selectedSparseKey ? 'is-selected' : ''}`} key={entry.id}>
                    <button
                      className="state-select"
                      type="button"
                      aria-label={`Inspect state ${entry.key || 'unassigned'}`}
                      onClick={() => setSelectedSparseKey(entry.key || '000')}
                    >
                      <span className="state-dot" />
                    </button>
                    <div className="state-fields">
                      <label>
                        <span>key</span>
                        <input
                          value={entry.key}
                          maxLength={SPARSE_DEPTH}
                          inputMode="numeric"
                          aria-label="State key"
                          onChange={(event) => updateSparseEntry(index, 'key', event.target.value)}
                          onFocus={(event) => {
                            setSelectedSparseKey(entry.key || '000')
                            event.currentTarget.select()
                          }}
                          onClick={(event) => {
                            setSelectedSparseKey(entry.key || '000')
                            event.currentTarget.select()
                          }}
                        />
                      </label>
                      <label>
                        <span>value</span>
                        <input
                          value={entry.value}
                          aria-label="State value"
                          onChange={(event) => updateSparseEntry(index, 'value', event.target.value)}
                          onFocus={() => setSelectedSparseKey(entry.key || '000')}
                        />
                      </label>
                    </div>
                    <label className="switch" title="Include this state in the tree">
                      <input
                        type="checkbox"
                        checked={entry.enabled}
                        aria-label={`Include state ${entry.key || 'unassigned'}`}
                        onChange={(event) => {
                          setSparseEntries((entries) => entries.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))
                          setSelectedSparseKey(entry.key || '000')
                        }}
                      />
                      <span />
                    </label>
                    <button className="remove-button" type="button" aria-label={`Remove state ${entry.key || 'unassigned'}`} onClick={() => removeSparseEntry(index)}>
                      x
                    </button>
                  </div>
                ))}
              </div>
              <button className="add-button" type="button" onClick={addSparseEntry} disabled={sparseEntries.length >= 8}>
                <span>+</span> Add state
              </button>
              <div className="rail-note">
                <span className="note-mark">i</span>
                <p>Empty leaves resolve to a known default hash. That makes non-membership provable too.</p>
              </div>
            </aside>

            <div className="visual-stage">
              <div className="stage-header">
                <div>
                  <span className="mini-label">Current root commitment</span>
                  <strong className="root-hash">{shortHash(sparseTree.root.hash)}</strong>
                </div>
                <div className="verification-state"><span /> path selected: {sparseProof.key}</div>
              </div>
              <div className="tree-frame">
                <svg className="tree-svg sparse-svg" viewBox="0 0 760 330" role="img" aria-label="Sparse Merkle tree visualization">
                  <title>Sparse Merkle tree with a selected proof path</title>
                  {sparseTree.levels.slice(1).flatMap((levelNodes) => levelNodes.map((node) => (
                    <g key={`edge-${node.level}-${node.index}`}>
                      <line
                        className={`tree-edge ${isSparsePathNode(node.level, node.index) ? 'is-path' : ''}`}
                        x1={sparseNodeX(node.level, node.index)}
                        y1={sparseNodeY(node.level)}
                        x2={sparseNodeX(node.level - 1, node.index * 2)}
                        y2={sparseNodeY(node.level - 1)}
                      />
                      <line
                        className={`tree-edge ${isSparsePathNode(node.level, node.index) ? 'is-path' : ''}`}
                        x1={sparseNodeX(node.level, node.index)}
                        y1={sparseNodeY(node.level)}
                        x2={sparseNodeX(node.level - 1, node.index * 2 + 1)}
                        y2={sparseNodeY(node.level - 1)}
                      />
                    </g>
                  )))}
                  {sparseTree.levels.flatMap((levelNodes) => levelNodes.map((node) => {
                    const pathNode = isSparsePathNode(node.level, node.index)
                    const proofNode = isSparseProofNode(node.level, node.index)
                    const leaf = node.level === 0
                    return (
                      <g
                        key={`node-${node.level}-${node.index}`}
                        className={`sparse-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${leaf && node.active ? 'is-active' : ''}`}
                        onClick={() => leaf && node.key && setSelectedSparseKey(node.key)}
                      >
                        <rect x={sparseNodeX(node.level, node.index) - (leaf ? 34 : 30)} y={sparseNodeY(node.level) - 17} width={leaf ? 68 : 60} height="34" rx="5" />
                        <text className="node-hash" x={sparseNodeX(node.level, node.index)} y={sparseNodeY(node.level) - (leaf ? 1 : 0)} textAnchor="middle">{leaf ? (node.active ? node.value : 'empty') : shortHash(node.hash)}</text>
                        {leaf && <text className="node-key" x={sparseNodeX(node.level, node.index)} y={sparseNodeY(node.level) + 29} textAnchor="middle">{node.key}</text>}
                      </g>
                    )
                  }))}
                  <text className="tree-level-label" x="10" y="91">root</text>
                  <text className="tree-level-label" x="10" y="159">branch</text>
                  <text className="tree-level-label" x="10" y="229">branch</text>
                  <text className="tree-level-label" x="10" y="299">leaves</text>
                </svg>
              </div>

              <div className="proof-card">
                <div className="proof-card-header">
                  <div>
                    <span className="mini-label">Proof required</span>
                    <strong>{sparseProof.leaf.active ? `key ${sparseProof.key} = ${sparseProof.leaf.value}` : `key ${sparseProof.key} is empty`}</strong>
                  </div>
                  <span className="verified-badge"><span /> root matches</span>
                </div>
                <div className="proof-chain">
                  <div className="proof-chip primary"><span>leaf</span><b>{shortHash(sparseProof.leaf.hash)}</b></div>
                  {sparseProof.steps.map((step) => (
                    <div className="proof-chain-step" key={step.level}>
                      <span className="chain-arrow">-&gt;</span>
                      <div className="proof-chip"><span>+ {step.currentIsLeft ? 'right' : 'left'} sibling</span><b>{shortHash(step.siblingHash)}</b></div>
                    </div>
                  ))}
                  <div className="proof-chain-step">
                    <span className="chain-arrow">-&gt;</span>
                    <div className="proof-chip result"><span>reconstructed root</span><b>{shortHash(sparseProof.reconstructedRoot)}</b></div>
                  </div>
                </div>
                <p className="proof-explanation">A verifier needs the key, its value (or the empty default), and {sparseProof.steps.length} sibling hashes. Each bit of the key tells the verifier whether to hash left or right.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="structure-section log-section" aria-labelledby="log-title">
          <div className="section-heading">
            <div className="section-number coral">02</div>
            <div>
              <span className="section-kicker">Ordered events / append-only commitment</span>
              <h2 id="log-title">Merkle log</h2>
              <p>Commit to a timeline once, then verify that an event is included without downloading every event.</p>
            </div>
            <div className="section-tag coral-tag">append only / ordered</div>
          </div>

          <div className="log-layout">
            <aside className="control-rail log-rail" aria-label="Merkle log controls">
              <div className="rail-title-row">
                <div>
                  <span className="mini-label">Event stream</span>
                  <strong>{logEvents.length} committed events</strong>
                </div>
                <span className="rail-accent coral-text">immutable</span>
              </div>
              <div className="append-form">
                <label>
                  <span>kind</span>
                  <select value={newEventKind} onChange={(event) => setNewEventKind(event.target.value)}>
                    {LOG_KIND_OPTIONS.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  <span>actor</span>
                  <input value={newEventActor} onChange={(event) => setNewEventActor(event.target.value)} placeholder="who" />
                </label>
                <label className="wide-field">
                  <span>payload</span>
                  <input value={newEventDetail} onChange={(event) => setNewEventDetail(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && appendEvent()} placeholder="what happened" />
                </label>
                <button className="append-button" type="button" onClick={appendEvent} disabled={!newEventDetail.trim() || !newEventActor.trim()}>
                  <span>+</span> Append event
                </button>
              </div>
              <div className="event-list" aria-label="Committed events">
                {logEvents.map((event, index) => (
                  <button className={`event-row ${index === logView.selectedIndex ? 'is-selected' : ''}`} type="button" key={event.id} onClick={() => setSelectedLogIndex(index)}>
                    <span className="event-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="event-copy"><strong>{event.kind}</strong><span>{event.actor} / {event.detail}</span></span>
                    <span className="event-time">{event.timestamp}</span>
                  </button>
                ))}
              </div>
              <div className="rail-note coral-note">
                <span className="note-mark">!</span>
                <p>There is no edit or delete operation. A new event changes the root, while old roots remain useful snapshots.</p>
              </div>
            </aside>

            <div className="visual-stage log-stage">
              <div className="stage-header">
                <div>
                  <span className="mini-label">Current log root / snapshot {logEvents.length}</span>
                  <strong className="root-hash coral-root">{logView.tree ? shortHash(logView.tree.hash) : 'empty'}</strong>
                </div>
                <div className="verification-state coral-state"><span /> event selected: #{logView.selectedIndex + 1}</div>
              </div>
              <div className="tree-frame log-tree-frame">
                {logView.tree ? (
                  <svg className="tree-svg log-svg" viewBox={`0 0 760 ${logHeight}`} role="img" aria-label="Append-only Merkle log tree visualization">
                    <title>Merkle log tree with selected event proof path</title>
                    {collectLogEdges(logView.tree).map(({ parent, child }) => {
                      const childIsPath = child.start <= logView.selectedIndex && logView.selectedIndex < child.end
                      const childIsProof = proofNodeKeys.has(`${child.start}-${child.end}`)
                      return <line className={`tree-edge ${childIsPath ? 'is-path' : ''} ${childIsProof ? 'is-proof-edge' : ''}`} key={`${parent.start}-${parent.end}-${child.start}`} x1={logNodeX(parent)} y1={logNodeY(parent)} x2={logNodeX(child)} y2={logNodeY(child)} />
                    })}
                    {(() => {
                      const nodes: LogNode[] = []
                      const visit = (node: LogNode) => {
                        nodes.push(node)
                        if (node.left) visit(node.left)
                        if (node.right) visit(node.right)
                      }
                      visit(logView.tree)
                      return nodes.map((node) => {
                        const pathNode = node.start <= logView.selectedIndex && logView.selectedIndex < node.end
                        const proofNode = proofNodeKeys.has(`${node.start}-${node.end}`)
                        const leaf = !node.left
                        return (
                          <g className={`log-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${node === logView.tree ? 'is-root' : ''}`} key={`${node.start}-${node.end}`}>
                            <rect x={logNodeX(node) - (leaf ? 34 : 31)} y={logNodeY(node) - 18} width={leaf ? 68 : 62} height="36" rx="5" />
                            <text className="node-hash" x={logNodeX(node)} y={logNodeY(node) + 3} textAnchor="middle">{leaf ? `#${node.start + 1}` : shortHash(node.hash)}</text>
                            {leaf && <text className="node-key" x={logNodeX(node)} y={logNodeY(node) + 29} textAnchor="middle">{logEvents[node.start].id}</text>}
                          </g>
                        )
                      })
                    })()}
                    <text className="tree-level-label" x="10" y="42">root</text>
                    <text className="tree-level-label" x="10" y={logHeight - 8}>events</text>
                  </svg>
                ) : <div className="empty-log">Append an event to grow the log.</div>}
              </div>

              <div className="proof-card log-proof-card">
                <div className="proof-card-header">
                  <div>
                    <span className="mini-label">Inclusion proof</span>
                    <strong>{logEvents[logView.selectedIndex].id} / {logEvents[logView.selectedIndex].kind}</strong>
                  </div>
                  <span className="verified-badge coral-badge"><span /> root matches</span>
                </div>
                <div className="log-proof-table">
                  <div className="proof-table-head"><span>step</span><span>sibling subtree</span><span>hash</span><span>combine</span></div>
                  <div className="proof-table-row first-row"><span>leaf</span><span>{logEvents[logView.selectedIndex].id}</span><b>{shortHash(logView.leafHashes[logView.selectedIndex])}</b><span>start</span></div>
                  {logView.proof.map((step, index) => (
                    <div className="proof-table-row" key={`${step.sibling.start}-${step.sibling.end}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <span>{step.sibling.start + 1}-{step.sibling.end} {step.currentIsLeft ? 'right' : 'left'} subtree</span>
                      <b>{shortHash(step.sibling.hash)}</b>
                      <span>left + right</span>
                    </div>
                  ))}
                </div>
                <div className="proof-result-line"><span>reconstructed root</span><b>{shortHash(logView.reconstructedRoot)}</b><span className="match-label">matches snapshot</span></div>
                <p className="proof-explanation">The sibling subtrees are enough to climb from one event leaf to the committed root. The event payload itself is not hidden; its integrity and position are what the witness proves.</p>
              </div>

              <div className="root-history">
                <div className="history-heading"><span className="mini-label">Root history</span><span>each append creates a new snapshot commitment</span></div>
                <div className="history-list">
                  {logView.roots.map((root, index) => (
                    <button type="button" className={`history-item ${index === logView.selectedIndex ? 'is-selected' : ''}`} key={`${root}-${index}`} onClick={() => setSelectedLogIndex(index)}>
                      <span>#{index + 1}</span><b>{shortHash(root)}</b>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="why-band" aria-labelledby="why-title">
          <div className="why-heading">
            <span className="section-kicker">Why the pattern matters</span>
            <h2 id="why-title">One root. Small witnesses. Big state.</h2>
          </div>
          <div className="why-grid">
            <article>
              <span className="why-index">A / STATE</span>
              <h3>Sparse trees make absence visible.</h3>
              <p>Known defaults let a verifier confirm that a key is empty without receiving all the other keys in the map.</p>
            </article>
            <article>
              <span className="why-index coral-text">B / HISTORY</span>
              <h3>Logs make order auditable.</h3>
              <p>Each append changes the root. A signed snapshot plus an inclusion witness makes later tampering detectable.</p>
            </article>
            <article>
              <span className="why-index blue-text">C / PROOF</span>
              <h3>Verification scales logarithmically.</h3>
              <p>The verifier recomputes one path using sibling hashes instead of downloading every unrelated branch.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer"><span>MERKLE / FIELD NOTES</span><span>interactive proof laboratory</span><span>deterministic demo hashes</span></footer>
    </div>
  )
}

export default App
