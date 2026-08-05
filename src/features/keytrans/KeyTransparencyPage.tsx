import './KeyTransparencyPage.css'
import {
  collectKeyTransLogEdges,
  collectKeyTransLogNodes,
  collectKeyTransPrefixEdges,
  collectKeyTransPrefixNodes,
  keyTransPrefixTreeHeight,
} from '../../domain/keytrans'
import { shortHash, valueSummary } from '../../utils/format'
import type { KeyTransLogNode, KeyTransPrefixBranch, KeyTransPrefixNode } from '../../domain/types'
import type { KeyTransWalkthroughModel } from './useKeyTransWalkthrough'
import { useKeyTransWalkthrough } from './useKeyTransWalkthrough'

type KeyTransparencyPageProps = {
  onNavigate: (path: string) => void
}

function rangeLabel(node: KeyTransLogNode) {
  return `${node.start + 1}-${node.end}`
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...`
}

function resultLabel(result: 'inclusion' | 'non-inclusion') {
  return result === 'inclusion' ? 'included' : 'absent'
}

function responseTreeHeadSignature(model: KeyTransWalkthroughModel) {
  return model.response.full_tree_head.head_type === 'updated'
    ? model.response.full_tree_head.tree_head.signature
    : ''
}

function assignPrefixPositions(node: KeyTransPrefixNode, positions: Map<string, number>, nextLeaf: { value: number }): number {
  if (node.type === 'leaf') {
    const position = nextLeaf.value
    nextLeaf.value += 1
    positions.set(node.hash, position)
    return position
  }
  const childPositions = [node.left, node.right]
    .filter((child): child is KeyTransPrefixNode => Boolean(child))
    .map((child) => assignPrefixPositions(child, positions, nextLeaf))
  const position = childPositions.reduce((total, childPosition) => total + childPosition, 0) / Math.max(childPositions.length, 1)
  positions.set(node.hash, position)
  return position
}

function prefixPathHashes(root: KeyTransPrefixBranch, searchKey: string) {
  const hashes = new Set<string>()
  let cursor: KeyTransPrefixNode = root
  while (cursor.type === 'branch') {
    hashes.add(cursor.hash)
    const child: KeyTransPrefixNode | undefined = searchKey[cursor.depth] === '0' ? cursor.left : cursor.right
    if (!child) {
      break
    }
    cursor = child
  }
  hashes.add(cursor.hash)
  return hashes
}

function logRangeKey(node: KeyTransLogNode) {
  return `${node.start}-${node.end}`
}

function logNodeRole(node: KeyTransLogNode, model: KeyTransWalkthroughModel) {
  const range = logRangeKey(node)
  if (range === '0-7') {
    return 'signed'
  }
  if (model.reconstruction.retained.some((head) => logRangeKey(head) === range)) {
    return 'retained'
  }
  if (model.reconstruction.structured.some((entry) => logRangeKey(entry.node) === range)) {
    return 'structured'
  }
  if (model.reconstruction.recomputed.some((head) => logRangeKey(head) === range)) {
    return 'recomputed'
  }
  return ''
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="4" />
      <g className="brand-branches">
        <path d="M24 13v4M15 21l9-4 9 4M15 25v4l-7 6M15 29l5 6M33 25v4l-5 6M33 29l7 6" />
      </g>
      <circle className="brand-root" cx="24" cy="12" r="4" />
      <circle cx="15" cy="22" r="3.25" />
      <circle cx="33" cy="22" r="3.25" />
      <circle cx="8" cy="35" r="3.25" />
      <circle cx="20" cy="35" r="3.25" />
      <circle cx="28" cy="35" r="3.25" />
      <circle cx="40" cy="35" r="3.25" />
    </svg>
  )
}

function PageHeader({ onNavigate, onReset }: { onNavigate: (path: string) => void; onReset: () => void }) {
  return (
    <header className="topbar kt-walkthrough-topbar">
      <div className="brand-group">
        <BrandMark />
        <div>
          <span className="overline">Merkle / protocol lab</span>
          <h1>Key Transparency</h1>
        </div>
      </div>
      <div className="kt-page-nav">
        <a href="/" onClick={(event) => { event.preventDefault(); onNavigate('/') }}>Field notes</a>
        <span className="kt-page-status"><b /> client walkthrough</span>
        <button className="reset-button" type="button" onClick={onReset}>Restart walkthrough</button>
      </div>
    </header>
  )
}

function StoryIntro({ model }: { model: KeyTransWalkthroughModel }) {
  return (
    <section className="kt-hero" aria-labelledby="kt-walkthrough-title">
      <div className="kt-hero-copy">
        <span className="section-kicker blue-text">One client operation / two tree heads</span>
        <h2 id="kt-walkthrough-title">Bob verifies Alice's latest key.</h2>
        <p>
          Bob last verified the log at size 5. Alice rotates her key, the operator appends two entries, and Bob asks for the latest key with <code>last = 5</code>.
        </p>
        <div className="kt-hero-rule">
          <span>Start with the story.</span>
          <strong>The cryptographic primitives stay compact; the protocol objects and verifier state stay visible.</strong>
        </div>
      </div>
      <div className="kt-hero-facts" aria-label="Walkthrough facts">
        <div><span>previous tree</span><strong>size {model.previousState.tree_head_tbs.tree_size}</strong><code>{shortHash(model.previousState.tree_head_tbs.root)}</code></div>
        <div><span>request</span><strong>latest Alice key</strong><code>last = {model.request.last}</code></div>
        <div><span>current tree</span><strong>size {model.responseView.treeHeadTbs.tree_size}</strong><code>{shortHash(model.responseView.treeHeadTbs.root)}</code></div>
      </div>
    </section>
  )
}

function VocabularyStrip() {
  return (
    <section className="kt-vocabulary" aria-label="Three meanings of version">
      <div className="kt-vocabulary-title"><span className="mini-label blue-text">Keep the nouns straight</span><strong>Three different coordinates move through this operation.</strong></div>
      <div><span>key version</span><b>Alice v0, Alice v1</b><p>One label's logical history.</p></div>
      <div><span>directory snapshot</span><b>prefix root at log position 5, 6, 7</b><p>One logical tree, published over time.</p></div>
      <div><span>log position</span><b>entry 5, entry 6, entry 7</b><p>One chronological place in the append-only log.</p></div>
    </section>
  )
}

function PrefixStructureDiagram({ model }: { model: KeyTransWalkthroughModel }) {
  const snapshot = model.snapshots[model.activePosition - 1]
  const nodes = collectKeyTransPrefixNodes(snapshot.prefixTree.root)
  const leaves = nodes.filter((node) => node.type === 'leaf')
  const positions = new Map<string, number>()
  assignPrefixPositions(snapshot.prefixTree.root, positions, { value: 0 })
  const leafCount = Math.max(leaves.length, 1)
  const width = Math.max(760, leafCount * 128)
  const nodeX = (node: KeyTransPrefixNode) => ((positions.get(node.hash) ?? 0) + 0.5) / leafCount * width
  const nodeY = (node: KeyTransPrefixNode) => 26 + node.depth * 34
  const height = Math.max(190, (keyTransPrefixTreeHeight(snapshot.prefixTree.root) + 1) * 34 + 42)
  const activeProof = model.activePrefixResult?.proof
  const pathHashes = activeProof ? prefixPathHashes(snapshot.prefixTree.root, activeProof.searchKey) : new Set<string>()
  const proofHashes = new Set(activeProof?.steps.map((step) => step.siblingHash) ?? [])

  return (
    <div className="kt-structure-diagram-frame">
      <svg className="kt-structure-svg kt-prefix-structure-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Alice's prefix tree at log position ${model.activePosition}`}>
        {collectKeyTransPrefixEdges(snapshot.prefixTree.root).map(({ parent, child }) => (
          <line className={`kt-structure-edge ${pathHashes.has(child.hash) ? 'is-path' : ''} ${proofHashes.has(child.hash) ? 'is-proof' : ''}`} key={`${parent.hash}-${child.hash}`} x1={nodeX(parent)} y1={nodeY(parent)} x2={nodeX(child)} y2={nodeY(child)} />
        ))}
        {nodes.map((node) => {
          const leaf = node.type === 'leaf'
          const isPath = pathHashes.has(node.hash)
          const isProof = proofHashes.has(node.hash)
          return (
            <g className={`kt-structure-node ${leaf ? 'is-leaf' : 'is-branch'} ${isPath ? 'is-path' : ''} ${isProof ? 'is-proof' : ''} ${node === snapshot.prefixTree.root ? 'is-root' : ''}`} key={node.hash}>
              <rect x={nodeX(node) - (leaf ? 43 : 33)} y={nodeY(node) - 13} width={leaf ? 86 : 66} height="26" rx="3" />
              <text className="kt-structure-hash" x={nodeX(node)} y={nodeY(node)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
              <text className="kt-structure-label" x={nodeX(node)} y={nodeY(node) + 23} textAnchor="middle">{leaf ? `${node.record.label.replace('acct:', '')} v${node.record.version}` : `depth ${node.depth}`}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function LogStructureDiagram({ model }: { model: KeyTransWalkthroughModel }) {
  const root = model.currentLogTree.root
  if (!root) {
    return null
  }
  const nodes = collectKeyTransLogNodes(root)
  const treeSize = model.currentLogTree.leafHashes.length
  const width = Math.max(760, treeSize * 124)
  const nodeX = (node: KeyTransLogNode) => ((node.start + node.end) / 2 / treeSize) * width
  const nodeY = (node: KeyTransLogNode) => 25 + node.depth * 42
  const height = Math.max(210, (Math.max(...nodes.map((node) => node.depth), 0) + 1) * 42 + 52)

  return (
    <div className="kt-structure-diagram-frame">
      <svg className="kt-structure-svg kt-log-structure-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Size seven Key Transparency append-only log tree">
        {collectKeyTransLogEdges(root).map(({ parent, child }) => {
          const role = logNodeRole(child, model)
          return <line className={`kt-structure-edge ${role ? `is-${role}` : ''}`} key={`${parent.start}-${parent.end}-${child.start}-${child.end}`} x1={nodeX(parent)} y1={nodeY(parent)} x2={nodeX(child)} y2={nodeY(child)} />
        })}
        {nodes.map((node) => {
          const leaf = !node.left
          const role = logNodeRole(node, model)
          return (
            <g className={`kt-structure-node kt-log-structure-node ${leaf ? 'is-leaf' : 'is-branch'} ${role ? `is-${role}` : ''}`} key={`${node.start}-${node.end}`}>
              <rect x={nodeX(node) - (leaf ? 43 : 33)} y={nodeY(node) - 13} width={leaf ? 86 : 66} height="26" rx="3" />
              <text className="kt-structure-hash" x={nodeX(node)} y={nodeY(node)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
              <text className="kt-structure-label" x={nodeX(node)} y={nodeY(node) + 23} textAnchor="middle">{leaf ? `#${node.start + 1}` : `H[${rangeLabel(node)}]`}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function StructureShapeInspectors({ model }: { model: KeyTransWalkthroughModel }) {
  const snapshot = model.snapshots[model.activePosition - 1]
  const prefixRoot = snapshot.prefixTree.root
  const logRoot = model.currentLogTree.root
  const prefixRecord = model.activePrefixResult?.proof.terminal?.record ?? model.targetRecord
  return (
    <details className="kt-shape-inspectors" open>
      <summary>Inspect the object shapes behind the diagrams</summary>
      <div className="kt-shape-grid">
        <pre>{`KeyTransPrefixNode
branch {
  type: "branch"
  depth: ${prefixRoot.depth}
  hash: "${shortHash(prefixRoot.hash)}"
  left: ${prefixRoot.left?.type ?? 'undefined'}
  right: ${prefixRoot.right?.type ?? 'undefined'}
}
leaf {
  type: "leaf"
  record: {
    label: "${prefixRecord.label}"
    version: ${prefixRecord.version}
    commitment: "${shortHash(prefixRecord.commitment)}"
  }
}`}</pre>
        <pre>{`KeyTransLogNode
{
  start: ${logRoot?.start ?? 0}
  end: ${logRoot?.end ?? 0}
  depth: ${logRoot?.depth ?? 0}
  hash: "${shortHash(logRoot?.hash ?? '')}"
  left: KeyTransLogNode
  right: KeyTransLogNode
}
leaf {
  timestamp: "${model.responseView.search.timestamps.find((timestamp) => timestamp.position === model.activePosition)?.timestamp ?? snapshot.publication.timestamp}"
  prefixRoot: "${shortHash(snapshot.prefixTree.root.hash)}"
}`}</pre>
        <pre>{`KeyTransRetainedState
{
  tree_head: { tree_size: ${model.previousState.tree_head.tree_size} }
  full_subtree_heads: [${model.previousState.full_subtree_heads.map((head) => `[${rangeLabel(head)}]`).join(', ')}]
  frontier: [${model.previousState.frontier.map((entry) => `#${entry.start + 1}`).join(', ')}]
}

KeyTransSearchResponse
{
  version: ${model.response.version}
  binary_ladder: [${model.response.binary_ladder.map((step) => step.commitment ? 'proof + commitment' : 'proof').join(', ')}]
  search: {
    prefix_proofs: ${model.response.search.prefix_proofs.length}
  }
}

WalkthroughView
{
  inspections: [${model.responseView.search.inspections.map((inspection) => `position ${inspection.position}`).join(', ')}]
}`}</pre>
      </div>
    </details>
  )
}

function DataStructuresPanel({ model }: { model: KeyTransWalkthroughModel }) {
  const snapshot = model.snapshots[model.activePosition - 1]
  return (
    <section className="kt-structures" aria-labelledby="kt-structures-title">
      <div className="kt-structure-heading">
        <div><span className="mini-label blue-text">Data structures / actual nodes</span><h3 id="kt-structures-title">See what the proof is traversing.</h3></div>
        <p>The protocol objects point into these two trees. Blue marks Bob's retained heads, green marks hashes he recomputes, and the selected prefix path follows the active ladder step.</p>
      </div>
      <div className="kt-structure-grid">
        <article className="kt-structure-card kt-prefix-structure-card">
          <div className="kt-structure-card-heading"><div><span className="mini-label blue-text">directory snapshot / log position {model.activePosition}</span><h4>KeyTransPrefixTree</h4></div><code>{snapshot.records.length} records</code></div>
          <PrefixStructureDiagram model={model} />
          <div className="kt-structure-foot"><span>root</span><code>{shortHash(snapshot.prefixTree.root.hash)}</code><span>active lookup</span><code>Alice v{model.activeVersion}</code></div>
        </article>
        <article className="kt-structure-card kt-log-structure-card">
          <div className="kt-structure-card-heading"><div><span className="mini-label blue-text">append-only history / current head</span><h4>KeyTransLogNode tree</h4></div><code>size {model.currentLogTree.leafHashes.length}</code></div>
          <LogStructureDiagram model={model} />
          <div className="kt-structure-foot"><span>signed root</span><code>{shortHash(model.responseView.treeHeadTbs.root)}</code><span>new leaves</span><code>#6, #7</code></div>
        </article>
      </div>
      <div className="kt-structure-legend" aria-label="Data structure diagram legend">
        <span><i className="kt-structure-swatch retained-swatch" /> retained subtree head</span>
        <span><i className="kt-structure-swatch structured-swatch" /> structured response leaf</span>
        <span><i className="kt-structure-swatch recomputed-swatch" /> recomputed branch</span>
        <span><i className="kt-structure-swatch signed-swatch" /> signed root</span>
        <span><i className="kt-structure-swatch inclusion-swatch" /> selected proof sibling</span>
      </div>
      <StructureShapeInspectors model={model} />
    </section>
  )
}

function StatePanel({ model }: { model: KeyTransWalkthroughModel }) {
  const previous = model.previousState
  return (
    <section className="kt-panel kt-state-panel" aria-labelledby="kt-state-title">
      <div className="kt-panel-heading">
        <span className="kt-panel-number">01</span>
        <div><span className="mini-label blue-text">Client state before the request</span><h3 id="kt-state-title">Bob has a compact view of size 5.</h3></div>
      </div>
      <div className="kt-tree-head-card kt-retained-border">
        <div><span className="mini-label">retained tree head</span><strong>TreeHead</strong></div>
        <code>tree_size: {previous.tree_head.tree_size}</code>
        <code>{shortHash(previous.tree_head_tbs.root)}</code>
      </div>
      <div className="kt-state-section">
        <div className="kt-subheading"><span>full_subtree_heads</span><small>retained hashes</small></div>
        <div className="kt-head-list">
          {previous.full_subtree_heads.map((head) => (
            <div className="kt-head-item kt-retained-item" key={`${head.start}-${head.end}`}>
              <span className="kt-provenance-dot retained-dot" />
              <div><strong>leaves {rangeLabel(head)}</strong><small>balanced head / {head.end - head.start} leaves</small></div>
              <code>{shortHash(head.hash)}</code>
            </div>
          ))}

        </div>
      </div>
      <div className="kt-state-section">
        <div className="kt-subheading"><span>frontier</span><small>retained log entries</small></div>
        <div className="kt-frontier-list">
          {previous.frontier.map((entry) => (
            <div key={`${entry.start}-${entry.end}`}><b>position {entry.start + 1}</b><span>{entry.timestamp}</span><code>{shortHash(entry.hash)}</code></div>
          ))}
        </div>
      </div>
      <p className="kt-panel-note">Bob does not retain the whole log. The full-subtree heads and frontier are enough to anchor a later consistency proof.</p>
    </section>
  )
}

function RequestResponsePanel({ model }: { model: KeyTransWalkthroughModel }) {
  const response = model.response
  const responseTreeHead = response.full_tree_head.head_type === 'updated' ? response.full_tree_head.tree_head : null
  return (
    <section className="kt-panel kt-response-panel" aria-labelledby="kt-response-title">
      <div className="kt-panel-heading">
        <span className="kt-panel-number">02</span>
        <div><span className="mini-label blue-text">Actual request and response</span><h3 id="kt-response-title">The wire objects carry provenance.</h3></div>
      </div>
      <div className="kt-wire-columns">
        <div className="kt-wire-block">
          <div className="kt-wire-label"><span>client sends</span><b>SearchRequest</b></div>
          <pre>{JSON.stringify(model.request, null, 2)}</pre>
          <p><strong>Only the label and prior tree size are needed.</strong> Omitting <code>version</code> asks for the greatest version.</p>
        </div>
        <div className="kt-wire-block kt-response-wire">
          <div className="kt-wire-label"><span>server returns</span><b>SearchResponse</b></div>
          <div className="kt-wire-fields">
            <div><code>full_tree_head</code><span>{response.full_tree_head.head_type}{responseTreeHead ? ` / size ${responseTreeHead.tree_size}` : ''}</span></div>
            <div><code>version</code><span>{response.version} <em>server supplies for latest</em></span></div>
            <div><code>opening</code><span>{response.opening}</span></div>
            <div><code>value</code><span>{valueSummary(response.value)}</span></div>
            <div><code>binary_ladder</code><span>{response.binary_ladder.length} steps</span></div>
            <div><code>tree_head_tbs (view)</code><span>root {shortHash(model.responseView.treeHeadTbs.root)}</span></div>
            <div><code>walkthrough inspections</code><span>{model.responseView.search.inspections.length} frontier entries</span></div>
            <div><code>search</code><span>CombinedTreeProof bundle</span></div>
          </div>
        </div>
      </div>
      <div className="kt-source-table">
        <div className="kt-source-row kt-source-header"><span>value</span><span>comes from</span><span>why it matters</span></div>
        <div className="kt-source-row"><code>version</code><span className="kt-source-server">SearchResponse</span><small>Bob asked for latest, so the response names v1.</small></div>
        <div className="kt-source-row"><code>opening</code><span className="kt-source-server">SearchResponse</span><small>Needed to recreate the target commitment.</small></div>
        <div className="kt-source-row"><code>UpdateValue.value</code><span className="kt-source-server">SearchResponse</span><small>The public key Bob will consume.</small></div>
        <div className="kt-source-row"><code>Kc</code><span className="kt-source-fixed">cipher suite</span><small>Fixed configuration, not sent in this response.</small></div>
        <div className="kt-source-row"><code>target commitment</code><span className="kt-source-client">client recomputes</span><small><code>HMAC(Kc, CommitmentValue)</code></small></div>
        <div className="kt-source-row"><code>auxiliary commitments</code><span className="kt-source-server">BinaryLadderStep</span><small>Sent for existing non-target versions; omitted for absent versions.</small></div>
      </div>
      <details className="kt-detail-fold">
        <summary>Show the commitment recipe</summary>
        <div className="kt-recipe-grid">
          <code>CommitmentValue = encode(opening, label, version, UpdateValue)</code>
          <code>commitment = HMAC(Kc, CommitmentValue)</code>
        </div>
        <p>This model uses deterministic SHA-256 field hashing as a stand-in for HMAC and the wire encoder. The object boundaries and who supplies each input follow the draft.</p>
      </details>
    </section>
  )
}

function PrefixInspector({ model }: { model: KeyTransWalkthroughModel }) {
  const step = model.activeLadderStep
  const result = model.activePrefixResult
  const targetSnapshot = model.snapshots[model.activePosition - 1]
  return (
    <details className="kt-prefix-inspector" open>
      <summary>Inspect position {model.activePosition}'s prefix proof for Alice v{step.version}</summary>
      <div className="kt-address-card">
        <div><span>Alice, key version {step.version}</span><strong>verified addressing</strong></div>
        <b aria-label={`Tree address ${step.address}`}>{shortAddress(step.address)}</b>
        <code>{step.address}</code>
      </div>
      <p className="kt-address-copy">The service converts <code>(label, key version)</code> into an unpredictable tree address and supplies a proof that the address is correct. The client verifies that proof using the log's public configuration.</p>
      <details className="kt-detail-fold kt-vrf-detail">
        <summary>What does "unpredictable" mean here?</summary>
        <p>This fixture uses a full 32-byte deterministic stand-in. In the protocol, the mechanism is a verifiable random function: the output is address-like, and its proof is checked as part of the ladder.</p>
        <code>VRF.proof = {step.proof}</code>
      </details>
      <div className="kt-prefix-result-row"><span>directory snapshot</span><b>log position {model.activePosition} / root {shortHash(targetSnapshot.prefixTree.root.hash)}</b><em className={result?.result === 'inclusion' ? 'is-included' : 'is-absent'}>{result ? resultLabel(result.result === 'inclusion' ? 'inclusion' : 'non-inclusion') : 'not selected'}</em></div>
      <div className="kt-prefix-proof-steps">
        {result?.proof.steps.map((proofStep) => (
          <div key={`${proofStep.depth}-${proofStep.siblingHash}`}>
            <span>depth {proofStep.depth}</span>
            <b>{proofStep.currentIsLeft ? 'address bit 0' : 'address bit 1'}</b>
            <code>sibling {shortHash(proofStep.siblingHash)}</code>
          </div>
        ))}
      </div>
      <div className="kt-directory-records">
        <div className="kt-subheading"><span>one logical prefix tree</span><small>current snapshot records</small></div>
        {targetSnapshot.records.map((record) => (
          <div className={`kt-directory-record ${record.label === 'acct:alice' ? 'is-alice' : ''}`} key={`${record.label}-${record.version}`}>
            <span>{record.label}, key version {record.version}</span>
            <code>{shortAddress(record.address ?? '')}</code>
            <small>{shortHash(record.commitment)}</small>
          </div>
        ))}
      </div>
    </details>
  )
}

function LadderStep({ model, version }: { model: KeyTransWalkthroughModel; version: number }) {
  const step = model.activeSearchInspection.binaryLadder.find((candidate) => candidate.version === version)!
  const isActive = model.activeVersion === version
  return (
    <button className={`kt-ladder-step ${isActive ? 'is-active' : ''} ${step.result === 'inclusion' ? 'is-inclusion' : 'is-non-inclusion'}`} type="button" onClick={() => model.setActiveVersion(version)}>
      <span>key version {step.version}</span>
      <strong>{resultLabel(step.result)}</strong>
      <code>{shortAddress(step.address)}</code>
      <small>{step.commitment ? 'commitment supplied' : step.version === model.response.version && model.activePosition === 6 ? 'returned target recomputed' : step.version === model.response.version ? 'target version checked' : 'no commitment'}</small>
    </button>
  )
}

function TranscriptPanel({ model }: { model: KeyTransWalkthroughModel }) {
  const viewUpdates = model.transcript.filter((entry) => entry.role === 'view-update')
  const searchEntries = model.transcript.filter((entry) => entry.role === 'search')
  return (
    <section className="kt-panel kt-transcript-panel" aria-labelledby="kt-transcript-title">
      <div className="kt-panel-heading">
        <span className="kt-panel-number">03</span>
        <div><span className="mini-label blue-text">Search transcript</span><h3 id="kt-transcript-title">The algorithm decides what gets inspected.</h3></div>
      </div>
      <div className="kt-transcript-block">
        <div className="kt-subheading"><span>view update / last = 5 to size = 7</span><small>timestamps before search</small></div>
        {viewUpdates.map((entry) => (
          <div className="kt-transcript-row kt-update-row" key={`${entry.role}-${entry.position}`}>
            <span className="kt-transcript-marker">{entry.position}</span>
            <div><strong>{entry.title}</strong><p>{entry.detail}</p></div>
            <code>{model.responseView.search.timestamps.find((timestamp) => timestamp.position === entry.position)?.timestamp}</code>
          </div>
        ))}
      </div>
      <div className="kt-transcript-block">
        <div className="kt-subheading"><span>greatest-version search</span><small>implicit binary search tree</small></div>
        {searchEntries.map((entry) => (
          <button className={`kt-transcript-row kt-search-row ${entry.position === model.activePosition ? 'is-current' : ''}`} type="button" key={`${entry.role}-${entry.position}`} onClick={() => { model.setActivePosition(entry.position); model.setActiveVersion(entry.position === 4 ? 0 : 1) }}>
            <span className="kt-transcript-marker">{entry.position}</span>
            <div><strong>{entry.title}</strong><p>{entry.detail}</p></div>
            <b className="kt-transcript-direction">{entry.direction === 'right' ? 'move right ->' : 'stop'}</b>
          </button>
        ))}
      </div>
      <div className="kt-ladder-heading"><span className="mini-label blue-text">search ladder / position {model.activePosition}</span><strong>Click a lookup to inspect its address and path.</strong></div>
      <div className="kt-ladder-list" aria-label="Binary ladder steps">
        {model.activeSearchInspection.binaryLadder.map((step) => <LadderStep key={step.version} model={model} version={step.version} />)}
      </div>
      <p className="kt-panel-note">A single inclusion proves one pair in one directory snapshot. Position 6 finds Alice v1 first, but position 7 is still inspected because only the rightmost ladder can rule out a later version.</p>
      <PrefixInspector model={model} />
    </section>
  )
}

function ProvenanceLegend() {
  return (
    <div className="kt-provenance-legend" aria-label="Root reconstruction provenance">
      <span><i className="kt-legend-swatch retained-swatch" /> retained by Bob</span>
      <span><i className="kt-legend-swatch inclusion-swatch" /> InclusionProof.elements</span>
      <span><i className="kt-legend-swatch structured-swatch" /> structured response leaf</span>
      <span><i className="kt-legend-swatch recomputed-swatch" /> recomputed by Bob</span>
      <span><i className="kt-legend-swatch signed-swatch" /> signed tree-head root</span>
    </div>
  )
}

function ReconstructionNode({ node, provenance }: { node: KeyTransLogNode; provenance: 'retained' | 'inclusion' | 'structured' | 'recomputed' | 'signed' }) {
  return (
    <div className={`kt-reconstruction-node ${provenance}-node`}>
      <span>{provenance}</span>
      <strong>leaves {rangeLabel(node)}</strong>
      <code>{shortHash(node.hash)}</code>
    </div>
  )
}

function ReconstructionPanel({ model }: { model: KeyTransWalkthroughModel }) {
  const retained = model.reconstruction.retained
  const structured = model.reconstruction.structured
  const recomputed = model.reconstruction.recomputed
  const suppliedHeads = model.responseView.search.inclusion.elements
  return (
    <section className="kt-panel kt-reconstruction-panel" aria-labelledby="kt-reconstruction-title">
      <div className="kt-panel-heading">
        <span className="kt-panel-number">04</span>
        <div><span className="mini-label blue-text">Root reconstruction</span><h3 id="kt-reconstruction-title">Bob verifies the head, then updates state.</h3></div>
      </div>
      <ProvenanceLegend />
      <div className="kt-reconstruction-lanes">
        <div className="kt-reconstruction-lane">
          <div className="kt-subheading"><span>inputs</span><small>already known or supplied</small></div>
          <div className="kt-reconstruction-row">
            {retained.map((node) => <ReconstructionNode key={`retained-${node.start}-${node.end}`} node={node} provenance="retained" />)}
            {suppliedHeads.length > 0 ? suppliedHeads.map((node) => <ReconstructionNode key={`inclusion-${node.start}-${node.end}`} node={node} provenance="inclusion" />) : <div className="kt-empty-inclusion"><span>InclusionProof.elements</span><strong>none required here</strong><small>Bob's retained heads plus the inspected leaves are sufficient.</small></div>}
            {structured.map((entry) => <ReconstructionNode key={`structured-${entry.position}`} node={entry.node} provenance="structured" />)}
          </div>
        </div>
        <div className="kt-reconstruction-lane">
          <div className="kt-subheading"><span>verifier computations</span><small>hashes Bob derives</small></div>
          <div className="kt-reconstruction-row">
            {recomputed.map((node) => <ReconstructionNode key={`recomputed-${node.start}-${node.end}`} node={node} provenance="recomputed" />)}
            <div className="kt-reconstruction-node signed-node">
              <span>candidate root</span>
              <strong>{model.reconstruction.matchesTreeHead ? 'matches signature target' : 'mismatch'}</strong>
              <code>{shortHash(model.reconstruction.candidateRoot)}</code>
            </div>
          </div>
        </div>
      </div>
      <div className="kt-balanced-callout">
        <div><span className="mini-label blue-text">Why balanced heads are reusable</span><strong>A non-balanced three-leaf copath is never sent as one arbitrary hash.</strong></div>
        <div className="kt-balanced-example">
          <span className="kt-nonbalanced-range">source leaves {rangeLabel(model.balancedHeadExample.source)}</span>
          <b>-&gt;</b>
          {model.balancedHeadExample.heads.map((head) => <span className="kt-example-head" key={`${head.start}-${head.end}`}>balanced {rangeLabel(head)}<small>{head.end - head.start} leaves</small></span>)}
        </div>
        <p>Those heads are the minimum reusable units. In this exact response, the orange inclusion lane is empty because Bob already has the left size-4 head and the new inspected leaves let him recompute the size-2 head.</p>
      </div>
      <div className="kt-verification-result">
        <div><span className="mini-label">signed tree head</span><strong>{model.reconstruction.matchesTreeHead ? 'candidate root matches' : 'candidate root mismatch'}</strong><code>signature: {shortHash(responseTreeHeadSignature(model))}</code></div>
        <button className="kt-commit-button" type="button" onClick={model.commitState} disabled={model.stateCommitted}>{model.stateCommitted ? 'size 7 state committed' : 'Apply verified state ->'}</button>
      </div>
      <div className="kt-check-list" aria-label="Client verification checks">
        <span className={model.verification.vrfProofsVerified ? 'is-pass' : 'is-fail'}>VRF proofs checked</span>
        <span className={model.verification.prefixProofsVerified ? 'is-pass' : 'is-fail'}>prefix roots reconstructed</span>
        <span className={model.verification.targetCommitmentMatches ? 'is-pass' : 'is-fail'}>target commitment matches</span>
        <span className={model.verification.timestampsMonotonic ? 'is-pass' : 'is-fail'}>timestamps monotonic</span>
        <span className={model.verification.logRootMatches ? 'is-pass' : 'is-fail'}>log root reconstructed</span>
        <span className={model.verification.treeHeadSignatureVerified ? 'is-pass' : 'is-fail'}>tree-head signature checked</span>
      </div>
      {model.stateCommitted && (
        <div className="kt-next-state">
          <span className="mini-label blue-text">new retained state</span>
          <strong>TreeHead.tree_size = {model.nextState.tree_head.tree_size}</strong>
          <div>{model.nextState.full_subtree_heads.map((head) => <code key={`${head.start}-${head.end}`}>H[{rangeLabel(head)}] {shortHash(head.hash)}</code>)}</div>
        </div>
      )}
    </section>
  )
}

function CombinedTreeBundle({ model }: { model: KeyTransWalkthroughModel }) {
  const proof = model.response.search
  const walkthroughProof = model.responseView.search
  return (
    <section className="kt-bundle-strip" aria-labelledby="kt-bundle-title">
      <div className="kt-bundle-heading"><span className="mini-label blue-text">The response is a bundle, not a chain</span><h3 id="kt-bundle-title">CombinedTreeProof</h3><p>The search algorithm consumes these arrays in its expected order. They are deduplicated across view update and search.</p></div>
      <div className="kt-bundle-grid">
        <div><code>timestamps</code><strong>{proof.timestamps.length}</strong><span>new path and frontier times</span></div>
        <div><code>prefix_proofs</code><strong>{proof.prefix_proofs.length}</strong><span>binary ladders for inspected entries</span></div>
        <div><code>prefix_roots</code><strong>{proof.prefix_roots.length}</strong><span>explicit roots without a lookup</span></div>
        <div><code>walkthrough inspections</code><strong>{walkthroughProof.inspections.length}</strong><span>position-aware ladders</span></div>
        <div><code>inclusion.elements</code><strong>{proof.inclusion.elements.length}</strong><span>new balanced heads required</span></div>
      </div>
    </section>
  )
}

export function KeyTransparencyPage({ onNavigate }: KeyTransparencyPageProps) {
  const model = useKeyTransWalkthrough()
  return (
    <div className="app-shell kt-walkthrough-shell">
      <PageHeader onNavigate={onNavigate} onReset={model.reset} />
      <main className="kt-walkthrough-main">
        <StoryIntro model={model} />
        <VocabularyStrip />
        <DataStructuresPanel model={model} />
        <div className="kt-panels">
          <StatePanel model={model} />
          <RequestResponsePanel model={model} />
          <TranscriptPanel model={model} />
          <ReconstructionPanel model={model} />
        </div>
        <CombinedTreeBundle model={model} />
        <section className="kt-closing-note">
          <span className="mini-label blue-text">What Bob now knows</span>
          <p>Alice v1 is the first entry containing the returned key at log position 6. The search still inspects rightmost position 7, whose ladder rules out Alice v2 and any later version. The size-7 log view matches the signed tree head, so Bob can retain its full subtrees and frontier.</p>
        </section>
      </main>
      <footer className="footer"><span>MERKLE / PROTOCOL LAB</span><span>draft-shaped client walkthrough</span><span>deterministic primitive stand-ins</span></footer>
    </div>
  )
}