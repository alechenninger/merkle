import { useEffect, useRef } from 'react'
import { DiagramTooltipOverlay } from '../../components/DiagramTooltip'
import { InfoTip } from '../../components/InfoTip'
import { centerSelectedTreeNode } from '../../components/TreeDiagram'
import { keyTransLogNodeTooltip, keyTransPrefixNodeTooltip } from '../../components/nodeTooltips'
import { useDiagramTooltip } from '../../components/useDiagramTooltip'
import {
  collectKeyTransLogEdges,
  collectKeyTransLogNodes,
  collectKeyTransPrefixEdges,
  collectKeyTransPrefixNodes,
  keyTransPrefixTreeHeight,
} from '../../domain/keytrans'
import type { KeyTransPrefixBranch, KeyTransPrefixNode } from '../../domain/types'
import { diagramNodeX, diagramWidth, shortHash } from '../../utils/format'
import type { KeyTransDemoModel } from './useKeyTransDemo'

type KeyTransSectionProps = {
  model: KeyTransDemoModel
}

function proofResultLabel(result: KeyTransDemoModel['view']['prefixProof']['result']) {
  if (result === 'inclusion') {
    return 'included'
  }
  if (result === 'nonInclusionLeaf') {
    return 'stopped at a different leaf'
  }
  return 'stopped at an absent child'
}

function prefixProofExplanation(result: KeyTransDemoModel['view']['prefixProof']['result']) {
  if (result === 'inclusion') {
    return 'The leaf proves this label-version commitment was present in the selected directory snapshot.'
  }
  if (result === 'nonInclusionLeaf') {
    return 'The route proves this label-version was absent by ending at a different leaf. That proof discloses the terminal leaf\'s opaque VRF output and commitment, but not the value opened by that commitment.'
  }
  return 'The route proves this label-version was absent because the required child does not exist. No terminal leaf commitment is disclosed.'
}

