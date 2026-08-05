import { hashFields } from './hash'
import {
  buildKeyTransLogTree,
  buildKeyTransPrefixProof,
  buildKeyTransSnapshots,
  keyTransAddress,
  keyTransCommitment,
  keyTransLogNodeHash,
  keyTransLogLeafHash,
  keyTransPrefixLeafHash,
  keyTransPrefixNodeHash,
  keyTransSearchKey,
  KEYTRANS_ZERO_CHILD,
} from './keytrans'
import type {
  KeyTransBinaryLadderStep,
  KeyTransBinaryLadderStepView,
  KeyTransFullTreeHead,
  KeyTransCombinedTreeProof,
  KeyTransLogNode,
  KeyTransPrefixProof,
  KeyTransPrefixProofBundleView,
  KeyTransPrefixProofView,
  KeyTransPrefixProofStep,
  KeyTransPublication,
  KeyTransRecord,
  KeyTransRetainedState,
  KeyTransSearchInspection,
  KeyTransSearchRequest,
  KeyTransSearchResponse,
  KeyTransSearchResponseView,
  KeyTransSnapshot,
  KeyTransTreeHeadTbs,
} from './types'

export const KEYTRANS_WALKTHROUGH_LAST_SIZE = 5
export const KEYTRANS_WALKTHROUGH_LABEL = 'acct:alice'
export const KEYTRANS_WALKTHROUGH_LADDER = [0, 1, 3, 2]

type SearchTranscriptEntry = {
  position: number
  role: 'search' | 'view-update'
  title: string
  detail: string
  direction?: 'right' | 'stop'
  prefixProof?: KeyTransPrefixProofBundleView
}

type StructuredLogEntry = {
  position: number
  node: KeyTransLogNode
  source: 'prefix_proof' | 'prefix_root'
}

type KeyTransVerification = {
  vrfProofsVerified: boolean
  prefixProofsVerified: boolean
  targetCommitmentMatches: boolean
  timestampsMonotonic: boolean
  logRootMatches: boolean
  treeHeadSignatureVerified: boolean
}

type KeyTransReconstruction = {
  retained: KeyTransLogNode[]
  structured: StructuredLogEntry[]
  recomputed: KeyTransLogNode[]
  candidateRoot: string
  matchesTreeHead: boolean
}

export type KeyTransResponseVerification = {
  targetCommitment: string
  verification: KeyTransVerification
  reconstruction: KeyTransReconstruction
}

export type KeyTransWalkthrough = {
  snapshots: KeyTransSnapshot[]
  previousLogTree: ReturnType<typeof buildKeyTransLogTree>
  currentLogTree: ReturnType<typeof buildKeyTransLogTree>
  previousState: KeyTransRetainedState
  nextState: KeyTransRetainedState
  request: KeyTransSearchRequest
  response: KeyTransSearchResponse
  responseView: KeyTransSearchResponseView
  transcript: SearchTranscriptEntry[]
  structuredEntries: StructuredLogEntry[]
  targetRecord: KeyTransRecord
  targetCommitment: string
  verification: KeyTransVerification
  reconstruction: KeyTransReconstruction
  balancedHeadExample: {
    source: KeyTransLogNode
    heads: KeyTransLogNode[]
  }
}

function findLogNode(node: KeyTransLogNode, start: number, end: number): KeyTransLogNode {
  if (node.start === start && node.end === end) {
    return node
  }
  if (node.left && start >= node.left.start && end <= node.left.end) {
    return findLogNode(node.left, start, end)
  }
  if (node.right && start >= node.right.start && end <= node.right.end) {
    return findLogNode(node.right, start, end)
  }
  throw new Error(`Missing log node for range ${start}-${end}`)
}

function treeHead(treeSize: number, root: string): { wire: KeyTransFullTreeHead; tbs: KeyTransTreeHeadTbs } {
  const tbs = { tree_size: treeSize, root }
  return {
    tbs,
    wire: {
      head_type: 'updated',
      tree_head: {
        tree_size: treeSize,
        signature: hashFields('kt:demo:tree-head-signature', String(treeSize), root),
      },
    },
  }
}

