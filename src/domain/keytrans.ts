import { hashFields, SHA256_BYTES } from './hash'
import type {
  KeyTransLogNode,
  KeyTransLogProofStep,
  KeyTransLogTree,
  KeyTransPrefixBranch,
  KeyTransPrefixNode,
  KeyTransPrefixProofView,
  KeyTransPrefixProofStep,
  KeyTransPrefixTree,
  KeyTransPublication,
  KeyTransRecord,
  KeyTransSnapshot,
  KeyTransUpdate,
  KeyTransView,
} from './types'

export const KEYTRANS_SEARCH_KEY_BITS = SHA256_BYTES * 8
export const KEYTRANS_ZERO_CHILD = '0'.repeat(SHA256_BYTES * 2)

function hashToBits(hash: string, length = KEYTRANS_SEARCH_KEY_BITS) {
  return Array.from(hash.slice(0, Math.ceil(length / 4)))
    .flatMap((character) => Number.parseInt(character, 16).toString(2).padStart(4, '0').split(''))
    .slice(0, length)
    .join('')
}

export function keyTransAddress(label: string, version: number) {
  return hashFields('kt:demo:vrf-output', label, String(version))
}

export function keyTransSearchKey(label: string, version: number) {
  return hashToBits(keyTransAddress(label, version), KEYTRANS_SEARCH_KEY_BITS)
}

export function keyTransCommitment(update: Pick<KeyTransUpdate, 'opening' | 'label' | 'version' | 'value'>) {
  return hashFields('kt:demo:commitment', update.opening, update.label, String(update.version), update.value)
}

export function keyTransPrefixLeafHash(searchKey: string, commitment: string) {
  return hashFields('kt:prefix:leaf', searchKey, commitment)
}

export function keyTransPrefixNodeHash(left: string, right: string) {
  return hashFields('kt:prefix:node', left, right)
}

export function keyTransLogLeafHash(timestamp: string, prefixRoot: string) {
  return hashFields('kt:log:leaf', timestamp, prefixRoot)
}

export function keyTransLogNodeHash(left: string, right: string) {
  return hashFields('kt:log:node', left, right)
}

function toRecord(update: KeyTransUpdate): KeyTransRecord {
  return {
    ...update,
    address: keyTransAddress(update.label, update.version),
    searchKey: keyTransSearchKey(update.label, update.version),
    commitment: keyTransCommitment(update),
  }
}

function buildPrefixNode(records: KeyTransRecord[], depth: number, forceBranch: boolean): KeyTransPrefixNode {
  if (records.length === 1 && !forceBranch) {
    const record = records[0]
    return {
      type: 'leaf',
      hash: keyTransPrefixLeafHash(record.searchKey, record.commitment),
      depth,
      address: record.address,
      searchKey: record.searchKey,
      commitment: record.commitment,
      record,
    }
  }

  if (depth >= KEYTRANS_SEARCH_KEY_BITS && records.length > 1) {
    throw new Error('Key Transparency demo search-key collision')
  }

  const leftRecords = records.filter((record) => record.searchKey[depth] === '0')
  const rightRecords = records.filter((record) => record.searchKey[depth] === '1')
  const left = leftRecords.length > 0 ? buildPrefixNode(leftRecords, depth + 1, leftRecords.length > 1) : undefined
  const right = rightRecords.length > 0 ? buildPrefixNode(rightRecords, depth + 1, rightRecords.length > 1) : undefined

  return {
    type: 'branch',
    hash: keyTransPrefixNodeHash(left?.hash ?? KEYTRANS_ZERO_CHILD, right?.hash ?? KEYTRANS_ZERO_CHILD),
    depth,
    left,
    right,
  }
}

export function buildKeyTransPrefixTree(records: KeyTransRecord[]): KeyTransPrefixTree {
  const uniqueSearchKeys = new Set(records.map((record) => record.searchKey))
  if (uniqueSearchKeys.size !== records.length) {
    throw new Error('Key Transparency demo search-key collision')
  }

  return {
    root: buildPrefixNode(records, 0, true) as KeyTransPrefixBranch,
    records,
  }
}

