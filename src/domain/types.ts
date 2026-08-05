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

export type KeyTransUpdate = {
  id: string
  label: string
  version: number
  value: string
  opening: string
}

export type KeyTransPublication = {
  id: string
  timestamp: string
  updates: KeyTransUpdate[]
}

export type KeyTransRecord = KeyTransUpdate & {
  address?: string
  searchKey: string
  commitment: string
}

export type KeyTransPrefixLeaf = {
  type: 'leaf'
  hash: string
  depth: number
  address?: string
  searchKey: string
  commitment: string
  record: KeyTransRecord
}

export type KeyTransPrefixBranch = {
  type: 'branch'
  hash: string
  depth: number
  left?: KeyTransPrefixNode
  right?: KeyTransPrefixNode
}

export type KeyTransPrefixNode = KeyTransPrefixLeaf | KeyTransPrefixBranch

export type KeyTransPrefixTree = {
  root: KeyTransPrefixBranch
  records: KeyTransRecord[]
}

export type KeyTransPrefixProofStep = {
  depth: number
  siblingHash: string
  currentIsLeft: boolean
  combinedHash: string
}

export type KeyTransPrefixProofView = {
  searchKey: string
  result: 'inclusion' | 'nonInclusionLeaf' | 'nonInclusionParent'
  terminal: KeyTransPrefixLeaf | null
  steps: KeyTransPrefixProofStep[]
  reconstructedRoot: string
}

export type KeyTransSnapshot = {
  publication: KeyTransPublication
  records: KeyTransRecord[]
  prefixTree: KeyTransPrefixTree
}

export type KeyTransLogNode = {
  start: number
  end: number
  depth: number
  hash: string
  timestamp?: string
  prefixRoot?: string
  left?: KeyTransLogNode
  right?: KeyTransLogNode
}

export type KeyTransLogProofStep = {
  balancedHeads: KeyTransLogNode[]
  currentIsLeft: boolean
  combinedHash: string
}

export type KeyTransLogTree = {
  leafHashes: string[]
  roots: string[]
  root: KeyTransLogNode | null
}

export type KeyTransTreeHeadView = {
  treeSize: number
  root: string
  timestamp: string
}

export type KeyTransView = {
  snapshots: KeyTransSnapshot[]
  snapshotIndex: number
  snapshot: KeyTransSnapshot
  prefixProof: KeyTransPrefixProofView
  logTree: KeyTransLogTree
  logProof: KeyTransLogProofStep[]
  logProofElements: KeyTransLogNode[]
  reconstructedLogRoot: string
  treeHead: KeyTransTreeHeadView
}

export type KeyTransSearchRequest = {
  last?: number
  label: string
  version?: number
}

export type KeyTransTreeHead = {
  tree_size: number
  signature: string
}

export type KeyTransTreeHeadTbs = {
  tree_size: number
  root: string
}

export type KeyTransFullTreeHead =
  | { head_type: 'same' }
  | { head_type: 'updated'; tree_head: KeyTransTreeHead }

export type KeyTransWireTreeHead = KeyTransTreeHead
export type KeyTransWireFullTreeHead = KeyTransFullTreeHead

export type KeyTransBinaryLadderStep = {
  proof: string
  commitment?: string
}

export type KeyTransWireBinaryLadderStep = KeyTransBinaryLadderStep

export type KeyTransBinaryLadderStepView = KeyTransBinaryLadderStep & {
  version: number
  address: string
  result: 'inclusion' | 'non-inclusion'
}

export type KeyTransWirePrefixLeaf = {
  vrf_output: string
  commitment: string
}

export type KeyTransWirePrefixSearchResult =
  | { result_type: 'inclusion'; depth: number }
  | { result_type: 'nonInclusionLeaf'; leaf: KeyTransWirePrefixLeaf; depth: number }
  | { result_type: 'nonInclusionParent'; depth: number }

export type KeyTransPrefixProof = {
  results: KeyTransWirePrefixSearchResult[]
  elements: string[]
}

export type KeyTransPrefixProofResultView = {
  version: number
  result: KeyTransPrefixProofView['result']
  proof: KeyTransPrefixProofView
}

export type KeyTransPrefixProofBundleView = {
  position: number
  results: KeyTransPrefixProofResultView[]
  elements: KeyTransPrefixProofStep[]
  root: string
}

export type KeyTransTimestampView = {
  position: number
  timestamp: string
}

export type KeyTransPrefixRootView = {
  position: number
  root: string
}

export type KeyTransSearchInspection = {
  position: number
  prefixProof: KeyTransPrefixProofBundleView
  binaryLadder: KeyTransBinaryLadderStepView[]
}

export type KeyTransCombinedTreeProof = {
  timestamps: string[]
  prefix_proofs: KeyTransPrefixProof[]
  prefix_roots: string[]
  inclusion: {
    elements: string[]
  }
}

export type KeyTransCombinedTreeProofView = {
  timestamps: KeyTransTimestampView[]
  prefix_proofs: KeyTransPrefixProofBundleView[]
  prefix_roots: KeyTransPrefixRootView[]
  inspections: KeyTransSearchInspection[]
  inclusion: {
    elements: KeyTransLogNode[]
  }
}

export type KeyTransSearchResponse = {
  full_tree_head: KeyTransFullTreeHead
  version: number
  opening: string
  value: string
  binary_ladder: KeyTransBinaryLadderStep[]
  search: KeyTransCombinedTreeProof
}

export type KeyTransSearchResponseView = {
  treeHeadTbs: KeyTransTreeHeadTbs
  latestTimestamp: string
  binaryLadder: KeyTransBinaryLadderStepView[]
  search: KeyTransCombinedTreeProofView
}

export type KeyTransRetainedState = {
  tree_head: KeyTransTreeHead
  tree_head_tbs: KeyTransTreeHeadTbs
  full_subtree_heads: KeyTransLogNode[]
  frontier: KeyTransLogNode[]
}