function prefixElementPath(searchKey: string, step: KeyTransPrefixProofStep) {
  return `${searchKey.slice(0, step.depth)}${step.currentIsLeft ? '1' : '0'}`
}

function prefixWireElements(results: KeyTransPrefixProofBundleView['results']) {
  const elements = new Map<string, string>()
  for (const result of results) {
    for (const step of result.proof.steps) {
      elements.set(prefixElementPath(result.proof.searchKey, step), step.siblingHash)
    }
  }
  return Array.from(elements.entries())
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, hash]) => hash)
}

function prefixWireResult(proof: KeyTransPrefixProofView) {
  const depth = proof.terminal?.depth ?? proof.steps.at(-1)?.depth ?? 0
  if (proof.result === 'inclusion') {
    return { result_type: 'inclusion' as const, depth }
  }
  if (proof.result === 'nonInclusionLeaf') {
    return {
      result_type: 'nonInclusionLeaf' as const,
      leaf: {
        vrf_output: proof.terminal?.searchKey ?? '',
        commitment: proof.terminal?.commitment ?? '',
      },
      depth,
    }
  }
  return { result_type: 'nonInclusionParent' as const, depth }
}

type BatchPrefixProof = {
  wire: KeyTransPrefixProof
  view: KeyTransPrefixProofBundleView
}

function batchPrefixProof(snapshot: KeyTransSnapshot, position: number, versions: number[]): BatchPrefixProof {
  const results = versions.map((version) => {
    const proof = buildKeyTransPrefixProof(snapshot.prefixTree, KEYTRANS_WALKTHROUGH_LABEL, version)
    return { version, result: proof.result, proof }
  })
  const elements = results
    .flatMap(({ proof }) => proof.steps)
    .filter((step, index, steps) => steps.findIndex((candidate) => candidate.siblingHash === step.siblingHash) === index)
  const view: KeyTransPrefixProofBundleView = {
    position,
    results,
    elements,
    root: snapshot.prefixTree.root.hash,
  }
  return {
    view,
    wire: {
      results: results.map(({ proof }) => prefixWireResult(proof)),
      elements: prefixWireElements(results),
    },
  }
}

function ladderStep(snapshot: KeyTransSnapshot, version: number, targetVersion: number): KeyTransBinaryLadderStepView {
  const proof = buildKeyTransPrefixProof(snapshot.prefixTree, KEYTRANS_WALKTHROUGH_LABEL, version)
  const record = snapshot.records.find((candidate) => candidate.label === KEYTRANS_WALKTHROUGH_LABEL && candidate.version === version)
  return {
    version,
    proof: hashFields('kt:demo:vrf-proof', KEYTRANS_WALKTHROUGH_LABEL, String(version)),
    address: keyTransAddress(KEYTRANS_WALKTHROUGH_LABEL, version),
    commitment: record && version !== targetVersion ? record.commitment : undefined,
    result: proof.result === 'inclusion' ? 'inclusion' : 'non-inclusion',
  }
}

function wireLadderStep(step: KeyTransBinaryLadderStepView) {
  return {
    proof: step.proof,
    ...(step.commitment === undefined ? {} : { commitment: step.commitment }),
  }
}

function buildBalancedHeadExample(tree: KeyTransLogNode) {
  const source = findLogNode(tree, 4, 7)
  return {
    source,
    heads: [findLogNode(tree, 4, 6), findLogNode(tree, 6, 7)],
  }
}

