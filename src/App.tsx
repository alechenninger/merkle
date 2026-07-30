import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
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
  path?: string
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

const MIN_SPARSE_DEPTH = 2
const MAX_SPARSE_DEPTH = 8
const DEFAULT_SPARSE_DEPTH = 4
const SHA256_BYTES = 32

const INITIAL_SPARSE_ENTRIES: SparseEntry[] = [
  { id: 'state_001', key: 'account:alice', value: '42', enabled: true },
  { id: 'state_002', key: 'account:bob', value: '17', enabled: true },
  { id: 'state_003', key: 'account:erin', value: '83', enabled: true },
  { id: 'state_004', key: 'account:dave', value: '06', enabled: true },
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
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
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

function shortKey(key: string) {
  return key.length > 6 ? `${key.slice(0, 4)}..` : key
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

function formatByteCount(bytes: number) {
  return `${bytes.toLocaleString()} B`
}

function valueSummary(value: string) {
  return value.length > 24 ? `${value.slice(0, 20)}... (${formatByteCount(utf8ByteLength(value))})` : value
}

type TooltipTag = 'b' | 'div' | 'span' | 'strong'

type TooltipDetails = {
  badge: string
  digest?: string
  equation?: string
  inputs?: string
  proofRole?: string
}

type InfoTipProps = {
  text?: string
  details?: TooltipDetails
  children: ReactNode
  as?: TooltipTag
  className?: string
  below?: boolean
}

type TooltipPosition = {
  left: number
  top: number
  below: boolean
}

function tooltipAriaLabel(text: string | undefined, details?: TooltipDetails) {
  if (!details) {
    return text ?? ''
  }
  return [
    details.badge,
    details.digest && `Digest: ${details.digest}`,
    details.equation && `Equation: ${details.equation}`,
    details.inputs && `Inputs: ${details.inputs}`,
    details.proofRole && `Proof role: ${details.proofRole}`,
  ].filter(Boolean).join('. ')
}

function TooltipDetailsView({ details }: { details: TooltipDetails }) {
  return (
    <>
      <div className="tooltip-badge-row">
        <span className="tooltip-badge">{details.badge}</span>
        {details.proofRole && <span className="tooltip-role-badge">{details.proofRole}</span>}
      </div>
      {details.digest && <div className="tooltip-field"><span className="tooltip-field-label">digest</span><code className="tooltip-field-value">{details.digest}</code></div>}
      {details.equation && <div className="tooltip-field"><span className="tooltip-field-label">equation</span><code className="tooltip-field-value">{details.equation}</code></div>}
      {details.inputs && <div className="tooltip-field"><span className="tooltip-field-label">inputs</span><code className="tooltip-field-value">{details.inputs}</code></div>}
    </>
  )
}

function InfoTip({ text, details, children, as = 'span', className = '', below = false }: InfoTipProps) {
  const Tag = as
  const triggerRef = useRef<HTMLElement | null>(null)
  const setTriggerRef = (element: HTMLElement | null) => {
    triggerRef.current = element
  }
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const isOpen = isHovered || isFocused

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) {
        return
      }
      const rect = trigger.getBoundingClientRect()
      const cardWidth = Math.min(340, Math.max(0, window.innerWidth - 28))
      const minCenter = 14 + cardWidth / 2
      const maxCenter = window.innerWidth - 14 - cardWidth / 2
      const left = Math.max(minCenter, Math.min(maxCenter, rect.left + rect.width / 2))
      const showBelow = below || rect.top < 170
      setPosition({ left, top: showBelow ? rect.bottom + 10 : rect.top - 10, below: showBelow })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [below, isOpen])

  const tooltipCard = isOpen && position && typeof document !== 'undefined' ? createPortal(
    <div
      className={`info-tip-card ${position.below ? 'is-below' : 'is-above'}`}
      style={{ left: position.left, top: position.top }}
      role="tooltip"
    >
      {details ? <TooltipDetailsView details={details} /> : <span className="info-tip-copy">{text}</span>}
    </div>,
    document.body,
  ) : null

  return (
    <>
      <Tag
        ref={setTriggerRef}
        className={`info-tip ${below ? 'info-tip-below' : ''} ${className}`}
        tabIndex={0}
        aria-label={tooltipAriaLabel(text, details)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={(event) => {
          if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsFocused(false)
          }
        }}
      >
      {children}
      </Tag>
      {tooltipCard}
    </>
  )
}

type DiagramTooltip = {
  owner: 'sparse' | 'log'
  details: TooltipDetails
  left: number
  top: number
  above: boolean
}