export function buildKeyTransPrefixProof(tree: KeyTransPrefixTree, label: string, version: number): KeyTransPrefixProofView {
  const searchKey = keyTransSearchKey(label, version)
  const steps: KeyTransPrefixProofStep[] = []
  let node: KeyTransPrefixNode = tree.root

  while (node.type === 'branch') {
    const branch: KeyTransPrefixBranch = node
    const currentIsLeft: boolean = searchKey[branch.depth] === '0'
    const sibling: KeyTransPrefixNode | undefined = currentIsLeft ? branch.right : branch.left
    const child: KeyTransPrefixNode | undefined = currentIsLeft ? branch.left : branch.right
    steps.push({
      depth: branch.depth,
      siblingHash: sibling?.hash ?? KEYTRANS_ZERO_CHILD,
      currentIsLeft,
      combinedHash: branch.hash,
    })

    if (!child) {
      let reconstructedRoot = KEYTRANS_ZERO_CHILD
      for (const step of [...steps].reverse()) {
        reconstructedRoot = step.currentIsLeft
          ? keyTransPrefixNodeHash(reconstructedRoot, step.siblingHash)
          : keyTransPrefixNodeHash(step.siblingHash, reconstructedRoot)
      }
      return {
        searchKey,
        result: 'nonInclusionParent',
        terminal: null,
        steps,
        reconstructedRoot,
      }
    }

    node = child
  }

  let reconstructedRoot = node.hash
  for (const step of [...steps].reverse()) {
    reconstructedRoot = step.currentIsLeft
      ? keyTransPrefixNodeHash(reconstructedRoot, step.siblingHash)
      : keyTransPrefixNodeHash(step.siblingHash, reconstructedRoot)
  }

  return {
    searchKey,
    result: node.searchKey === searchKey ? 'inclusion' : 'nonInclusionLeaf',
    terminal: node,
    steps,
    reconstructedRoot,
  }
}

function largestPowerOfTwoLessThan(value: number) {
  let power = 1
  while (power * 2 < value) {
    power *= 2
  }
  return power
}

function isBalancedLogNode(node: KeyTransLogNode) {
  const size = node.end - node.start
  return (size & (size - 1)) === 0
}

function balancedLogSubtreeHeads(node: KeyTransLogNode): KeyTransLogNode[] {
  if (isBalancedLogNode(node)) {
    return [node]
  }
  if (!node.left || !node.right) {
    throw new Error('Cannot decompose a log node without two children')
  }
  return [...balancedLogSubtreeHeads(node.left), ...balancedLogSubtreeHeads(node.right)]
}

function combineBalancedLogHeads(heads: KeyTransLogNode[]): string {
  if (heads.length === 0) {
    throw new Error('Cannot reconstruct a log subtree without balanced heads')
  }
  if (heads.length === 1) {
    return heads[0].hash
  }
  return keyTransLogNodeHash(heads[0].hash, combineBalancedLogHeads(heads.slice(1)))
}

function buildKeyTransLogNode(snapshots: KeyTransSnapshot[], leafHashes: string[], start = 0, end = snapshots.length, depth = 0): KeyTransLogNode {
  if (end - start === 1) {
    return {
      start,
      end,
      depth,
      hash: leafHashes[start],
      timestamp: snapshots[start].publication.timestamp,
      prefixRoot: snapshots[start].prefixTree.root.hash,
    }
  }
  const split = start + largestPowerOfTwoLessThan(end - start)
  const left = buildKeyTransLogNode(snapshots, leafHashes, start, split, depth + 1)
  const right = buildKeyTransLogNode(snapshots, leafHashes, split, end, depth + 1)
  return {
    start,
    end,
    depth,
    hash: keyTransLogNodeHash(left.hash, right.hash),
    left,
    right,
  }
}

function buildKeyTransLogRoots(leafHashes: string[]) {
  const roots: string[] = []
  for (let end = 1; end <= leafHashes.length; end += 1) {
    roots.push(buildKeyTransLogNode(
      Array.from({ length: end }, (_, index) => ({
        publication: { id: String(index), timestamp: '', updates: [] },
        records: [],
        prefixTree: { root: { type: 'branch', hash: '', depth: 0 }, records: [] },
      })),
      leafHashes.slice(0, end),
    ).hash)
  }
  return roots
}

export function buildKeyTransLogTree(snapshots: KeyTransSnapshot[]): KeyTransLogTree {
  const leafHashes = snapshots.map((snapshot) => keyTransLogLeafHash(snapshot.publication.timestamp, snapshot.prefixTree.root.hash))
  return {
    leafHashes,
    roots: buildKeyTransLogRoots(leafHashes),
    root: snapshots.length > 0 ? buildKeyTransLogNode(snapshots, leafHashes) : null,
  }
}