function reconstructWirePrefixResult(
  result: KeyTransPrefixProof['results'][number],
  label: string,
  version: number,
  commitmentOverride: string | undefined,
  elements: Map<string, string>,
) {
  const searchKey = keyTransSearchKey(label, version)
  let valid = true
  let currentHash = KEYTRANS_ZERO_CHILD
  const stepCount = result.result_type === 'nonInclusionParent' ? result.depth + 1 : result.depth

  if (result.result_type === 'inclusion') {
    if (commitmentOverride === undefined) {
      valid = false
    } else {
      currentHash = keyTransPrefixLeafHash(searchKey, commitmentOverride)
    }
  } else if (result.result_type === 'nonInclusionLeaf') {
    valid = valid && result.leaf.vrf_output !== searchKey
    currentHash = keyTransPrefixLeafHash(result.leaf.vrf_output, result.leaf.commitment)
  }

  for (let depth = stepCount - 1; depth >= 0; depth -= 1) {
    const currentIsLeft = searchKey[depth] === '0'
    const siblingPath = `${searchKey.slice(0, depth)}${currentIsLeft ? '1' : '0'}`
    const siblingHash = elements.get(siblingPath)
    valid = valid && siblingHash !== undefined
    const resolvedSiblingHash = siblingHash ?? KEYTRANS_ZERO_CHILD
    currentHash = currentIsLeft
      ? keyTransPrefixNodeHash(currentHash, resolvedSiblingHash)
      : keyTransPrefixNodeHash(resolvedSiblingHash, currentHash)
  }

  return { root: currentHash, valid }
}

function prefixProofElementPaths(bundle: KeyTransPrefixProof, label: string, versions: number[]) {
  const paths = new Set<string>()
  bundle.results.forEach((result, index) => {
    const version = versions[index]
    if (version === undefined) {
      return
    }
    const searchKey = keyTransSearchKey(label, version)
    const stepCount = result.result_type === 'nonInclusionParent' ? result.depth + 1 : result.depth
    for (let depth = 0; depth < stepCount; depth += 1) {
      const currentIsLeft = searchKey[depth] === '0'
      paths.add(`${searchKey.slice(0, depth)}${currentIsLeft ? '1' : '0'}`)
    }
  })
  return [...paths].sort()
}

function verifyPrefixProofBundle(
  bundle: KeyTransPrefixProof,
  ladder: KeyTransBinaryLadderStep[],
  ladderVersions: number[],
  versions: number[],
  label: string,
  targetVersion: number,
  targetCommitment: string,
  rightmost: boolean,
) {
  const elementPaths = prefixProofElementPaths(bundle, label, versions)
  let valid = bundle.results.length === versions.length
    && bundle.elements.length === elementPaths.length
  const roots: string[] = []
  const elements = new Map(elementPaths.map((path, index) => [path, bundle.elements[index]]))

  bundle.results.forEach((result, index) => {
    const version = versions[index]
    const ladderIndex = ladderVersions.indexOf(version)
    const ladderStep = ladder[ladderIndex]
    if (!ladderStep || ladderIndex < 0) {
      valid = false
      return
    }
    if (version === undefined) {
      valid = false
      return
    }
    const expectedCommitment = result.result_type === 'inclusion'
      ? version === targetVersion ? targetCommitment : ladderStep.commitment
      : undefined
    if (result.result_type === 'inclusion' && expectedCommitment === undefined) {
      valid = false
    }
    if (version > targetVersion) {
      valid = valid && result.result_type !== 'inclusion'
    }
    if (rightmost) {
      valid = valid && (version <= targetVersion
        ? result.result_type === 'inclusion'
        : result.result_type !== 'inclusion')
    }
    const proofVerification = reconstructWirePrefixResult(result, label, version, expectedCommitment, elements)
    valid = valid && proofVerification.valid
    roots.push(proofVerification.root)
  })

  const targetResultIndex = versions.indexOf(targetVersion)
  const reconstructedRoot = roots[targetResultIndex] ?? roots[0] ?? ''
  valid = valid && roots.every((root) => root === reconstructedRoot)

  return {
    root: reconstructedRoot,
    valid,
  }
}

function responseLogLeaf(position: number, timestamp: string, prefixRoot: string, depth: number): KeyTransLogNode {
  return {
    start: position - 1,
    end: position,
    depth,
    hash: keyTransLogLeafHash(timestamp, prefixRoot),
    timestamp,
    prefixRoot,
  }
}

function responseTimestamp(response: KeyTransSearchResponse, position: number) {
  const timestampIndex = position === 6 ? 0 : position === 7 ? 1 : -1
  return timestampIndex >= 0 ? response.search.timestamps[timestampIndex] ?? '' : ''
}

