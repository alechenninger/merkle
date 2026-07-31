import { hashFields, SHA256_BYTES, utf8ByteLength } from './hash'
import type { LogEvent, LogNode, LogProofStep, LogView } from './types'

export function logLeafHash(event: LogEvent) {
  return hashFields('log:leaf', event.id, event.kind, event.actor, event.detail, event.timestamp)
}

export function logNodeHash(left: string, right: string) {
  return hashFields('log:node', left, right)
}

function largestPowerOfTwoLessThan(value: number) {
  let power = 1
  while (power * 2 < value) {
    power *= 2
  }
  return power
}

export function buildLogTree(leafHashes: string[], start = 0, end = leafHashes.length, depth = 0): LogNode {
  if (end <= start) {
    throw new Error('Cannot build a Merkle tree without leaves')
  }
  if (end - start === 1) {
    return { start, end, depth, hash: leafHashes[start] }
  }
  const split = start + largestPowerOfTwoLessThan(end - start)
  const left = buildLogTree(leafHashes, start, split, depth + 1)
  const right = buildLogTree(leafHashes, split, end, depth + 1)
  return { start, end, depth, hash: logNodeHash(left.hash, right.hash), left, right }
}

export function buildLogProof(node: LogNode, index: number): LogProofStep[] {
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

function buildLogRootSnapshots(leafHashes: string[]) {
  const frontier: Array<{ size: number; hash: string }> = []
  const roots: string[] = []

  for (const leafHash of leafHashes) {
    let current = { size: 1, hash: leafHash }
    while (frontier.at(-1)?.size === current.size) {
      const left = frontier.pop()!
      current = { size: current.size * 2, hash: logNodeHash(left.hash, current.hash) }
    }
    frontier.push(current)

    let root = frontier[frontier.length - 1].hash
    for (let index = frontier.length - 2; index >= 0; index -= 1) {
      root = logNodeHash(frontier[index].hash, root)
    }
    roots.push(root)
  }

  return roots
}

export function buildLogView(events: LogEvent[], selectedLogIndex: number): LogView {
  const leafHashes = events.map(logLeafHash)
  const tree = leafHashes.length > 0 ? buildLogTree(leafHashes) : null
  const selectedIndex = Math.min(selectedLogIndex, Math.max(events.length - 1, 0))
  const proof = tree ? buildLogProof(tree, selectedIndex).reverse() : []
  const roots = buildLogRootSnapshots(leafHashes)
  let reconstructedRoot = hashFields('log:empty')

  if (tree) {
    reconstructedRoot = leafHashes[selectedIndex]
    for (const step of proof) {
      reconstructedRoot = step.currentIsLeft
        ? logNodeHash(reconstructedRoot, step.sibling.hash)
        : logNodeHash(step.sibling.hash, reconstructedRoot)
    }
  }

  return { leafHashes, tree, proof, roots, selectedIndex, reconstructedRoot }
}

export function measureLogProof(event: LogEvent | undefined, proof: LogProofStep[]) {
  const inputBytes = event
    ? [event.id, event.kind, event.actor, event.detail, event.timestamp].reduce((total, value) => total + utf8ByteLength(value), 0)
    : 0
  const siblingBytes = proof.length * SHA256_BYTES
  return { inputBytes, siblingBytes, totalBytes: inputBytes + siblingBytes }
}

export function logTreeHeight(node: LogNode): number {
  if (!node.left || !node.right) {
    return node.depth
  }
  return Math.max(logTreeHeight(node.left), logTreeHeight(node.right))
}

export function collectLogEdges(node: LogNode): Array<{ parent: LogNode; child: LogNode }> {
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

export function collectLogNodes(node: LogNode): LogNode[] {
  return [
    node,
    ...(node.left ? collectLogNodes(node.left) : []),
    ...(node.right ? collectLogNodes(node.right) : []),
  ]
}

export function eventTimestamp(index: number) {
  const minute = 44 + Math.floor(index / 4)
  const second = (8 + index * 13) % 60
  return `09:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}