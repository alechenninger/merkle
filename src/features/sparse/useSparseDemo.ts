import { useMemo, useState } from 'react'
import { INITIAL_SPARSE_ENTRIES } from '../../demoData'
import {
  buildSparseProof,
  buildSparseTree,
  DEFAULT_SPARSE_DEPTH,
  findSparsePathConflict,
  MAX_SPARSE_DEPTH,
  MIN_SPARSE_DEPTH,
  measureSparseProof,
  sparseKeyPath,
  validateSparseEntries,
} from '../../domain/sparse'
import type { SparseEntry } from '../../domain/types'

export type SparseDemoModel = ReturnType<typeof useSparseDemo>

export function useSparseDemo() {
  const [entries, setEntries] = useState(INITIAL_SPARSE_ENTRIES)
  const [depth, setDepth] = useState(DEFAULT_SPARSE_DEPTH)
  const [selectedKey, setSelectedKey] = useState('account:alice')
  const [error, setError] = useState('')

  const validation = useMemo(() => validateSparseEntries(entries, depth), [entries, depth])
  const tree = useMemo(() => buildSparseTree(validation), [validation])
  const proof = useMemo(() => buildSparseProof(tree, selectedKey), [selectedKey, tree])
  const proofSize = useMemo(() => measureSparseProof(proof), [proof])
  const collisionEntryIds = useMemo(() => new Set(validation.collisionEntryIds), [validation.collisionEntryIds])
  const incompleteEntryIds = useMemo(() => new Set(validation.incompleteEntries.map((entry) => entry.id)), [validation.incompleteEntries])
  const occupiedPathCount = useMemo(
    () => new Set(entries.filter((entry) => entry.enabled && entry.key.trim()).map((entry) => sparseKeyPath(entry.key, depth))).size,
    [depth, entries],
  )
  const collisionMessage = validation.collisions
    .map(({ path, entries: collisionEntries }) => `Collision at ${depth} bits / path ${path}: ${collisionEntries.map((entry) => `"${entry.key}"`).join(' and ')} share this path.`)
    .join(' ')
  const incompleteMessage = validation.incompleteEntries
    .map((entry) => `State "${entry.id}" needs both a key and a value before it can be committed.`)
    .join(' ')
  const validationMessage = [collisionMessage, incompleteMessage].filter(Boolean).join(' ')

  const updateEntry = (entryIndex: number, field: 'key' | 'value', value: string) => {
    const nextValue = field === 'key' ? value.trim() : value
    setError('')
    if (field === 'key') {
      setSelectedKey(nextValue)
    }
    setEntries((currentEntries) => currentEntries.map((entry, index) => (
      index === entryIndex ? { ...entry, [field]: nextValue } : entry
    )))
  }

  const updateDepth = (value: string) => {
    const nextDepth = Number(value)
    const nextValidation = validateSparseEntries(entries, nextDepth)
    const conflict = nextValidation.collisions[0]
    if (conflict) {
      setError(`Collision at ${nextDepth} bits: "${conflict.entries[0].key}" and "${conflict.entries[1].key}" both map to ${conflict.path}.`)
      return
    }
    setDepth(nextDepth)
    setError('')
  }

  const addEntry = () => {
    if (occupiedPathCount >= 2 ** depth) {
      setError(`All ${2 ** depth} paths are occupied at ${depth} bits.`)
      return
    }
    let nextId = Math.max(0, ...entries.map((entry) => Number(entry.id.replace('state_', '')) || 0)) + 1
    let nextKey = `state:${String(nextId).padStart(3, '0')}`
    let attempts = 0
    while (findSparsePathConflict(entries, depth, '', nextKey) && attempts < 1000) {
      nextId += 1
      nextKey = `state:${String(nextId).padStart(3, '0')}`
      attempts += 1
    }
    if (attempts >= 1000) {
      setError(`Could not find an unused path at ${depth} bits.`)
      return
    }
    const nextEntry: SparseEntry = { id: `state_${String(nextId).padStart(3, '0')}`, key: nextKey, value: '24', enabled: true }
    setError('')
    setEntries((currentEntries) => [...currentEntries, nextEntry])
    setSelectedKey(nextKey)
  }

  const removeEntry = (entryIndex: number) => {
    setEntries((currentEntries) => currentEntries.filter((_, index) => index !== entryIndex))
    setError('')
  }

  const toggleEntry = (entryIndex: number, enabled: boolean) => {
    setEntries((currentEntries) => currentEntries.map((entry, index) => (
      index === entryIndex ? { ...entry, enabled } : entry
    )))
    setError('')
  }

  const reset = () => {
    setEntries(INITIAL_SPARSE_ENTRIES)
    setDepth(DEFAULT_SPARSE_DEPTH)
    setSelectedKey('account:alice')
    setError('')
  }

  return {
    entries,
    depth,
    selectedKey,
    validation,
    tree,
    proof,
    proofSize,
    collisionEntryIds,
    incompleteEntryIds,
    activeCount: validation.usableEntries.length,
    occupiedPathCount,
    errorMessage: [validationMessage, error].filter(Boolean).join(' '),
    isVerifiable: validation.valid,
    minDepth: MIN_SPARSE_DEPTH,
    maxDepth: MAX_SPARSE_DEPTH,
    updateEntry,
    updateDepth,
    addEntry,
    removeEntry,
    toggleEntry,
    setSelectedKey,
    reset,
  }
}