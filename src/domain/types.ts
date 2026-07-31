export type SparseEntry = {
  id: string
  key: string
  value: string
  enabled: boolean
}

export type SparseResolvedEntry = {
  entry: SparseEntry
  key: string
  value: string
  path: string
}

export type SparseCollision = {
  path: string
  entries: SparseEntry[]
}

export type SparseValidation = {
  depth: number
  usableEntries: SparseResolvedEntry[]
  incompleteEntries: SparseEntry[]
  collisions: SparseCollision[]
  collisionEntryIds: string[]
  valid: boolean
}

export type SparseNode = {
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

export type SparseProofStep = {
  level: number
  siblingHash: string
  siblingIndex: number
  currentIsLeft: boolean
  combinedHash: string
}

export type SparseTree = {
  depth: number
  emptyHashes: string[]
  leaves: SparseNode[]
  levels: SparseNode[][]
  root: SparseNode
}

export type SparseProof = {
  key: string
  path: string
  leaf: SparseNode
  steps: SparseProofStep[]
  reconstructedRoot: string
  index: number
}

export type LogEvent = {
  id: string
  kind: string
  actor: string
  detail: string
  timestamp: string
}

export type LogNode = {
  start: number
  end: number
  depth: number
  hash: string
  left?: LogNode
  right?: LogNode
}

export type LogProofStep = {
  sibling: LogNode
  currentIsLeft: boolean
  combinedHash: string
}

export type LogView = {
  leafHashes: string[]
  tree: LogNode | null
  proof: LogProofStep[]
  roots: string[]
  selectedIndex: number
  reconstructedRoot: string
}