function DiagramTooltipOverlay({ tooltip, owner }: { tooltip: DiagramTooltip | null; owner: DiagramTooltip['owner'] }) {
  if (!tooltip || tooltip.owner !== owner) {
    return null
  }
  const tooltipCard = (
    <div className={`diagram-tooltip ${tooltip.above ? 'is-above' : 'is-below'}`} style={{ left: tooltip.left, top: tooltip.top }} role="tooltip" aria-label={tooltipAriaLabel(undefined, tooltip.details)}>
      <TooltipDetailsView details={tooltip.details} />
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(tooltipCard, document.body) : null
}

function proofRoleDescription(pathNode: boolean, proofNode: boolean, root: boolean, leaf: boolean, active: boolean) {
  if (root) {
    return 'verification target'
  }
  if (proofNode) {
    return 'proof sibling'
  }
  if (pathNode && leaf) {
    return active ? 'selected leaf' : 'selected empty leaf'
  }
  if (pathNode) {
    return 'selected path'
  }
  return 'not in proof'
}

function sparseNodeTooltip(node: SparseNode, pathNode: boolean, proofNode: boolean, depth: number) {
  const root = node.level === depth
  const leaf = node.level === 0
  const badge = root ? 'root branch' : leaf ? (node.active ? 'populated leaf' : 'empty leaf') : 'branch'
  const proofRole = proofRoleDescription(pathNode, proofNode, root, leaf, Boolean(node.active))
  if (node.level === 0 && node.active) {
    return {
      badge,
      digest: node.hash,
      equation: 'SHA-256("smt:leaf|" + path + "|" + key + "|" + value)',
      inputs: `path = ${node.path}\nkey = ${node.key}\nvalue = ${node.value ?? ''}`,
      proofRole,
    }
  }
  if (node.level === 0) {
    return {
      badge,
      digest: node.hash,
      equation: 'SHA-256("smt:empty|leaf")',
      inputs: `path = ${node.path}\nknown empty-leaf constant`,
      proofRole,
    }
  }
  return {
    badge,
    digest: node.hash,
    equation: 'SHA-256("smt:node|" + left + "|" + right)',
    inputs: `left = ${node.left?.hash ?? ''}\nright = ${node.right?.hash ?? ''}`,
    proofRole,
  }
}

function logNodeTooltip(node: LogNode, event: LogEvent | undefined, pathNode: boolean, proofNode: boolean, root: boolean) {
  const leaf = !node.left
  const badge = root ? 'root branch' : leaf ? 'event leaf' : 'branch'
  const proofRole = proofRoleDescription(pathNode, proofNode, root, leaf, Boolean(event))
  if (!node.left && event) {
    return {
      badge,
      digest: node.hash,
      equation: 'SHA-256("log:leaf|" + id + "|" + kind + "|" + actor + "|" + detail + "|" + timestamp)',
      inputs: `id = ${event.id}\nkind = ${event.kind}\nactor = ${event.actor}\ndetail = ${event.detail}\ntimestamp = ${event.timestamp}`,
      proofRole,
    }
  }
  return {
    badge,
    digest: node.hash,
    equation: 'SHA-256("log:node|" + left + "|" + right)',
    inputs: `left = ${node.left?.hash ?? ''}\nright = ${node.right?.hash ?? ''}`,
    proofRole,
  }
}

function logLeafTooltip(event: LogEvent, hash: string, pathNode: boolean, proofNode: boolean) {
  return logNodeTooltip({ start: 0, end: 1, depth: 0, hash }, event, pathNode, proofNode, false)
}

function sparseKeyPath(key: string, depth: number) {
  const hashWord = Number.parseInt(sha256(`smt:path|${key.trim()}`).slice(0, 8), 16)
  const pathIndex = Math.floor(hashWord / 2 ** (32 - depth))
  return pathIndex.toString(2).padStart(depth, '0')
}

function findSparsePathConflict(entries: SparseEntry[], depth: number, entryId: string, key: string) {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    return undefined
  }
  const path = sparseKeyPath(normalizedKey, depth)
  return entries.find((entry) => entry.id !== entryId && entry.enabled && entry.key.trim() && sparseKeyPath(entry.key, depth) === path)
}

function findSparseDepthConflict(entries: SparseEntry[], depth: number) {
  const entriesByPath = new Map<string, SparseEntry>()
  for (const entry of entries) {
    if (!entry.enabled || !entry.key.trim()) {
      continue
    }
    const path = sparseKeyPath(entry.key, depth)
    const existingEntry = entriesByPath.get(path)
    if (existingEntry) {
      return { path, first: existingEntry, second: entry }
    }
    entriesByPath.set(path, entry)
  }
  return undefined
}