export function KeyTransSection({ model }: KeyTransSectionProps) {
  const {
    labels,
    versions,
    selectedLabel,
    selectedVersion,
    selectedSnapshotIndex,
    view,
    isPrefixVerified,
    isLogVerified,
    prefixProofHashes,
    logProofNodeKeys,
    selectLabel,
    setSelectedVersion,
    setSelectedSnapshotIndex,
    publishRotation,
  } = model
  const { tooltip, show, hide } = useDiagramTooltip()
  const prefixFrameRef = useRef<HTMLDivElement>(null)
  const logFrameRef = useRef<HTMLDivElement>(null)
  const prefixNodes = collectKeyTransPrefixNodes(view.snapshot.prefixTree.root)
  const prefixLeaves = prefixNodes.filter((node) => node.type === 'leaf')
  const prefixNodePositions = new Map<string, number>()
  let nextLeafPosition = 0

  const assignPrefixPosition = (node: KeyTransPrefixNode): number => {
    if (node.type === 'leaf') {
      const position = nextLeafPosition
      nextLeafPosition += 1
      prefixNodePositions.set(node.hash, position)
      return position
    }
    const positions = [node.left, node.right]
      .filter((child): child is KeyTransPrefixNode => Boolean(child))
      .map(assignPrefixPosition)
    const position = positions.reduce((total, childPosition) => total + childPosition, 0) / Math.max(positions.length, 1)
    prefixNodePositions.set(node.hash, position)
    return position
  }

  assignPrefixPosition(view.snapshot.prefixTree.root)
  const prefixLeafCount = Math.max(prefixLeaves.length, 1)
  const prefixSvgWidth = diagramWidth(Math.max(prefixLeafCount, 4))
  const prefixNodeX = (node: KeyTransPrefixNode) => ((prefixNodePositions.get(node.hash) ?? 0) + 0.5) / prefixLeafCount * prefixSvgWidth
  const prefixNodeY = (node: KeyTransPrefixNode) => 30 + node.depth * 42
  const prefixSvgHeight = Math.max(250, (keyTransPrefixTreeHeight(view.snapshot.prefixTree.root) + 2) * 42)
  const prefixPathHashes = new Set<string>()
  let prefixCursor: KeyTransPrefixNode = view.snapshot.prefixTree.root

  while (prefixCursor.type === 'branch') {
    const branch: KeyTransPrefixBranch = prefixCursor
    prefixPathHashes.add(branch.hash)
    const child = view.prefixProof.searchKey[branch.depth] === '0' ? branch.left : branch.right
    if (!child) {
      break
    }
    prefixCursor = child
  }
  if (prefixCursor.type === 'leaf') {
    prefixPathHashes.add(prefixCursor.hash)
  }

  const logTree = view.logTree.root
  const logNodes = logTree ? collectKeyTransLogNodes(logTree) : []
  const logSvgWidth = diagramWidth(view.snapshots.length)
  const logNodeX = (node: typeof logNodes[number]) => diagramNodeX(node.start, node.end, view.snapshots.length, logSvgWidth)
  const logNodeY = (node: typeof logNodes[number]) => 36 + node.depth * 58
  const logSvgHeight = Math.max(240, (Math.max(...logNodes.map((node) => node.depth), 0) + 2) * 58)

  useEffect(() => {
    centerSelectedTreeNode(prefixFrameRef.current, '.kt-prefix-node.is-path')
    centerSelectedTreeNode(logFrameRef.current, '.kt-log-node.is-path.is-leaf')
  }, [selectedLabel, selectedSnapshotIndex, selectedVersion])

  return (
    <section className="structure-section keytrans-section" aria-labelledby="keytrans-title">
      <div className="section-heading">
        <div className="section-number blue">03</div>
        <div>
          <span className="section-kicker blue-text">Key distribution / combined transparency tree</span>
          <h2 id="keytrans-title">Key Transparency</h2>
          <p>A prefix directory proves a label-version lookup. A separate append-only log makes each published directory root auditable over time.</p>
        </div>
        <div className="section-tag blue-tag">prefix tree + log tree</div>
      </div>

      <div className="keytrans-layout">
        <aside className="control-rail keytrans-rail" aria-label="Key Transparency controls">
          <div className="rail-title-row">
            <div>
              <span className="mini-label blue-text">Directory query</span>
              <strong>{labels.length} labels / {view.snapshots.length} published views</strong>
            </div>
            <span className="rail-accent blue-text">versioned</span>
          </div>
          <div className="keytrans-controls">
            <label>
              <span>label</span>
              <select value={selectedLabel} onChange={(event) => selectLabel(event.target.value)}>
                {labels.map((label) => <option value={label} key={label}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>version</span>
              <select value={selectedVersion} onChange={(event) => setSelectedVersion(Number(event.target.value))}>
                {versions.map((version) => <option value={version} key={version}>version {version}</option>)}
              </select>
            </label>
          </div>
          <div className="publication-list" aria-label="Published prefix roots">
            {view.snapshots.map((snapshot, index) => (
              <button
                className={`publication-row ${index === selectedSnapshotIndex ? 'is-selected' : ''}`}
                type="button"
                key={snapshot.publication.id}
                onClick={() => setSelectedSnapshotIndex(index)}
              >
                <span className="publication-number">#{String(index + 1).padStart(2, '0')}</span>
                <span className="publication-copy"><strong>{snapshot.publication.timestamp}</strong><span>{snapshot.publication.updates.length} update{snapshot.publication.updates.length === 1 ? '' : 's'}</span></span>
                <span className="publication-root">{shortHash(snapshot.prefixTree.root.hash)}</span>
              </button>
            ))}
          </div>
          <button className="keytrans-publish-button" type="button" onClick={publishRotation}>
            <span>+</span> Publish key rotation
          </button>
          <div className="rail-note keytrans-note">
            <span className="note-mark">i</span>
            <p>A publication may batch many label-version changes. Only its new prefix root enters the chronological log.</p>
          </div>
        </aside>

        <div className="visual-stage keytrans-stage">
          <div className="stage-header">
            <div>
              <span className="mini-label blue-text">Signed tree-head target / {view.treeHead.treeSize} publications</span>
              <InfoTip details={logTree ? keyTransLogNodeTooltip(logTree, true, false, true) : undefined} focusable className="hash-tip">
                <strong className="root-hash blue-root">{shortHash(view.treeHead.root)}</strong>
              </InfoTip>
            </div>
            <div className="verification-state blue-state"><span /> log root {isLogVerified ? 'reconstructed' : 'mismatch'}</div>
          </div>

          <section className="keytrans-tree-band" aria-labelledby="prefix-title">
            <div className="keytrans-band-heading">
              <div>
                <span className="mini-label blue-text">1 / keyed directory lookup</span>
                <h3 id="prefix-title">Prefix tree at publication #{view.snapshotIndex + 1}</h3>
              </div>
              <span className={`verified-badge blue-badge ${isPrefixVerified ? '' : 'is-unverified'}`}><span /> {proofResultLabel(view.prefixProof.result)}</span>
            </div>
            <div className="diagram-legend blue-legend" aria-label="Key Transparency prefix tree diagram legend">
              <InfoTip text="The route selected by the demo VRF-derived search key." below><span><i className="legend-swatch legend-path" /> lookup path</span></InfoTip>
              <InfoTip text="A supplied sibling digest, or the known all-zero stand-in for a missing child." below><span><i className="legend-swatch legend-proof" /> proof sibling</span></InfoTip>
              <InfoTip text="A leaf binds one opaque search key to a commitment for one label-version value." below><span><i className="legend-swatch legend-leaf" /> commitment leaf</span></InfoTip>
              <InfoTip text="The root of this directory snapshot; the same root appears in the selected log leaf below." below><span><i className="legend-swatch legend-root" /> prefix root</span></InfoTip>
            </div>
            <div className="tree-frame keytrans-prefix-frame" ref={prefixFrameRef} onScroll={hide}>
              <svg className="tree-svg keytrans-prefix-svg" width={prefixSvgWidth} height={prefixSvgHeight} viewBox={`0 0 ${prefixSvgWidth} ${prefixSvgHeight}`} aria-hidden="true" focusable="false">
                {collectKeyTransPrefixEdges(view.snapshot.prefixTree.root).map(({ parent, child }) => (
                  <line
                    className={`tree-edge ${prefixPathHashes.has(child.hash) ? 'is-path' : ''} ${prefixProofHashes.has(child.hash) ? 'is-proof-edge' : ''}`}
                    key={`${parent.hash}-${child.hash}`}
                    x1={prefixNodeX(parent)}
                    y1={prefixNodeY(parent)}
                    x2={prefixNodeX(child)}
                    y2={prefixNodeY(child)}
                  />
                ))}
                {prefixNodes.map((node) => {
                  const leaf = node.type === 'leaf'
                  const pathNode = prefixPathHashes.has(node.hash)
                  const proofNode = prefixProofHashes.has(node.hash)
                  return (
                    <g
                      className={`kt-prefix-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${leaf ? 'is-leaf' : ''} ${node === view.snapshot.prefixTree.root ? 'is-root' : ''}`}
                      key={node.hash}
                      onMouseEnter={(event) => show(event, keyTransPrefixNodeTooltip(node, pathNode, proofNode, node === view.snapshot.prefixTree.root), 'keytrans-prefix')}
                      onMouseLeave={hide}
                    >
                      <rect x={prefixNodeX(node) - (leaf ? 45 : 36)} y={prefixNodeY(node) - 16} width={leaf ? 90 : 72} height="32" rx="4" />
                      <text className="node-hash" x={prefixNodeX(node)} y={prefixNodeY(node)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
                      {leaf && <text className="node-key" x={prefixNodeX(node)} y={prefixNodeY(node) + 27} textAnchor="middle">{node.record.label.replace('acct:', '')} v{node.record.version}</text>}
                    </g>
                  )
                })}
              </svg>
              <DiagramTooltipOverlay tooltip={tooltip} owner="keytrans-prefix" />
            </div>
            <div className="keytrans-proof-summary">
              <div><span>query</span><b>{selectedLabel} / v{selectedVersion}</b></div>
              <div><span>demo VRF output</span><b>{view.prefixProof.searchKey}</b></div>
              <div><span>prefix root</span><b>{shortHash(view.prefixProof.reconstructedRoot)}</b></div>
              <div><span>verification</span><b>{isPrefixVerified ? 'matches snapshot' : 'mismatch'}</b></div>
            </div>
            <p className="keytrans-explanation">{prefixProofExplanation(view.prefixProof.result)} In the protocol, a VRF provides the opaque search key and an HMAC commitment hides the value until opened.</p>
          </section>

          <section className="keytrans-tree-band keytrans-log-band" aria-labelledby="publication-log-title">
            <div className="keytrans-band-heading">
              <div>
                <span className="mini-label blue-text">2 / append-only publication history</span>
                <h3 id="publication-log-title">Log of prefix roots</h3>
              </div>
              <span className="verified-badge blue-badge"><span /> root matches</span>
            </div>
            <div className="tree-frame keytrans-log-frame" ref={logFrameRef} onScroll={hide}>
              {logTree && (
                <svg className="tree-svg keytrans-log-svg" width={logSvgWidth} height={logSvgHeight} viewBox={`0 0 ${logSvgWidth} ${logSvgHeight}`} aria-hidden="true" focusable="false">
                  {collectKeyTransLogEdges(logTree).map(({ parent, child }) => {
                    const pathNode = child.start <= view.snapshotIndex && view.snapshotIndex < child.end
                    const proofNode = logProofNodeKeys.has(`${child.start}-${child.end}`)
                    return <line className={`tree-edge ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof-edge' : ''}`} key={`${parent.start}-${parent.end}-${child.start}-${child.end}`} x1={logNodeX(parent)} y1={logNodeY(parent)} x2={logNodeX(child)} y2={logNodeY(child)} />
                  })}
                  {logNodes.map((node) => {
                    const leaf = !node.left
                    const pathNode = node.start <= view.snapshotIndex && view.snapshotIndex < node.end
                    const proofNode = logProofNodeKeys.has(`${node.start}-${node.end}`)
                    return (
                      <g
                        className={`kt-log-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${leaf ? 'is-leaf' : ''} ${node === logTree ? 'is-root' : ''}`}
                        key={`${node.start}-${node.end}`}
                        onMouseEnter={(event) => show(event, keyTransLogNodeTooltip(node, pathNode, proofNode, node === logTree), 'keytrans-log')}
                        onMouseLeave={hide}
                      >
                        <rect x={logNodeX(node) - (leaf ? 45 : 36)} y={logNodeY(node) - 16} width={leaf ? 90 : 72} height="32" rx="4" />
                        <text className="node-hash" x={logNodeX(node)} y={logNodeY(node)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
                        {leaf && <text className="node-key" x={logNodeX(node)} y={logNodeY(node) + 27} textAnchor="middle">#{node.start + 1} / {node.timestamp}</text>}
                      </g>
                    )
                  })}
                </svg>
              )}
              <DiagramTooltipOverlay tooltip={tooltip} owner="keytrans-log" />
            </div>
            <div className="keytrans-proof-flow" aria-label="Raw combined-tree membership proof flow">
              <div><span>membership query</span><b>{selectedLabel} / v{selectedVersion}</b></div>
              <i aria-hidden="true">-&gt;</i>
              <div><span>prefix membership</span><b>{proofResultLabel(view.prefixProof.result)}</b></div>
              <i aria-hidden="true">-&gt;</i>
              <div><span>published root</span><b>{shortHash(view.snapshot.prefixTree.root.hash)}</b></div>
              <i aria-hidden="true">-&gt;</i>
              <div><span>log inclusion</span><b>{shortHash(view.reconstructedLogRoot)}</b></div>
              <i aria-hidden="true">-&gt;</i>
              <div><span>tree head</span><b>{shortHash(view.treeHead.root)}</b></div>
            </div>
            <div className="keytrans-log-proof-elements" aria-label="Key Transparency log inclusion proof elements">
              <span className="mini-label blue-text">KT inclusion elements / balanced-subtree heads</span>
              <div className="keytrans-log-proof-heads">
                {view.logProofElements.map((head) => (
                  <span className="keytrans-log-proof-head" key={`${head.start}-${head.end}`}>
                    {head.start + 1}-{head.end} / {shortHash(head.hash)}
                  </span>
                ))}
              </div>
            </div>
            <p className="keytrans-explanation"><strong>Raw combined-tree membership, not draft-05 Search.</strong> The selected log leaf hashes the publication timestamp with this exact prefix root. The log proof supplies only balanced-subtree heads; a non-balanced copath is reconstructed from its smallest left-to-right set of heads before the root is checked against the tree head. A real client also verifies that head’s signature and consistency with its previously retained state. Draft-05 Search instead traverses log entries with binary ladders to establish the greatest version or locate a fixed version.</p>
          </section>

          <details className="recipe-strip keytrans-recipe">
            <summary className="recipe-heading"><span className="mini-label blue-text">What this model simplifies</span><span>real protocol primitives</span></summary>
            <div className="recipe-grid">
              <div className="recipe-step"><b>1</b><span>private index</span><code>draft: VRF(label, version) -&gt; opaque search key</code></div>
              <div className="recipe-step"><b>2</b><span>selective disclosure</span><code>draft: HMAC(Kc, CommitmentValue) -&gt; commitment<br />CommitmentValue = TLS struct &#123; opening, label, version, UpdateValue &#125;</code></div>
              <div className="recipe-step"><b>3</b><span>consistent view</span><code>draft: signed tree head + previous state + monitoring</code></div>
            </div>
            <p className="recipe-note">This browser model uses deterministic SHA-256 stand-ins to make the structure inspectable. It does not produce wire-compatible VRFs, commitments, signatures, or protocol proofs, and it does not implement draft-05 binary ladders or Search traversal.</p>
          </details>

          <div className="keytrans-compare" aria-label="Merkle structure comparison">
            <div className="keytrans-compare-heading"><span className="mini-label blue-text">Why two trees?</span><strong>One structure cannot efficiently provide both keyed lookup and append-only history.</strong></div>
            <article><span>SPARSE MERKLE TREE</span><b>Keyed state</b><p>Proves a current value or absence at one fixed root.</p></article>
            <article><span>MERKLE LOG</span><b>Ordered history</b><p>Proves an event belongs to an append-only sequence.</p></article>
            <article><span>KEY TRANSPARENCY</span><b>Versioned directory + history</b><p>Proves a private lookup inside a published directory root, then commits that root to history.</p></article>
          </div>

          <div className="keytrans-study-strip">
            <span className="mini-label blue-text">Protocol checks beyond a Merkle proof</span>
            <p>Clients retain prior tree state, check monotonic timestamps, monitor labels for unexpected versions, and compare common distinguished heads to expose forks. Study <a href="https://www.ietf.org/archive/id/draft-ietf-keytrans-protocol-05.html#section-3">tree construction</a>, <a href="https://www.ietf.org/archive/id/draft-ietf-keytrans-protocol-05.html#section-4">view updates</a>, <a href="https://www.ietf.org/archive/id/draft-ietf-keytrans-protocol-05.html#section-8">monitoring</a>, <a href="https://www.ietf.org/archive/id/draft-ietf-keytrans-protocol-05.html#section-10">fork detection</a>, and <a href="https://www.ietf.org/archive/id/draft-ietf-keytrans-protocol-05.html#section-16">security considerations</a>.</p>
          </div>
        </div>
      </div>
    </section>
  )
}