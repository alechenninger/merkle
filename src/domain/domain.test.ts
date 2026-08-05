import { describe, expect, it } from 'vitest'
import { createInitialKeyTransPublications, createInitialLogEvents, createInitialSparseEntries } from '../demoData'
import { hashFields, sha256 } from './hash'
import { buildLogTree, buildLogView, logLeafHash } from './log'
import { buildSparseProof, buildSparseTree, DEFAULT_SPARSE_DEPTH, sparseKeyPath, validateSparseEntries } from './sparse'
import type { LogEvent, SparseEntry } from './types'

describe('hashing', () => {
  it('matches the SHA-256 reference vector', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('keeps user fields unambiguous', () => {
    expect(hashFields('log:leaf', 'a|b', 'c')).not.toBe(hashFields('log:leaf', 'a', 'b|c'))
  })
})

describe('sparse tree', () => {
  it('starts with a valid collision-free demo state', () => {
    const validation = validateSparseEntries(createInitialSparseEntries(), DEFAULT_SPARSE_DEPTH)

    expect(validation.valid).toBe(true)
    expect(validation.collisions).toHaveLength(0)
  })

  it('rejects collisions and incomplete values before tree construction', () => {
    const firstKey = 'collision-0'
    const firstPath = sparseKeyPath(firstKey, 2)
    const secondKey = Array.from({ length: 100 }, (_, index) => `collision-${index + 1}`).find((key) => sparseKeyPath(key, 2) === firstPath)
    expect(secondKey).toBeDefined()

    const entries: SparseEntry[] = [
      { id: 'first', key: firstKey, value: '1', enabled: true },
      { id: 'second', key: secondKey!, value: '2', enabled: true },
      { id: 'incomplete', key: 'missing-value', value: '', enabled: true },
    ]
    const validation = validateSparseEntries(entries, 2)
    const tree = buildSparseTree(validation)

    expect(validation.valid).toBe(false)
    expect(validation.collisions).toHaveLength(1)
    expect(validation.incompleteEntries.map((entry) => entry.id)).toEqual(['incomplete'])
    expect(tree.leaves.filter((leaf) => leaf.active)).toHaveLength(0)
  })

  it('reconstructs both a populated and an empty proof to the root', () => {
    const entries: SparseEntry[] = [{ id: 'state', key: 'account:alice', value: '42', enabled: true }]
    const validation = validateSparseEntries(entries, 4)
    const tree = buildSparseTree(validation)
    const populatedProof = buildSparseProof(tree, 'account:alice')
    const emptyProof = buildSparseProof(tree, 'account:missing')

    expect(populatedProof.leaf.active).toBe(true)
    expect(populatedProof.reconstructedRoot).toBe(tree.root.hash)
    expect(emptyProof.leaf.active).toBe(false)
    expect(emptyProof.reconstructedRoot).toBe(tree.root.hash)
  })
})

describe('demo defaults', () => {
  it('creates fresh records for each reset', () => {
    const firstSparseEntries = createInitialSparseEntries()
    const secondSparseEntries = createInitialSparseEntries()
    const firstLogEvents = createInitialLogEvents()
    const secondLogEvents = createInitialLogEvents()
    const firstKeyTransPublications = createInitialKeyTransPublications()
    const secondKeyTransPublications = createInitialKeyTransPublications()

    expect(firstSparseEntries).not.toBe(secondSparseEntries)
    expect(firstSparseEntries[0]).not.toBe(secondSparseEntries[0])
    expect(firstLogEvents).not.toBe(secondLogEvents)
    expect(firstLogEvents[0]).not.toBe(secondLogEvents[0])
    expect(firstKeyTransPublications).not.toBe(secondKeyTransPublications)
    expect(firstKeyTransPublications[0]).not.toBe(secondKeyTransPublications[0])
    expect(firstKeyTransPublications[0].updates[0]).not.toBe(secondKeyTransPublications[0].updates[0])
  })
})

describe('Merkle log', () => {
  const events: LogEvent[] = Array.from({ length: 9 }, (_, index) => ({
    id: `evt_${index}`,
    kind: 'entry',
    actor: 'tester',
    detail: index === 2 ? 'a|b' : `detail-${index}`,
    timestamp: `10:00:${String(index).padStart(2, '0')}`,
  }))

  it('produces prefix roots equivalent to rebuilding each snapshot', () => {
    const view = buildLogView(events, 4)
    expect(view.roots).toHaveLength(events.length)
    events.forEach((_, index) => {
      const prefixHashes = events.slice(0, index + 1).map(logLeafHash)
      expect(view.roots[index]).toBe(buildLogTree(prefixHashes).hash)
    })
  })

  it('reconstructs the selected inclusion proof', () => {
    const view = buildLogView(events, 7)
    expect(view.tree).not.toBeNull()
    expect(view.reconstructedRoot).toBe(view.tree?.hash)
    expect(view.proof.length).toBeGreaterThan(0)
  })
})
