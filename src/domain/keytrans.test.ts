import { describe, expect, it } from 'vitest'
import {
  buildKeyTransLogTree,
  buildKeyTransPrefixProof,
  buildKeyTransPrefixTree,
  buildKeyTransSnapshots,
  buildKeyTransView,
  keyTransCommitment,
  keyTransSearchKey,
} from './keytrans'
import type { KeyTransPublication, KeyTransRecord } from './types'

const publications: KeyTransPublication[] = [
  {
    id: 'pub_001',
    timestamp: '10:00:00',
    updates: [
      { id: 'alice_0', label: 'acct:alice', version: 0, value: 'alice-key-a', opening: 'opening-alice-0' },
      { id: 'bob_0', label: 'acct:bob', version: 0, value: 'bob-key-a', opening: 'opening-bob-0' },
    ],
  },
  {
    id: 'pub_002',
    timestamp: '10:04:00',
    updates: [{ id: 'alice_1', label: 'acct:alice', version: 1, value: 'alice-key-b', opening: 'opening-alice-1' }],
  },
]

describe('Key Transparency educational model', () => {
  it('derives unique demo search keys and commits to every update field', () => {
    const update = publications[0].updates[0]

    expect(keyTransSearchKey('acct:alice', 0)).not.toBe(keyTransSearchKey('acct:alice', 1))
    expect(keyTransCommitment(update)).not.toBe(keyTransCommitment({ ...update, value: 'substituted-key' }))
    expect(keyTransCommitment(update)).not.toBe(keyTransCommitment({ ...update, opening: 'substituted-opening' }))
  })

  it('reconstructs a prefix inclusion proof and both non-inclusion terminals', () => {
    const snapshots = buildKeyTransSnapshots(publications)
    const firstTree = snapshots[0].prefixTree
    const inclusion = buildKeyTransPrefixProof(firstTree, 'acct:alice', 0)
    const absentVersion = buildKeyTransPrefixProof(firstTree, 'acct:alice', 1)
    const absentLabel = buildKeyTransPrefixProof(firstTree, 'acct:unknown', 0)

    expect(inclusion.result).toBe('inclusion')
    expect(inclusion.reconstructedRoot).toBe(firstTree.root.hash)
    expect(absentVersion.result).toMatch(/nonInclusion/)
    expect(absentVersion.reconstructedRoot).toBe(firstTree.root.hash)
    expect(absentLabel.result).toMatch(/nonInclusion/)
    expect(absentLabel.reconstructedRoot).toBe(firstTree.root.hash)
  })

  it('preserves prefix roots and records from earlier published snapshots', () => {
    const snapshots = buildKeyTransSnapshots(publications)

    expect(snapshots[0].records).toHaveLength(2)
    expect(snapshots[1].records).toHaveLength(3)
    expect(snapshots[0].prefixTree.root.hash).not.toBe(snapshots[1].prefixTree.root.hash)
    expect(buildKeyTransPrefixProof(snapshots[0].prefixTree, 'acct:alice', 1).result).not.toBe('inclusion')
  })

  it('reconstructs the selected timestamped prefix-root log leaf to the tree head', () => {
    const view = buildKeyTransView(publications, 'acct:alice', 1, 1)
    const logTree = buildKeyTransLogTree(view.snapshots)

    expect(view.prefixProof.result).toBe('inclusion')
    expect(view.reconstructedLogRoot).toBe(view.treeHead.root)
    expect(logTree.roots).toHaveLength(publications.length)
    expect(logTree.leafHashes[1]).not.toBe(logTree.leafHashes[0])
  })

  it('decomposes a non-balanced log copath into balanced subtree heads', () => {
    const sevenPublications: KeyTransPublication[] = Array.from({ length: 7 }, (_, index) => ({
      id: `pub_${index + 1}`,
      timestamp: `10:0${index}:00`,
      updates: [{
        id: `alice_${index}`,
        label: 'acct:alice',
        version: index,
        value: `alice-key-${index}`,
        opening: `opening-alice-${index}`,
      }],
    }))
    const view = buildKeyTransView(sevenPublications, 'acct:alice', 0, 2)
    const rootCopathStep = view.logProof.at(-1)

    expect(rootCopathStep?.balancedHeads.map((head) => `${head.start}-${head.end}`)).toEqual(['4-6', '6-7'])
    expect(rootCopathStep?.balancedHeads.map((head) => head.end - head.start)).toEqual([2, 1])
    expect(view.logProofElements.map((head) => `${head.start}-${head.end}`)).toEqual(['0-2', '3-4', '4-6', '6-7'])
    expect(view.reconstructedLogRoot).toBe(view.treeHead.root)
  })

  it('rejects a duplicate label-version before constructing a snapshot', () => {
    const duplicate: KeyTransPublication[] = [
      publications[0],
      { id: 'pub_duplicate', timestamp: '10:05:00', updates: [publications[0].updates[0]] },
    ]

    expect(() => buildKeyTransSnapshots(duplicate)).toThrow('Duplicate Key Transparency label-version')
  })

  it('rejects colliding demo search keys before building a prefix tree', () => {
    const record = (id: string): KeyTransRecord => ({
      id,
      label: id,
      version: 0,
      value: id,
      opening: id,
      searchKey: '0000000000000000',
      commitment: id,
    })

    expect(() => buildKeyTransPrefixTree([record('one'), record('two')])).toThrow('Key Transparency demo search-key collision')
  })
})