export function buildKeyTransLogProof(node: KeyTransLogNode, index: number): KeyTransLogProofStep[] {
  if (!node.left || !node.right) {
    return []
  }
  if (index < node.left.end) {
    return [
      ...buildKeyTransLogProof(node.left, index),
      { balancedHeads: balancedLogSubtreeHeads(node.right), currentIsLeft: true, combinedHash: node.hash },
    ]
  }
  return [
    ...buildKeyTransLogProof(node.right, index),
    { balancedHeads: balancedLogSubtreeHeads(node.left), currentIsLeft: false, combinedHash: node.hash },
  ]
}

export function buildKeyTransSnapshots(publications: KeyTransPublication[]): KeyTransSnapshot[] {
  const recordsByLabelVersion = new Map<string, KeyTransRecord>()
  return publications.map((publication) => {
    for (const update of publication.updates) {
      const key = `${update.label}:${update.version}`
      if (recordsByLabelVersion.has(key)) {
        throw new Error(`Duplicate Key Transparency label-version: ${key}`)
      }
      recordsByLabelVersion.set(key, toRecord(update))
    }
    const records = Array.from(recordsByLabelVersion.values())
    return {
      publication,
      records,
      prefixTree: buildKeyTransPrefixTree(records),
    }
  })
}

export function buildKeyTransView(publications: KeyTransPublication[], label: string, version: number, selectedSnapshotIndex: number): KeyTransView {
  const snapshots = buildKeyTransSnapshots(publications)
  if (snapshots.length === 0) {
    throw new Error('Key Transparency demo requires at least one publication')
  }
  const snapshotIndex = Math.min(Math.max(selectedSnapshotIndex, 0), snapshots.length - 1)
  const snapshot = snapshots[snapshotIndex]
  const prefixProof = buildKeyTransPrefixProof(snapshot.prefixTree, label, version)
  const logTree = buildKeyTransLogTree(snapshots)
  const logProof = logTree.root ? buildKeyTransLogProof(logTree.root, snapshotIndex) : []
  const logProofElements = logProof
    .flatMap((step) => step.balancedHeads)
    .sort((left, right) => left.start - right.start)
  let reconstructedLogRoot = logTree.leafHashes[snapshotIndex]
  for (const step of logProof) {
    const siblingHash = combineBalancedLogHeads(step.balancedHeads)
    reconstructedLogRoot = step.currentIsLeft
      ? keyTransLogNodeHash(reconstructedLogRoot, siblingHash)
      : keyTransLogNodeHash(siblingHash, reconstructedLogRoot)
  }

  return {
    snapshots,
    snapshotIndex,
    snapshot,
    prefixProof,
    logTree,
    logProof,
    logProofElements,
    reconstructedLogRoot,
    treeHead: {
      treeSize: snapshots.length,
      root: logTree.root?.hash ?? '',
      timestamp: snapshots.at(-1)?.publication.timestamp ?? '',
    },
  }
}

export function collectKeyTransPrefixNodes(node: KeyTransPrefixNode): KeyTransPrefixNode[] {
  if (node.type === 'leaf') {
    return [node]
  }
  return [node, ...(node.left ? collectKeyTransPrefixNodes(node.left) : []), ...(node.right ? collectKeyTransPrefixNodes(node.right) : [])]
}

export function collectKeyTransPrefixEdges(node: KeyTransPrefixNode): Array<{ parent: KeyTransPrefixBranch; child: KeyTransPrefixNode }> {
  if (node.type === 'leaf') {
    return []
  }
  return [
    ...(node.left ? [{ parent: node, child: node.left }, ...collectKeyTransPrefixEdges(node.left)] : []),
    ...(node.right ? [{ parent: node, child: node.right }, ...collectKeyTransPrefixEdges(node.right)] : []),
  ]
}

export function keyTransPrefixTreeHeight(node: KeyTransPrefixNode): number {
  if (node.type === 'leaf') {
    return node.depth
  }
  return Math.max(node.depth, node.left ? keyTransPrefixTreeHeight(node.left) : node.depth, node.right ? keyTransPrefixTreeHeight(node.right) : node.depth)
}

export function collectKeyTransLogNodes(node: KeyTransLogNode): KeyTransLogNode[] {
  return [node, ...(node.left ? collectKeyTransLogNodes(node.left) : []), ...(node.right ? collectKeyTransLogNodes(node.right) : [])]
}

export function collectKeyTransLogEdges(node: KeyTransLogNode): Array<{ parent: KeyTransLogNode; child: KeyTransLogNode }> {
  if (!node.left || !node.right) {
    return []
  }
  return [
    { parent: node, child: node.left },
    { parent: node, child: node.right },
    ...collectKeyTransLogEdges(node.left),
    ...collectKeyTransLogEdges(node.right),
  ]
}