export function verifyKeyTransResponse(
  request: KeyTransSearchRequest,
  response: KeyTransSearchResponse,
  retainedState: KeyTransRetainedState,
): KeyTransResponseVerification {
  const targetCommitment = keyTransCommitment({
    label: request.label,
    version: response.version,
    opening: response.opening,
    value: response.value,
  })
  const expectedPositions = [4, 6, 7]
  const bundles = response.search.prefix_proofs
  const ladderVersions = KEYTRANS_WALKTHROUGH_LADDER
  const versionsByPosition = [[0, 1], ladderVersions, ladderVersions]
  const prefixVerifications = new Map<number, { root: string; valid: boolean }>()

  expectedPositions.forEach((position, index) => {
    const bundle = bundles[index]
    if (!bundle) {
      prefixVerifications.set(position, { root: '', valid: false })
      return
    }
    prefixVerifications.set(position, verifyPrefixProofBundle(
      bundle,
      response.binary_ladder,
      ladderVersions,
      versionsByPosition[index],
      request.label,
      response.version,
      targetCommitment,
      position === 7,
    ))
  })

  const targetBundle = bundles[1]
  const targetResultIndex = versionsByPosition[1].indexOf(response.version)
  const targetResult = targetBundle?.results[targetResultIndex]
  const targetLadderStep = response.binary_ladder[ladderVersions.indexOf(response.version)]
  const targetCommitmentMatches = targetResult?.result_type === 'inclusion'
    && prefixVerifications.get(6)?.valid === true
    && targetLadderStep?.commitment === undefined

  const vrfProofsVerified = response.binary_ladder.every((step, index) => (
    step.proof === hashFields('kt:demo:vrf-proof', request.label, String(ladderVersions[index]))
  ))
  const expectedInspectionShape = expectedPositions.length === bundles.length
    && response.binary_ladder.length === ladderVersions.length
  const targetLadderIndex = ladderVersions.indexOf(response.version)
  const targetCommitmentsOmitted = targetLadderIndex >= 0
    && response.binary_ladder[targetLadderIndex]?.commitment === undefined
  const retainedPositionFour = retainedState.frontier.find((entry) => entry.start === 3 && entry.end === 4)
  const positionFourPrefixRootMatchesRetained = prefixVerifications.get(4)?.root === retainedPositionFour?.prefixRoot
  const suppliedPositionSevenRoot = response.search.prefix_roots[0]
  const positionSevenPrefixRoot = suppliedPositionSevenRoot ?? prefixVerifications.get(7)?.root ?? ''
  const prefixRootsShapeValid = response.search.prefix_roots.length <= 1
    && (suppliedPositionSevenRoot === undefined || suppliedPositionSevenRoot === prefixVerifications.get(7)?.root)
  const prefixProofsVerified = expectedInspectionShape
    && prefixVerifications.size === expectedPositions.length
    && Array.from(prefixVerifications.values()).every((verification) => verification.valid)
    && positionFourPrefixRootMatchesRetained
    && prefixRootsShapeValid
  const responseTimestamps = [6, 7].map((position) => responseTimestamp(response, position))
  const retainedRightmostTimestamp = retainedState.frontier.at(-1)?.timestamp ?? ''
  const timestampsShapeValid = response.search.timestamps.length === 2
  const newTimestampsMonotonic = responseTimestamps.every((timestamp, index) => index === 0 || timestamp >= responseTimestamps[index - 1])
  const timestampsMonotonic = timestampsShapeValid
    && responseTimestamps[0] >= retainedRightmostTimestamp
    && newTimestampsMonotonic

  const positionSixLeaf = responseLogLeaf(6, responseTimestamps[0], prefixVerifications.get(6)?.root ?? '', 3)
  const positionSevenLeaf = responseLogLeaf(7, responseTimestamps[1], positionSevenPrefixRoot, 2)
  const retainedMiddle = retainedState.full_subtree_heads.find((head) => head.start === 4 && head.end === 5)
  const retainedLeft = retainedState.full_subtree_heads.find((head) => head.start === 0 && head.end === 4)
  const recomputedMiddle = {
    start: 4,
    end: 6,
    depth: 0,
    hash: keyTransLogNodeHash(retainedMiddle?.hash ?? '', positionSixLeaf.hash),
  }
  const recomputedRight = {
    start: 4,
    end: 7,
    depth: 0,
    hash: keyTransLogNodeHash(recomputedMiddle.hash, positionSevenLeaf.hash),
  }
  const candidateRoot = keyTransLogNodeHash(retainedLeft?.hash ?? '', recomputedRight.hash)
  const currentHead = response.full_tree_head
  const treeHeadSignatureVerified = currentHead.head_type === 'updated'
    && currentHead.tree_head.tree_size > retainedState.tree_head.tree_size
    && currentHead.tree_head.signature === hashFields(
      'kt:demo:tree-head-signature',
      String(currentHead.tree_head.tree_size),
      candidateRoot,
    )
  const structured: StructuredLogEntry[] = [
    { position: 6, node: positionSixLeaf, source: 'prefix_proof' },
    { position: 7, node: positionSevenLeaf, source: suppliedPositionSevenRoot ? 'prefix_root' : 'prefix_proof' },
  ]
  const verification = {
    vrfProofsVerified: vrfProofsVerified && targetCommitmentsOmitted,
    prefixProofsVerified,
    targetCommitmentMatches,
    timestampsMonotonic,
    logRootMatches: treeHeadSignatureVerified,
    treeHeadSignatureVerified,
  }

  return {
    targetCommitment,
    verification,
    reconstruction: {
      retained: retainedState.full_subtree_heads,
      structured,
      recomputed: [recomputedMiddle, recomputedRight],
      candidateRoot,
      matchesTreeHead: treeHeadSignatureVerified,
    },
  }
}

