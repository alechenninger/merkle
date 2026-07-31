import { useEffect, useRef } from 'react'
import { SHA256_BYTES } from '../../domain/hash'
import { centerSelectedTreeNode } from '../../components/TreeDiagram'
import { DiagramTooltipOverlay } from '../../components/DiagramTooltip'
import { InfoTip } from '../../components/InfoTip'
import { sparseNodeTooltip } from '../../components/nodeTooltips'
import { useDiagramTooltip } from '../../components/useDiagramTooltip'
import { formatByteCount, shortHash, shortKey, valueSummary, diagramNodeX, diagramWidth } from '../../utils/format'
import type { SparseDemoModel } from './useSparseDemo'

type SparseSectionProps = {
  model: SparseDemoModel
}

export function SparseSection({ model }: SparseSectionProps) {
  const {
    entries,
    depth,
    selectedKey,
    tree,
    proof,
    proofSize,
    collisionEntryIds,
    incompleteEntryIds,
    activeCount,
    occupiedPathCount,
    errorMessage,
    isVerifiable,
    minDepth,
    maxDepth,
    updateEntry,
    updateDepth,
    addEntry,
    removeEntry,
    setSelectedKey,
  } = model
  const { tooltip, show, hide } = useDiagramTooltip()
  const treeFrameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    centerSelectedTreeNode(treeFrameRef.current, '.sparse-node.is-path.is-leaf')
  }, [depth, proof.path])

  const svgWidth = diagramWidth(tree.leaves.length)
  const svgHeight = 40 + (tree.depth + 1) * 70
  const nodeX = (level: number, index: number) => {
    const leavesPerNode = 2 ** level
    return diagramNodeX(index * leavesPerNode, (index + 1) * leavesPerNode, tree.leaves.length, svgWidth)
  }
  const nodeY = (level: number) => 30 + (tree.depth - level) * 70
  const selectedIndex = proof.index
  const isPathNode = (level: number, index: number) => index === (selectedIndex >> level)
  const isProofNode = (level: number, index: number) => level < tree.depth && index === ((selectedIndex >> level) ^ 1)

  return (
    <section className="structure-section sparse-section" aria-labelledby="sparse-title">
      <div className="section-heading">
        <div className="section-number">01</div>
        <div>
          <span className="section-kicker">Keyed state / sparse commitment</span>
          <h2 id="sparse-title">Sparse Merkle tree</h2>
          <p>Prove a value, or prove that a key is empty, without sending the entire state map.</p>
        </div>
        <div className="section-tag">hashed path / {depth}-bit demo</div>
      </div>

      <div className="sparse-layout">
        <aside className="control-rail" aria-label="Sparse state controls">
          <div className="rail-title-row">
            <div>
              <span className="mini-label">State map</span>
              <strong>{activeCount} / {2 ** depth} demo slots populated</strong>
            </div>
            <span className="rail-accent">editable</span>
          </div>
          <label className="depth-control">
            <span>Path bits</span>
            <select aria-label="Sparse path bits" value={depth} onChange={(event) => updateDepth(event.target.value)}>
              {Array.from({ length: maxDepth - minDepth + 1 }, (_, index) => minDepth + index).map((optionDepth) => (
                <option key={optionDepth} value={optionDepth}>{optionDepth} bits / {2 ** optionDepth} leaves</option>
              ))}
            </select>
          </label>
          <div className="state-list">
            {entries.map((entry, index) => {
              const isCollision = collisionEntryIds.has(entry.id)
              const isIncomplete = incompleteEntryIds.has(entry.id)
              return (
                <div className={`state-row ${entry.key.trim() === selectedKey ? 'is-selected' : ''} ${isCollision ? 'is-collision' : ''} ${isIncomplete ? 'is-incomplete' : ''}`} key={entry.id}>
                  <div className="state-row-header">
                    <button
                      className="state-select"
                      type="button"
                      aria-label={`Inspect state ${entry.key || 'unassigned'}`}
                      onClick={() => setSelectedKey(entry.key.trim())}
                    >
                      <span className="state-dot" />
                    </button>
                    <span className="state-row-id">{entry.id}</span>
                    <InfoTip text="Include this state in the tree." className="switch-tip">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          aria-label={`Include state ${entry.key || 'unassigned'}`}
                          onChange={(event) => {
                            model.setSelectedKey(entry.key.trim())
                            model.toggleEntry(index, event.target.checked)
                          }}
                        />
                        <span />
                      </label>
                    </InfoTip>
                    <button className="remove-button" type="button" aria-label={`Remove state ${entry.key || 'unassigned'}`} onClick={() => removeEntry(index)}>
                      x
                    </button>
                  </div>
                  <div className="state-fields">
                    <label>
                      <span>key</span>
                      <input
                        value={entry.key}
                        placeholder="account id"
                        aria-label="State key"
                        aria-invalid={isCollision || isIncomplete}
                        onChange={(event) => updateEntry(index, 'key', event.target.value)}
                        onFocus={() => setSelectedKey(entry.key.trim())}
                      />
                    </label>
                    <label>
                      <span>value</span>
                      <input
                        value={entry.value}
                        aria-label="State value"
                        aria-invalid={isCollision || isIncomplete}
                        onChange={(event) => updateEntry(index, 'value', event.target.value)}
                        onFocus={() => setSelectedKey(entry.key.trim())}
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
          <button className="add-button" type="button" onClick={addEntry} disabled={entries.length >= 8 || occupiedPathCount >= 2 ** depth}>
            <span>+</span> Add state
          </button>
          {errorMessage && <div className="rail-error" id="sparse-validation-message" role="alert"><span>!</span><p>{errorMessage}</p></div>}
          <div className="rail-note">
            <span className="note-mark">i</span>
            <p>Empty leaves resolve to a known default hash. This {depth}-bit teaching tree has {2 ** depth} possible paths.</p>
          </div>
        </aside>

        <div className="visual-stage">
          <div className="stage-header">
            <div>
              <span className="mini-label">Current root commitment</span>
              <InfoTip details={sparseNodeTooltip(tree.root, true, false, tree.depth)} below className="hash-tip" focusable>
                <strong className="root-hash">{shortHash(tree.root.hash)}</strong>
              </InfoTip>
            </div>
            <div className="verification-state"><span /> path selected: {proof.path}</div>
          </div>
          <div className="diagram-legend" aria-label="Sparse tree diagram legend">
            <InfoTip text="Selected path: the nodes used to reconstruct the requested proof." below><span><i className="legend-swatch legend-path" /> selected path</span></InfoTip>
            <InfoTip text="Proof sibling: a digest supplied to the verifier." below><span><i className="legend-swatch legend-proof" /> proof sibling</span></InfoTip>
            <InfoTip text="Leaf digest: computed from the derived path, logical key, and raw value." below><span><i className="legend-swatch legend-leaf" /> leaf digest</span></InfoTip>
            <InfoTip text="Branch digest: computed from two child digests." below><span><i className="legend-swatch legend-digest" /> branch digest</span></InfoTip>
            <InfoTip text="Root commitment: the digest compared with the verifier's result." below><span><i className="legend-swatch legend-root" /> root</span></InfoTip>
          </div>
          <div className="tree-frame sparse-tree-frame" ref={treeFrameRef} onScroll={hide}>
            <svg className="tree-svg sparse-svg" width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} aria-hidden="true" focusable="false">
              {tree.levels.slice(1).flatMap((levelNodes) => levelNodes.map((node) => (
                <g key={`edge-${node.level}-${node.index}`}>
                  <line
                    className={`tree-edge ${isPathNode(node.level - 1, node.index * 2) ? 'is-path' : ''}`}
                    x1={nodeX(node.level, node.index)}
                    y1={nodeY(node.level)}
                    x2={nodeX(node.level - 1, node.index * 2)}
                    y2={nodeY(node.level - 1)}
                  />
                  <line
                    className={`tree-edge ${isPathNode(node.level - 1, node.index * 2 + 1) ? 'is-path' : ''}`}
                    x1={nodeX(node.level, node.index)}
                    y1={nodeY(node.level)}
                    x2={nodeX(node.level - 1, node.index * 2 + 1)}
                    y2={nodeY(node.level - 1)}
                  />
                </g>
              )))}
              {tree.levels.flatMap((levelNodes) => levelNodes.map((node) => {
                const pathNode = isPathNode(node.level, node.index)
                const proofNode = isProofNode(node.level, node.index)
                const leaf = node.level === 0
                const nodeTooltip = sparseNodeTooltip(node, pathNode, proofNode, tree.depth)
                return (
                  <g
                    key={`node-${node.level}-${node.index}`}
                    className={`sparse-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${leaf ? 'is-leaf' : ''} ${node.level === tree.depth ? 'is-root' : ''} ${leaf && node.active ? 'is-active' : ''}`}
                    onMouseEnter={(event) => show(event, nodeTooltip, 'sparse')}
                    onMouseLeave={hide}
                    onClick={() => leaf && node.key && setSelectedKey(node.key)}
                  >
                    <rect x={nodeX(node.level, node.index) - (leaf ? 38 : 36)} y={nodeY(node.level) - 17} width={leaf ? 76 : 72} height="34" rx="5" />
                    <text className="node-hash" x={nodeX(node.level, node.index)} y={nodeY(node.level)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
                    {leaf && <text className="node-key" x={nodeX(node.level, node.index)} y={nodeY(node.level) + 29} textAnchor="middle">{node.active ? shortKey(node.key ?? '') : node.path}</text>}
                  </g>
                )
              }))}
            </svg>
            <DiagramTooltipOverlay tooltip={tooltip} owner="sparse" />
          </div>

          <div className="proof-card">
            <div className="proof-card-header">
              <div>
                <span className="mini-label">Proof required</span>
                <InfoTip as="strong" text={proof.leaf.active ? `Raw value: ${proof.leaf.value}` : 'No raw value is sent for an absence proof.'} focusable>{proof.leaf.active ? `key ${proof.key} = ${valueSummary(proof.leaf.value ?? '')}` : `key ${proof.key} is empty`}</InfoTip>
              </div>
              <span className={`verified-badge ${isVerifiable ? '' : 'is-unverified'}`}><span /> {isVerifiable ? 'root matches' : 'resolve state issues'}</span>
            </div>
            <div className="proof-chain">
              <InfoTip as="div" className="proof-chip primary" details={sparseNodeTooltip(proof.leaf, true, false, tree.depth)} focusable><span>computed leaf</span><b>{shortHash(proof.leaf.hash)}</b></InfoTip>
              {proof.steps.map((step) => (
                <div className="proof-chain-step" key={step.level}>
                  <span className="chain-arrow">-&gt;</span>
                  <InfoTip as="div" className="proof-chip" details={sparseNodeTooltip(tree.levels[step.level - 1][step.siblingIndex], false, true, tree.depth)} focusable><span>+ {step.currentIsLeft ? 'right' : 'left'} sibling</span><b>{shortHash(step.siblingHash)}</b></InfoTip>
                </div>
              ))}
              <div className="proof-chain-step">
                <span className="chain-arrow">-&gt;</span>
                <InfoTip as="div" className="proof-chip result" details={sparseNodeTooltip(tree.root, true, false, tree.depth)} focusable><span>reconstructed root</span><b>{shortHash(proof.reconstructedRoot)}</b></InfoTip>
              </div>
            </div>
            <p className="proof-explanation">A verifier hashes the arbitrary key into the {proof.path} path, then recomputes the leaf from the raw value (or the known empty default) and climbs through {proof.steps.length} sibling hashes. The leaf and root boxes are computed results, not wire payloads.</p>
            <InfoTip as="div" className="proof-size" text="Raw content-byte count for this demo proof. UTF-8 key/value bytes are followed by 32-byte SHA-256 sibling digests; serialization framing is not included." focusable>
              <div className="proof-size-heading"><span className="mini-label">Raw proof bytes</span><strong>{formatByteCount(proofSize.totalBytes)}</strong></div>
              <div className="proof-size-breakdown"><span>{formatByteCount(proofSize.inputBytes)} key/value input</span><span>+</span><span>{formatByteCount(proofSize.siblingBytes)} siblings</span></div>
              <p>{proof.leaf.active ? 'Large values increase the key/value portion.' : 'Absence proofs send the key; the empty leaf convention is known to the verifier.'} Each sibling is {SHA256_BYTES} bytes.</p>
            </InfoTip>
          </div>

          <details className="recipe-strip">
            <summary className="recipe-heading"><span className="mini-label">How a state becomes a digest</span><InfoTip text="The hash function receives a JSON array of domain and fields, so separators inside user data remain unambiguous." below><span>canonical JSON fields</span></InfoTip></summary>
            <div className="recipe-grid">
              <InfoTip as="div" className="recipe-step" text="The key is hashed first; the selected number of leading bits chooses one sparse leaf. The path is derived, not the logical key."><b>1</b><span>path</span><code>H(JSON(["smt:path", key])) / first {depth} bits</code></InfoTip>
              <InfoTip as="div" className="recipe-step" text="The leaf commits to the derived path, the original logical key, and the raw value. The visible box shows only the resulting digest."><b>2</b><span>leaf</span><code>H(JSON(["smt:leaf", path, key, value]))</code></InfoTip>
              <InfoTip as="div" className="recipe-step" text="Every branch commits to the digest of its left and right children, not to raw application data."><b>3</b><span>branch</span><code>H(JSON(["smt:node", left, right]))</code></InfoTip>
            </div>
            <p className="recipe-note">Raw keys and values remain in the state map. The tree boxes show 32-byte digests; a large value changes the proof input size, not the node dimensions.</p>
          </details>
        </div>
      </div>
    </section>
  )
}