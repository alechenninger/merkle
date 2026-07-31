import { hashFields, SHA256_BYTES, utf8ByteLength } from './hash'
import type { SparseEntry, SparseNode, SparseProof, SparseProofStep, SparseResolvedEntry, SparseTree, SparseValidation } from './types'

export const MIN_SPARSE_DEPTH = 2
export const MAX_SPARSE_DEPTH = 8
export const DEFAULT_SPARSE_DEPTH = 4

export function sparseKeyPath(key: string, depth: number) {
  const hashWord = Number.parseInt(hashFields('smt:path', key.trim()).slice(0, 8), 16)
  const pathIndex = Math.floor(hashWord / 2 ** (32 - depth))
  return pathIndex.toString(2).padStart(depth, '0')
}

export function validateSparseEntries(entries: SparseEntry[], depth: number): SparseValidation {
  const candidates = entries
    .filter((entry) => entry.enabled && entry.key.trim() && entry.value.trim())
    .map((entry): SparseResolvedEntry => ({
      entry,
      key: entry.key.trim(),
      value: entry.value.trim(),
      path: sparseKeyPath(entry.key, depth),
    }))
  const entriesByPath = new Map<string, SparseEntry[]>()

  for (const candidate of candidates) {
    const pathEntries = entriesByPath.get(candidate.path) ?? []
    pathEntries.push(candidate.entry)
    entriesByPath.set(candidate.path, pathEntries)
  }

  const collisions = Array.from(entriesByPath.entries())
    .filter(([, pathEntries]) => pathEntries.length > 1)
    .map(([path, pathEntries]) => ({ path, entries: pathEntries }))
  const collisionEntryIds = collisions.flatMap((collision) => collision.entries.map((entry) => entry.id))
  const collisionIds = new Set(collisionEntryIds)
  const incompleteEntries = entries.filter((entry) => entry.enabled && (!entry.key.trim() || !entry.value.trim()))

  return {
    depth,
    usableEntries: candidates.filter((candidate) => !collisionIds.has(candidate.entry.id)),
    incompleteEntries,
    collisions,
    collisionEntryIds,
    valid: collisions.length === 0 && incompleteEntries.length === 0,
  }
}

export function findSparsePathConflict(entries: SparseEntry[], depth: number, entryId: string, key: string) {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    return undefined
  }
  const path = sparseKeyPath(normalizedKey, depth)
  return entries.find((entry) => entry.id !== entryId && entry.enabled && entry.key.trim() && sparseKeyPath(entry.key, depth) === path)
}

export function sparseLeafHash(key: string, value: string, depth: number) {
  const normalizedKey = key.trim()
  return hashFields('smt:leaf', sparseKeyPath(normalizedKey, depth), normalizedKey, value)
}

export function sparseNodeHash(left: string, right: string) {
  return hashFields('smt:node', left, right)
}

export function buildSparseTree(validation: SparseValidation): SparseTree {
  const { depth } = validation
  const emptyHashes = [hashFields('smt:empty', 'leaf')]
  for (let level = 1; level <= depth; level += 1) {
    emptyHashes.push(sparseNodeHash(emptyHashes[level - 1], emptyHashes[level - 1]))
  }

  const entryByPath = new Map(validation.usableEntries.map((resolvedEntry) => [resolvedEntry.path, resolvedEntry]))
  const leaves: SparseNode[] = Array.from({ length: 2 ** depth }, (_, index) => {
    const path = index.toString(2).padStart(depth, '0')
    const resolvedEntry = entryByPath.get(path)
    return {
      level: 0,
      index,
      hash: resolvedEntry ? sparseLeafHash(resolvedEntry.key, resolvedEntry.value, depth) : emptyHashes[0],
      path,
      key: resolvedEntry?.key,
      value: resolvedEntry?.value,
      active: Boolean(resolvedEntry),
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

export function buildSparseProof(tree: SparseTree, key: string): SparseProof {
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

export function measureSparseProof(proof: SparseProof) {
  const keyBytes = utf8ByteLength(proof.key)
  const valueBytes = proof.leaf.active ? utf8ByteLength(proof.leaf.value ?? '') : 0
  const siblingBytes = proof.steps.length * SHA256_BYTES
  return { keyBytes, valueBytes, inputBytes: keyBytes + valueBytes, siblingBytes, totalBytes: keyBytes + valueBytes + siblingBytes }
}