function sparseLeafHash(key: string, value: string, depth: number) {
  const normalizedKey = key.trim()
  return sha256(`smt:leaf|${sparseKeyPath(normalizedKey, depth)}|${normalizedKey}|${value}`)
}

function sparseNodeHash(left: string, right: string) {
  return sha256(`smt:node|${left}|${right}`)
}

function buildSparseTree(entries: SparseEntry[], depth: number) {
  const emptyHashes = [sha256('smt:empty|leaf')]
  for (let level = 1; level <= depth; level += 1) {
    emptyHashes.push(sparseNodeHash(emptyHashes[level - 1], emptyHashes[level - 1]))
  }

  const entryByPath = new Map(
    entries
      .filter((entry) => entry.enabled && entry.key.trim() && entry.value.trim())
      .map((entry) => [sparseKeyPath(entry.key, depth), entry]),
  )
  const leaves: SparseNode[] = Array.from({ length: 2 ** depth }, (_, index) => {
    const path = index.toString(2).padStart(depth, '0')
    const entry = entryByPath.get(path)
    return {
      level: 0,
      index,
      hash: entry ? sparseLeafHash(entry.key, entry.value.trim(), depth) : emptyHashes[0],
      path,
      key: entry?.key,
      value: entry?.value.trim(),
      active: Boolean(entry),
    }
  })
  const levels: SparseNode[][] = [leaves]

  for (let level = 1; level <= depth; level += 1) {
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

  return { depth, emptyHashes, leaves, levels, root: levels[depth][0] }
}

function buildSparseProof(tree: ReturnType<typeof buildSparseTree>, key: string) {
  const normalizedKey = key.trim()
  const path = sparseKeyPath(normalizedKey, tree.depth)
  const index = Number.parseInt(path, 2)
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

  return { key: normalizedKey, path, leaf, steps, reconstructedRoot: currentHash, index }
}

function measureSparseProof(proof: ReturnType<typeof buildSparseProof>) {
  const keyBytes = utf8ByteLength(proof.key)
  const valueBytes = proof.leaf.active ? utf8ByteLength(proof.leaf.value ?? '') : 0
  const siblingBytes = proof.steps.length * SHA256_BYTES
  return { keyBytes, valueBytes, inputBytes: keyBytes + valueBytes, siblingBytes, totalBytes: keyBytes + valueBytes + siblingBytes }
}

function logLeafHash(event: LogEvent) {
  return sha256(`log:leaf|${event.id}|${event.kind}|${event.actor}|${event.detail}|${event.timestamp}`)
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

function measureLogProof(event: LogEvent, proof: LogProofStep[]) {
  const inputBytes = [event.id, event.kind, event.actor, event.detail, event.timestamp].reduce((total, value) => total + utf8ByteLength(value), 0)
  const siblingBytes = proof.length * SHA256_BYTES
  return { inputBytes, siblingBytes, totalBytes: inputBytes + siblingBytes }
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
  const [sparseDepth, setSparseDepth] = useState(DEFAULT_SPARSE_DEPTH)
  const [selectedSparseKey, setSelectedSparseKey] = useState('account:alice')
  const [sparseError, setSparseError] = useState('')
  const [diagramTooltip, setDiagramTooltip] = useState<DiagramTooltip | null>(null)
  const [logEvents, setLogEvents] = useState(INITIAL_LOG_EVENTS)
  const [selectedLogIndex, setSelectedLogIndex] = useState(1)
  const [newEventKind, setNewEventKind] = useState(LOG_KIND_OPTIONS[0])
  const [newEventActor, setNewEventActor] = useState('Mina')
  const [newEventDetail, setNewEventDetail] = useState('')

  const sparseTree = useMemo(() => buildSparseTree(sparseEntries, sparseDepth), [sparseEntries, sparseDepth])
  const sparseProof = useMemo(() => buildSparseProof(sparseTree, selectedSparseKey), [sparseTree, selectedSparseKey])
  const activeSparseCount = sparseTree.leaves.filter((leaf) => leaf.active).length
  const occupiedSparseCount = sparseEntries.filter((entry) => entry.enabled && entry.key.trim()).length
  const sparseProofSize = measureSparseProof(sparseProof)

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
  const selectedLogEvent = logEvents[logView.selectedIndex]
  const logProofSize = measureLogProof(selectedLogEvent, logView.proof)

  const updateSparseEntry = (entryIndex: number, field: 'key' | 'value', value: string) => {
    if (field === 'key') {
      const entry = sparseEntries[entryIndex]
      const normalizedKey = value.trim()
      const conflict = findSparsePathConflict(sparseEntries, sparseDepth, entry.id, normalizedKey)
      if (conflict) {
        setSparseError(`Collision at ${sparseDepth} bits / path ${sparseKeyPath(normalizedKey, sparseDepth)}: "${normalizedKey}" and "${conflict.key}" share this path.`)
        return
      }
      setSparseError('')
      setSelectedSparseKey(normalizedKey)
    } else {
      setSparseError('')
    }
    const nextValue = field === 'key' ? value.trim() : value
    setSparseEntries((entries) =>
      entries.map((entry, index) => {
        if (index !== entryIndex) {
          return entry
        }
        return { ...entry, [field]: nextValue }
      }),
    )
  }

  const updateSparseDepth = (value: string) => {
    const nextDepth = Number(value)
    const conflict = findSparseDepthConflict(sparseEntries, nextDepth)
    if (conflict) {
      setSparseError(`Collision at ${nextDepth} bits: "${conflict.first.key}" and "${conflict.second.key}" both map to ${conflict.path}.`)
      return
    }
    setSparseDepth(nextDepth)
    setSparseError('')
  }

  const addSparseEntry = () => {
    if (occupiedSparseCount >= 2 ** sparseDepth) {
      setSparseError(`All ${2 ** sparseDepth} paths are occupied at ${sparseDepth} bits.`)
      return
    }
    let nextId = Math.max(...sparseEntries.map((entry) => Number(entry.id.replace('state_', '')) || 0), 0) + 1
    let nextKey = `state:${String(nextId).padStart(3, '0')}`
    let attempts = 0
    while (findSparsePathConflict(sparseEntries, sparseDepth, '', nextKey) && attempts < 1000) {
      nextId += 1
      nextKey = `state:${String(nextId).padStart(3, '0')}`
      attempts += 1
    }
    if (attempts >= 1000) {
      setSparseError(`Could not find an unused path at ${sparseDepth} bits.`)
      return
    }
    setSparseError('')
    setSparseEntries((entries) => [...entries, { id: `state_${String(nextId).padStart(3, '0')}`, key: nextKey, value: '24', enabled: true }])
    setSelectedSparseKey(nextKey)
  }

  const removeSparseEntry = (entryIndex: number) => {
    setSparseEntries((entries) => entries.filter((_, index) => index !== entryIndex))
    setSparseError('')
  }

  const resetDemo = () => {
    setSparseEntries(INITIAL_SPARSE_ENTRIES)
    setSparseDepth(DEFAULT_SPARSE_DEPTH)
    setSelectedSparseKey('account:alice')
    setSparseError('')
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

  const sparseSvgWidth = Math.max(800, sparseTree.leaves.length * 80)
  const sparseSvgHeight = 40 + (sparseTree.depth + 1) * 70
  const sparseNodeX = (level: number, index: number) => (index + 0.5) * (sparseSvgWidth / 2 ** (sparseTree.depth - level))
  const sparseNodeY = (level: number) => 30 + (sparseTree.depth - level) * 70
  const selectedSparseIndex = sparseProof.index
  const isSparsePathNode = (level: number, index: number) => index === (selectedSparseIndex >> level)
  const isSparseProofNode = (level: number, index: number) => level < sparseTree.depth && index === ((selectedSparseIndex >> level) ^ 1)

  const showDiagramTooltip = (event: MouseEvent<SVGGElement> | FocusEvent<SVGGElement>, details: TooltipDetails, owner: DiagramTooltip['owner']) => {
    const frame = event.currentTarget.closest<HTMLElement>('.tree-frame')
    if (!frame) {
      return
    }
    const targetRect = event.currentTarget.getBoundingClientRect()
    const tooltipWidth = Math.min(350, window.innerWidth - 24)
    const targetCenter = targetRect.left + targetRect.width / 2
    const minLeft = 12
    const maxLeft = window.innerWidth - tooltipWidth - 12
    const left = Math.max(minLeft, Math.min(maxLeft, targetCenter - tooltipWidth / 2))
    const above = targetRect.top > 180
    const top = above ? targetRect.top - 10 : targetRect.bottom + 10
    setDiagramTooltip({ owner, details, left, top, above })
  }
  const hideDiagramTooltip = () => setDiagramTooltip(null)

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
          <InfoTip text="Every digest is 32 raw bytes. The .. marker only abbreviates hashes in the interface." below>
            <span className="hash-label">SHA-256 / .. display only</span>
          </InfoTip>
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
            <div className="section-tag">hashed path / {sparseDepth}-bit demo</div>
          </div>

          <div className="sparse-layout">
            <aside className="control-rail" aria-label="Sparse state controls">
              <div className="rail-title-row">
                <div>
                  <span className="mini-label">State map</span>
                  <strong>{activeSparseCount} / {2 ** sparseDepth} demo slots populated</strong>
                </div>
                <span className="rail-accent">editable</span>
              </div>
              <label className="depth-control">
                <span>Path bits</span>
                <select aria-label="Sparse path bits" value={sparseDepth} onChange={(event) => updateSparseDepth(event.target.value)}>
                  {Array.from({ length: MAX_SPARSE_DEPTH - MIN_SPARSE_DEPTH + 1 }, (_, index) => MIN_SPARSE_DEPTH + index).map((depth) => (
                    <option key={depth} value={depth}>{depth} bits / {2 ** depth} leaves</option>
                  ))}
                </select>
              </label>
              <div className="state-list">
                {sparseEntries.map((entry, index) => (
                  <div className={`state-row ${entry.key === selectedSparseKey ? 'is-selected' : ''}`} key={entry.id}>
                    <button
                      className="state-select"
                      type="button"
                      aria-label={`Inspect state ${entry.key || 'unassigned'}`}
                      onClick={() => setSelectedSparseKey(entry.key || '')}
                    >
                      <span className="state-dot" />
                    </button>
                    <div className="state-fields">
                      <label>
                        <span>key</span>
                        <input
                          value={entry.key}
                          placeholder="account id"
                          aria-label="State key"
                          onChange={(event) => updateSparseEntry(index, 'key', event.target.value)}
                          onFocus={() => setSelectedSparseKey(entry.key)}
                        />
                      </label>
                      <label>
                        <span>value</span>
                        <input
                          value={entry.value}
                          aria-label="State value"
                          onChange={(event) => updateSparseEntry(index, 'value', event.target.value)}
                          onFocus={() => setSelectedSparseKey(entry.key || '')}
                        />
                      </label>
                    </div>
                    <InfoTip text="Include this state in the tree." className="switch-tip">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          aria-label={`Include state ${entry.key || 'unassigned'}`}
                          onChange={(event) => {
                            if (event.target.checked) {
                              const conflict = findSparsePathConflict(sparseEntries, sparseDepth, entry.id, entry.key)
                              if (conflict) {
                                setSparseError(`Collision at ${sparseDepth} bits / path ${sparseKeyPath(entry.key, sparseDepth)}: "${entry.key}" and "${conflict.key}" share this path.`)
                                return
                              }
                            }
                            setSparseError('')
                            setSparseEntries((entries) => entries.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))
                            setSelectedSparseKey(entry.key || '')
                          }}
                        />
                        <span />
                      </label>
                    </InfoTip>
                    <button className="remove-button" type="button" aria-label={`Remove state ${entry.key || 'unassigned'}`} onClick={() => removeSparseEntry(index)}>
                      x
                    </button>
                  </div>
                ))}
              </div>
              <button className="add-button" type="button" onClick={addSparseEntry} disabled={sparseEntries.length >= 8 || occupiedSparseCount >= 2 ** sparseDepth}>
                <span>+</span> Add state
              </button>
              {sparseError && <div className="rail-error" role="alert"><span>!</span><p>{sparseError}</p></div>}
              <div className="rail-note">
                <span className="note-mark">i</span>
                <p>Empty leaves resolve to a known default hash. This {sparseDepth}-bit teaching tree has {2 ** sparseDepth} possible paths.</p>
              </div>
            </aside>

            <div className="visual-stage">
              <div className="stage-header">
                <div>
                  <span className="mini-label">Current root commitment</span>
                  <InfoTip details={sparseNodeTooltip(sparseTree.root, true, false, sparseTree.depth)} below className="hash-tip">
                    <strong className="root-hash">{shortHash(sparseTree.root.hash)}</strong>
                  </InfoTip>
                </div>
                <div className="verification-state"><span /> path selected: {sparseProof.path}</div>
              </div>
              <div className="diagram-legend" aria-label="Sparse tree diagram legend">
                <InfoTip text="Selected path: the nodes used to reconstruct the requested proof." below><span><i className="legend-swatch legend-path" /> selected path</span></InfoTip>
                <InfoTip text="Proof sibling: a digest supplied to the verifier." below><span><i className="legend-swatch legend-proof" /> proof sibling</span></InfoTip>
                <InfoTip text="Leaf digest: computed from the derived path, logical key, and raw value." below><span><i className="legend-swatch legend-leaf" /> leaf digest</span></InfoTip>
                <InfoTip text="Branch digest: computed from two child digests." below><span><i className="legend-swatch legend-digest" /> branch digest</span></InfoTip>
                <InfoTip text="Root commitment: the digest compared with the verifier's result." below><span><i className="legend-swatch legend-root" /> root</span></InfoTip>
              </div>
              <div className="tree-frame" onScroll={hideDiagramTooltip}>
                <svg className="tree-svg sparse-svg" width={sparseSvgWidth} height={sparseSvgHeight} viewBox={`0 0 ${sparseSvgWidth} ${sparseSvgHeight}`} role="img" aria-label={`${sparseDepth}-bit sparse Merkle tree visualization`}>
                  {sparseTree.levels.slice(1).flatMap((levelNodes) => levelNodes.map((node) => (
                    <g key={`edge-${node.level}-${node.index}`}>
                      <line
                        className={`tree-edge ${isSparsePathNode(node.level - 1, node.index * 2) ? 'is-path' : ''}`}
                        x1={sparseNodeX(node.level, node.index)}
                        y1={sparseNodeY(node.level)}
                        x2={sparseNodeX(node.level - 1, node.index * 2)}
                        y2={sparseNodeY(node.level - 1)}
                      />
                      <line
                        className={`tree-edge ${isSparsePathNode(node.level - 1, node.index * 2 + 1) ? 'is-path' : ''}`}
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
                    const nodeTooltip = sparseNodeTooltip(node, pathNode, proofNode, sparseTree.depth)
                    return (
                      <g
                        key={`node-${node.level}-${node.index}`}
                        className={`sparse-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${leaf ? 'is-leaf' : ''} ${node.level === sparseTree.depth ? 'is-root' : ''} ${leaf && node.active ? 'is-active' : ''}`}
                        aria-label={tooltipAriaLabel(undefined, nodeTooltip)}
                        tabIndex={leaf || node.level === sparseTree.depth ? 0 : -1}
                        onMouseEnter={(event) => showDiagramTooltip(event, nodeTooltip, 'sparse')}
                        onMouseLeave={hideDiagramTooltip}
                        onFocus={(event) => showDiagramTooltip(event, nodeTooltip, 'sparse')}
                        onBlur={hideDiagramTooltip}
                        onClick={() => leaf && node.key && setSelectedSparseKey(node.key)}
                      >
                        <rect x={sparseNodeX(node.level, node.index) - (leaf ? 38 : 36)} y={sparseNodeY(node.level) - 17} width={leaf ? 76 : 72} height="34" rx="5" />
                        <text className="node-hash" x={sparseNodeX(node.level, node.index)} y={sparseNodeY(node.level)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
                        {leaf && <text className="node-key" x={sparseNodeX(node.level, node.index)} y={sparseNodeY(node.level) + 29} textAnchor="middle">{node.active ? shortKey(node.key ?? '') : node.path}</text>}
                      </g>
                    )
                  }))}
                  {sparseTree.levels.map((_, level) => (
                    <text className="tree-level-label" key={`label-${level}`} x="10" y={sparseNodeY(level) + 3}>{level === sparseTree.depth ? 'root' : level === 0 ? 'leaves' : 'branch'}</text>
                  ))}
                </svg>
                <DiagramTooltipOverlay tooltip={diagramTooltip} owner="sparse" />
              </div>

              <div className="recipe-strip">
                <div className="recipe-heading"><span className="mini-label">How a state becomes a digest</span><InfoTip text="The hash function receives the literal, domain-separated inputs shown here." below><span>domain-separated SHA-256</span></InfoTip></div>
                <div className="recipe-grid">
                  <InfoTip as="div" className="recipe-step" text="The key is hashed first; the selected number of leading bits chooses one sparse leaf. The path is derived, not the logical key."><b>1</b><span>path</span><code>prefix {sparseDepth} bits of H("smt:path|" + key)</code></InfoTip>
                  <InfoTip as="div" className="recipe-step" text="The leaf commits to the derived path, the original logical key, and the raw value. The visible box shows only the resulting digest."><b>2</b><span>leaf</span><code>H("smt:leaf|" + path + "|" + key + "|" + value)</code></InfoTip>
                  <InfoTip as="div" className="recipe-step" text="Every branch commits to the digest of its left and right children, not to raw application data."><b>3</b><span>branch</span><code>H("smt:node|" + left + "|" + right)</code></InfoTip>
                </div>
                <p className="recipe-note">Raw keys and values remain in the state map. The tree boxes show 32-byte digests; a large value changes the proof input size, not the node dimensions.</p>
              </div>

              <div className="proof-card">
                <div className="proof-card-header">
                  <div>
                    <span className="mini-label">Proof required</span>
                    <InfoTip as="strong" text={sparseProof.leaf.active ? `Raw value: ${sparseProof.leaf.value}` : 'No raw value is sent for an absence proof.'}>{sparseProof.leaf.active ? `key ${sparseProof.key} = ${valueSummary(sparseProof.leaf.value ?? '')}` : `key ${sparseProof.key} is empty`}</InfoTip>
                  </div>
                  <span className="verified-badge"><span /> root matches</span>
                </div>
                <div className="proof-chain">
                  <InfoTip as="div" className="proof-chip primary" details={sparseNodeTooltip(sparseProof.leaf, true, false, sparseTree.depth)}><span>computed leaf</span><b>{shortHash(sparseProof.leaf.hash)}</b></InfoTip>
                  {sparseProof.steps.map((step) => (
                    <div className="proof-chain-step" key={step.level}>
                      <span className="chain-arrow">-&gt;</span>
                      <InfoTip as="div" className="proof-chip" details={sparseNodeTooltip(sparseTree.levels[step.level - 1][step.siblingIndex], false, true, sparseTree.depth)}><span>+ {step.currentIsLeft ? 'right' : 'left'} sibling</span><b>{shortHash(step.siblingHash)}</b></InfoTip>
                    </div>
                  ))}
                  <div className="proof-chain-step">
                    <span className="chain-arrow">-&gt;</span>
                    <InfoTip as="div" className="proof-chip result" details={sparseNodeTooltip(sparseTree.root, true, false, sparseTree.depth)}><span>reconstructed root</span><b>{shortHash(sparseProof.reconstructedRoot)}</b></InfoTip>
                  </div>
                </div>
                <p className="proof-explanation">A verifier hashes the arbitrary key into the {sparseProof.path} path, then recomputes the leaf from the raw value (or the known empty default) and climbs through {sparseProof.steps.length} sibling hashes. The leaf and root boxes are computed results, not wire payloads.</p>
                <InfoTip as="div" className="proof-size" text="Raw content-byte count for this demo proof. UTF-8 key/value bytes are followed by 32-byte SHA-256 sibling digests; serialization framing is not included.">
                  <div className="proof-size-heading"><span className="mini-label">Raw proof bytes</span><strong>{formatByteCount(sparseProofSize.totalBytes)}</strong></div>
                  <div className="proof-size-breakdown"><span>{formatByteCount(sparseProofSize.inputBytes)} key/value input</span><span>+</span><span>{formatByteCount(sparseProofSize.siblingBytes)} siblings</span></div>
                  <p>{sparseProof.leaf.active ? 'Large values increase the key/value portion.' : 'Absence proofs send the key; the empty leaf convention is known to the verifier.'} Each sibling is {SHA256_BYTES} bytes.</p>
                </InfoTip>
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
                  <InfoTip details={logView.tree ? logNodeTooltip(logView.tree, undefined, true, false, true) : undefined} text={logView.tree ? undefined : 'No root exists until the first event is appended.'} below className="hash-tip">
                    <strong className="root-hash coral-root">{logView.tree ? shortHash(logView.tree.hash) : 'empty'}</strong>
                  </InfoTip>
                </div>
                <div className="verification-state coral-state"><span /> event selected: #{logView.selectedIndex + 1}</div>
              </div>
              <div className="diagram-legend coral-legend" aria-label="Merkle log diagram legend">
                <InfoTip text="Selected path: the nodes used to reconstruct the requested event proof." below><span><i className="legend-swatch legend-path" /> selected path</span></InfoTip>
                <InfoTip text="Proof sibling: a digest supplied to the verifier." below><span><i className="legend-swatch legend-proof" /> proof sibling</span></InfoTip>
                <InfoTip text="Leaf digest: computed from the complete raw event." below><span><i className="legend-swatch legend-leaf" /> leaf digest</span></InfoTip>
                <InfoTip text="Branch digest: computed from two child digests." below><span><i className="legend-swatch legend-digest" /> branch digest</span></InfoTip>
                <InfoTip text="Root commitment: the digest compared with the verifier's result." below><span><i className="legend-swatch legend-root" /> root</span></InfoTip>
              </div>
              <div className="tree-frame log-tree-frame" onScroll={hideDiagramTooltip}>
                {logView.tree ? (
                  <svg className="tree-svg log-svg" viewBox={`0 0 760 ${logHeight}`} role="img" aria-label="Append-only Merkle log tree visualization">
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
                        const nodeTooltip = logNodeTooltip(node, leaf ? logEvents[node.start] : undefined, pathNode, proofNode, node === logView.tree)
                        return (
                          <g className={`log-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${leaf ? 'is-leaf' : ''} ${node === logView.tree ? 'is-root' : ''}`} key={`${node.start}-${node.end}`}
                            aria-label={tooltipAriaLabel(undefined, nodeTooltip)}
                            tabIndex={leaf || proofNode || node === logView.tree ? 0 : -1}
                            onMouseEnter={(event) => showDiagramTooltip(event, nodeTooltip, 'log')}
                            onMouseLeave={hideDiagramTooltip}
                            onFocus={(event) => showDiagramTooltip(event, nodeTooltip, 'log')}
                            onBlur={hideDiagramTooltip}
                          >
                            <rect x={logNodeX(node) - (leaf ? 38 : 36)} y={logNodeY(node) - 18} width={leaf ? 76 : 72} height="36" rx="5" />
                            <text className="node-hash" x={logNodeX(node)} y={logNodeY(node)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
                            {leaf && <text className="node-key" x={logNodeX(node)} y={logNodeY(node) + 29} textAnchor="middle">{logEvents[node.start].id}</text>}
                          </g>
                        )
                      })
                    })()}
                    <text className="tree-level-label" x="10" y="42">root</text>
                    <text className="tree-level-label" x="10" y={logHeight - 8}>events</text>
                  </svg>
                ) : <div className="empty-log">Append an event to grow the log.</div>}
                <DiagramTooltipOverlay tooltip={diagramTooltip} owner="log" />
              </div>

              <div className="recipe-strip coral-recipe">
                <div className="recipe-heading"><span className="mini-label">How an event becomes a digest</span><InfoTip text="The hash function receives the literal, domain-separated inputs shown here." below><span>domain-separated SHA-256</span></InfoTip></div>
                <div className="recipe-grid">
                  <InfoTip as="div" className="recipe-step" text="The complete event fields, including its timestamp, form the leaf input. The visible event leaf box shows only the resulting digest."><b>1</b><span>leaf</span><code>H("log:leaf|" + id + "|" + kind + "|" + actor + "|" + detail + "|" + timestamp)</code></InfoTip>
                  <InfoTip as="div" className="recipe-step" text="Every branch commits to the digest of its left and right children, preserving the event order encoded by the tree shape."><b>2</b><span>branch</span><code>H("log:node|" + left + "|" + right)</code></InfoTip>
                </div>
                <p className="recipe-note">Raw event fields remain in the event stream. Leaf boxes show 32-byte digests; the event ID underneath is an orientation label, not the leaf content.</p>
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
                  <div className="proof-table-row first-row"><span>leaf</span><span>{logEvents[logView.selectedIndex].id}</span><InfoTip as="b" details={logLeafTooltip(logEvents[logView.selectedIndex], logView.leafHashes[logView.selectedIndex], true, false)}>{shortHash(logView.leafHashes[logView.selectedIndex])}</InfoTip><span>start</span></div>
                  {logView.proof.map((step, index) => (
                    <div className="proof-table-row" key={`${step.sibling.start}-${step.sibling.end}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <span>{step.sibling.start + 1}-{step.sibling.end} {step.currentIsLeft ? 'right' : 'left'} subtree</span>
                      <InfoTip as="b" details={logNodeTooltip(step.sibling, step.sibling.left ? undefined : logEvents[step.sibling.start], false, true, false)}>{shortHash(step.sibling.hash)}</InfoTip>
                      <span>left + right</span>
                    </div>
                  ))}
                </div>
                <div className="proof-result-line"><span>reconstructed root</span><InfoTip as="b" details={logView.tree ? logNodeTooltip(logView.tree, undefined, true, false, true) : undefined} text={logView.tree ? undefined : 'No root exists until the first event is appended.'}>{shortHash(logView.reconstructedRoot)}</InfoTip><span className="match-label">matches snapshot</span></div>
                <p className="proof-explanation">The verifier recomputes the selected event leaf from its raw fields, then climbs through sibling digests. The leaf and reconstructed root are local calculations; the event fields and sibling hashes are the proof payload.</p>
                <InfoTip as="div" className="proof-size" text="Raw content-byte count for this demo proof. UTF-8 event fields are followed by 32-byte SHA-256 sibling digests; serialization framing is not included.">
                  <div className="proof-size-heading"><span className="mini-label">Raw proof bytes</span><strong>{formatByteCount(logProofSize.totalBytes)}</strong></div>
                  <div className="proof-size-breakdown"><span>{formatByteCount(logProofSize.inputBytes)} event input</span><span>+</span><span>{formatByteCount(logProofSize.siblingBytes)} siblings</span></div>
                  <p>Timestamp is part of the committed event input. Each sibling is {SHA256_BYTES} bytes.</p>
                </InfoTip>
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