export function buildKeyTransWalkthrough(publications: KeyTransPublication[]): KeyTransWalkthrough {
  if (publications.length !== 7) {
    throw new Error('Key Transparency walkthrough requires exactly seven publications')
  }
  const snapshots = buildKeyTransSnapshots(publications)
  const previousTree = buildKeyTransLogTree(snapshots.slice(0, KEYTRANS_WALKTHROUGH_LAST_SIZE))
  const currentTree = buildKeyTransLogTree(snapshots)
  if (!previousTree.root || !currentTree.root) {
    throw new Error('Key Transparency walkthrough requires non-empty log trees')
  }

  const previousFullSubtreeHeads = [findLogNode(previousTree.root, 0, 4), findLogNode(previousTree.root, 4, 5)]
  const previousFrontier = [findLogNode(previousTree.root, 3, 4), findLogNode(previousTree.root, 4, 5)]
  const nextFullSubtreeHeads = [findLogNode(currentTree.root, 0, 4), findLogNode(currentTree.root, 4, 6), findLogNode(currentTree.root, 6, 7)]
  const nextFrontier = [findLogNode(currentTree.root, 3, 4), findLogNode(currentTree.root, 5, 6), findLogNode(currentTree.root, 6, 7)]
  const targetSnapshot = snapshots[5]
  const targetRecord = targetSnapshot.records.find((record) => record.label === KEYTRANS_WALKTHROUGH_LABEL && record.version === 1)
  if (!targetRecord) {
    throw new Error('Key Transparency walkthrough fixture is missing Alice version 1')
  }

  const rootPrefixProof = batchPrefixProof(snapshots[3], 4, [0, 1])
  const targetPrefixProof = batchPrefixProof(targetSnapshot, 6, KEYTRANS_WALKTHROUGH_LADDER)
  const rightmostPrefixProof = batchPrefixProof(snapshots[6], 7, KEYTRANS_WALKTHROUGH_LADDER)
  const searchInspections: KeyTransSearchInspection[] = [
    {
      position: 4,
      prefixProof: rootPrefixProof.view,
      binaryLadder: [0, 1].map((version) => ladderStep(snapshots[3], version, targetRecord.version)),
    },
    {
      position: 6,
      prefixProof: targetPrefixProof.view,
      binaryLadder: KEYTRANS_WALKTHROUGH_LADDER.map((version) => ladderStep(targetSnapshot, version, targetRecord.version)),
    },
    {
      position: 7,
      prefixProof: rightmostPrefixProof.view,
      binaryLadder: KEYTRANS_WALKTHROUGH_LADDER.map((version) => ladderStep(snapshots[6], version, targetRecord.version)),
    },
  ]
  const request: KeyTransSearchRequest = { last: KEYTRANS_WALKTHROUGH_LAST_SIZE, label: KEYTRANS_WALKTHROUGH_LABEL }
  const currentHead = treeHead(7, currentTree.root.hash)
  const previousHead = treeHead(5, previousTree.root.hash)
  const targetBinaryLadder = searchInspections[1].binaryLadder
  const combinedTreeProof: KeyTransCombinedTreeProof = {
    timestamps: [
      snapshots[5].publication.timestamp,
      snapshots[6].publication.timestamp,
    ],
    prefix_proofs: [rootPrefixProof.wire, targetPrefixProof.wire, rightmostPrefixProof.wire],
    prefix_roots: [],
    inclusion: { elements: [] },
  }
  const response: KeyTransSearchResponse = {
    full_tree_head: currentHead.wire,
    version: targetRecord.version,
    opening: targetRecord.opening,
    value: targetRecord.value,
    binary_ladder: targetBinaryLadder.map(wireLadderStep),
    search: combinedTreeProof,
  }
  const previousState: KeyTransRetainedState = {
    tree_head: previousHead.wire.head_type === 'updated' ? previousHead.wire.tree_head : { tree_size: 0, signature: '' },
    tree_head_tbs: previousHead.tbs,
    full_subtree_heads: previousFullSubtreeHeads,
    frontier: previousFrontier,
  }
  const verifiedResponse = verifyKeyTransResponse(request, response, previousState)
  const nextState: KeyTransRetainedState = {
    tree_head: response.full_tree_head.head_type === 'updated' ? response.full_tree_head.tree_head : { tree_size: 0, signature: '' },
    tree_head_tbs: currentHead.tbs,
    full_subtree_heads: nextFullSubtreeHeads,
    frontier: nextFrontier,
  }
  const responseView: KeyTransSearchResponseView = {
    treeHeadTbs: currentHead.tbs,
    latestTimestamp: snapshots[6].publication.timestamp,
    binaryLadder: targetBinaryLadder,
    search: {
      timestamps: [
        { position: 6, timestamp: snapshots[5].publication.timestamp },
        { position: 7, timestamp: snapshots[6].publication.timestamp },
      ],
      prefix_proofs: [rootPrefixProof.view, targetPrefixProof.view, rightmostPrefixProof.view],
      prefix_roots: [],
      inspections: searchInspections,
      inclusion: { elements: [] },
    },
  }
  const structuredEntries = verifiedResponse.reconstruction.structured
  const transcript: SearchTranscriptEntry[] = [
    {
      position: 6,
      role: 'view-update',
      title: 'New path timestamp',
      detail: 'The size-5 view is extended through the new direct path and frontier.',
    },
    {
      position: 7,
      role: 'view-update',
      title: 'New frontier timestamp',
      detail: 'The rightmost entry is checked for monotonic timestamp order.',
    },
    {
      position: 4,
      role: 'search',
      title: 'Implicit search root',
      detail: 'Alice version 1 is absent in this older directory snapshot, so the search moves right.',
      direction: 'right',
      prefixProof: rootPrefixProof.view,
    },
    {
      position: 6,
      role: 'search',
      title: 'Current candidate',
      detail: 'The ladder finds version 1, but this is not the rightmost entry, so the search continues right.',
      direction: 'right',
      prefixProof: targetPrefixProof.view,
    },
    {
      position: 7,
      role: 'search',
      title: 'Rightmost confirmation',
      detail: 'The rightmost ladder proves version 1 is present and versions 2 and 3 are absent. Position 6 remains the terminal result.',
      direction: 'stop',
      prefixProof: rightmostPrefixProof.view,
    },
  ]

  return {
    snapshots,
    previousLogTree: previousTree,
    currentLogTree: currentTree,
    previousState,
    nextState,
    request,
    response,
    responseView,
    transcript,
    structuredEntries,
    targetRecord,
    targetCommitment: verifiedResponse.targetCommitment,
    verification: verifiedResponse.verification,
    reconstruction: verifiedResponse.reconstruction,
    balancedHeadExample: buildBalancedHeadExample(currentTree.root),
  }
}