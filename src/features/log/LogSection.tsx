import { useEffect, useRef } from 'react'
import { SHA256_BYTES } from '../../domain/hash'
import { collectLogEdges, collectLogNodes, logTreeHeight } from '../../domain/log'
import type { LogNode } from '../../domain/types'
import { centerSelectedTreeNode } from '../../components/TreeDiagram'
import { DiagramTooltipOverlay } from '../../components/DiagramTooltip'
import { InfoTip } from '../../components/InfoTip'
import { logLeafTooltip, logNodeTooltip } from '../../components/nodeTooltips'
import { useDiagramTooltip } from '../../components/useDiagramTooltip'
import { diagramNodeX, diagramWidth, formatByteCount, shortHash } from '../../utils/format'
import type { LogDemoModel } from './useLogDemo'

type LogSectionProps = {
  model: LogDemoModel
}

export function LogSection({ model }: LogSectionProps) {
  const { events, selectedIndex, selectedEvent, view, proofSize, proofNodeKeys, kindOptions, newEventKind, newEventActor, newEventDetail, setSelectedIndex, setNewEventKind, setNewEventActor, setNewEventDetail, appendEvent } = model
  const { tooltip, show, hide } = useDiagramTooltip()
  const treeFrameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    centerSelectedTreeNode(treeFrameRef.current, '.log-node.is-path.is-leaf')
  }, [selectedIndex, events.length])

  const svgWidth = diagramWidth(events.length)
  const nodeX = (node: LogNode) => diagramNodeX(node.start, node.end, events.length, svgWidth)
  const nodeY = (node: LogNode) => 38 + node.depth * 62
  const treeHeight = view.tree ? Math.max(260, (logTreeHeight(view.tree) + 1) * 62 + 36) : 260

  return (
    <section className="structure-section log-section" aria-labelledby="log-title">
      <div className="section-heading">
        <div className="section-number coral">02</div>
        <div>
          <span className="section-kicker">Ordered events / append-only commitment</span>
          <h2 id="log-title">Merkle log</h2>
          <p>Commit to a timeline once, then verify that an event is included without downloading every event.</p>
        </div>
        <div className="section-tag coral-tag">append only / ordered</div>
      </div>

      <div className="log-layout">
        <aside className="control-rail log-rail" aria-label="Merkle log controls">
          <div className="rail-title-row">
            <div>
              <span className="mini-label">Event stream</span>
              <strong>{events.length} committed events</strong>
            </div>
            <span className="rail-accent coral-text">immutable</span>
          </div>
          <div className="append-form">
            <label>
              <span>kind</span>
              <select value={newEventKind} onChange={(event) => setNewEventKind(event.target.value)}>
                {kindOptions.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>actor</span>
              <input value={newEventActor} onChange={(event) => setNewEventActor(event.target.value)} placeholder="who" />
            </label>
            <label className="wide-field">
              <span>payload</span>
              <input value={newEventDetail} onChange={(event) => setNewEventDetail(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && appendEvent()} placeholder="what happened" />
            </label>
            <button className="append-button" type="button" onClick={appendEvent} disabled={!newEventDetail.trim() || !newEventActor.trim()}>
              <span>+</span> Append event
            </button>
          </div>
          <div className="event-list" aria-label="Committed events">
            {events.map((event, index) => (
              <button className={`event-row ${index === selectedIndex ? 'is-selected' : ''}`} type="button" key={event.id} onClick={() => setSelectedIndex(index)}>
                <span className="event-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="event-copy"><strong>{event.kind}</strong><span>{event.actor} / {event.detail}</span></span>
                <span className="event-time">{event.timestamp}</span>
              </button>
            ))}
          </div>
          <div className="rail-note coral-note">
            <span className="note-mark">!</span>
            <p>There is no edit or delete operation. A new event changes the root, while old roots remain useful snapshots.</p>
          </div>
        </aside>

        <div className="visual-stage log-stage">
          <div className="stage-header">
            <div>
              <span className="mini-label">Current log root / snapshot {events.length}</span>
              <InfoTip details={view.tree ? logNodeTooltip(view.tree, undefined, true, false, true) : undefined} text={view.tree ? undefined : 'No root exists until the first event is appended.'} below className="hash-tip" focusable>
                <strong className="root-hash coral-root">{view.tree ? shortHash(view.tree.hash) : 'empty'}</strong>
              </InfoTip>
            </div>
            <div className="verification-state coral-state"><span /> event selected: #{selectedIndex + 1}</div>
          </div>
          <div className="diagram-legend coral-legend" aria-label="Merkle log diagram legend">
            <InfoTip text="Selected path: the nodes used to reconstruct the requested event proof." below><span><i className="legend-swatch legend-path" /> selected path</span></InfoTip>
            <InfoTip text="Proof sibling: a digest supplied to the verifier." below><span><i className="legend-swatch legend-proof" /> proof sibling</span></InfoTip>
            <InfoTip text="Leaf digest: computed from the complete raw event." below><span><i className="legend-swatch legend-leaf" /> leaf digest</span></InfoTip>
            <InfoTip text="Branch digest: computed from two child digests." below><span><i className="legend-swatch legend-digest" /> branch digest</span></InfoTip>
            <InfoTip text="Root commitment: the digest compared with the verifier's result." below><span><i className="legend-swatch legend-root" /> root</span></InfoTip>
          </div>
          <div className="tree-frame log-tree-frame" ref={treeFrameRef} onScroll={hide}>
            {view.tree ? (
              <svg className="tree-svg log-svg" width={svgWidth} height={treeHeight} viewBox={`0 0 ${svgWidth} ${treeHeight}`} aria-hidden="true" focusable="false">
                {collectLogEdges(view.tree).map(({ parent, child }) => {
                  const childIsPath = child.start <= selectedIndex && selectedIndex < child.end
                  const childIsProof = proofNodeKeys.has(`${child.start}-${child.end}`)
                  return <line className={`tree-edge ${childIsPath ? 'is-path' : ''} ${childIsProof ? 'is-proof-edge' : ''}`} key={`${parent.start}-${parent.end}-${child.start}`} x1={nodeX(parent)} y1={nodeY(parent)} x2={nodeX(child)} y2={nodeY(child)} />
                })}
                {collectLogNodes(view.tree).map((node) => {
                  const pathNode = node.start <= selectedIndex && selectedIndex < node.end
                  const proofNode = proofNodeKeys.has(`${node.start}-${node.end}`)
                  const leaf = !node.left
                  const nodeTooltip = logNodeTooltip(node, leaf ? events[node.start] : undefined, pathNode, proofNode, node === view.tree)
                  return (
                    <g className={`log-node ${pathNode ? 'is-path' : ''} ${proofNode ? 'is-proof' : ''} ${leaf ? 'is-leaf' : ''} ${node === view.tree ? 'is-root' : ''}`} key={`${node.start}-${node.end}`}
                      onMouseEnter={(event) => show(event, nodeTooltip, 'log')}
                      onMouseLeave={hide}
                    >
                      <rect x={nodeX(node) - (leaf ? 38 : 36)} y={nodeY(node) - 18} width={leaf ? 76 : 72} height="36" rx="5" />
                      <text className="node-hash" x={nodeX(node)} y={nodeY(node)} textAnchor="middle" dominantBaseline="middle">{shortHash(node.hash)}</text>
                      {leaf && <text className="node-key" x={nodeX(node)} y={nodeY(node) + 29} textAnchor="middle">{events[node.start].id}</text>}
                    </g>
                  )
                })}
              </svg>
            ) : <div className="empty-log">Append an event to grow the log.</div>}
            <DiagramTooltipOverlay tooltip={tooltip} owner="log" />
          </div>

          {selectedEvent ? (
            <div className="proof-card log-proof-card">
              <div className="proof-card-header">
                <div>
                  <span className="mini-label">Inclusion proof</span>
                  <strong>{selectedEvent.id} / {selectedEvent.kind}</strong>
                </div>
                <span className="verified-badge coral-badge"><span /> root matches</span>
              </div>
              <div className="log-proof-table">
                <div className="proof-table-head"><span>step</span><span>sibling subtree</span><span>hash</span><span>combine</span></div>
                <div className="proof-table-row first-row"><span>leaf</span><span>{selectedEvent.id}</span><InfoTip as="b" details={logLeafTooltip(selectedEvent, view.leafHashes[selectedIndex], true, false)} focusable>{shortHash(view.leafHashes[selectedIndex])}</InfoTip><span>start</span></div>
                {view.proof.map((step, index) => (
                  <div className="proof-table-row" key={`${step.sibling.start}-${step.sibling.end}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span>{step.sibling.start + 1}-{step.sibling.end} {step.currentIsLeft ? 'right' : 'left'} subtree</span>
                    <InfoTip as="b" details={logNodeTooltip(step.sibling, step.sibling.left ? undefined : events[step.sibling.start], false, true, false)} focusable>{shortHash(step.sibling.hash)}</InfoTip>
                    <span>left + right</span>
                  </div>
                ))}
              </div>
              <div className="proof-result-line"><span>reconstructed root</span><InfoTip as="b" details={view.tree ? logNodeTooltip(view.tree, undefined, true, false, true) : undefined} text={view.tree ? undefined : 'No root exists until the first event is appended.'} focusable>{shortHash(view.reconstructedRoot)}</InfoTip><span className="match-label">matches snapshot</span></div>
              <p className="proof-explanation">The verifier recomputes the selected event leaf from its raw fields, then climbs through sibling digests. The leaf and reconstructed root are local calculations; the event fields and sibling hashes are the proof payload.</p>
              <InfoTip as="div" className="proof-size" text="Raw content-byte count for this demo proof. UTF-8 event fields are followed by 32-byte SHA-256 sibling digests; serialization framing is not included." focusable>
                <div className="proof-size-heading"><span className="mini-label">Raw proof bytes</span><strong>{formatByteCount(proofSize.totalBytes)}</strong></div>
                <div className="proof-size-breakdown"><span>{formatByteCount(proofSize.inputBytes)} event input</span><span>+</span><span>{formatByteCount(proofSize.siblingBytes)} siblings</span></div>
                <p>Timestamp is part of the committed event input. Each sibling is {SHA256_BYTES} bytes.</p>
              </InfoTip>
            </div>
          ) : null}

          <details className="recipe-strip coral-recipe">
            <summary className="recipe-heading"><span className="mini-label">How an event becomes a digest</span><InfoTip text="The hash function receives a JSON array of domain and fields, so separators inside user data remain unambiguous." below><span>canonical JSON fields</span></InfoTip></summary>
            <div className="recipe-grid">
              <InfoTip as="div" className="recipe-step" text="The complete event fields, including its timestamp, form the leaf input. The visible event leaf box shows only the resulting digest."><b>1</b><span>leaf</span><code>H(JSON(["log:leaf", id, kind, actor, detail, timestamp]))</code></InfoTip>
              <InfoTip as="div" className="recipe-step" text="Every branch commits to the digest of its left and right children, preserving the event order encoded by the tree shape."><b>2</b><span>branch</span><code>H(JSON(["log:node", left, right]))</code></InfoTip>
            </div>
            <p className="recipe-note">Raw event fields remain in the event stream. Leaf boxes show 32-byte digests; the event ID underneath is an orientation label, not the leaf content.</p>
          </details>

          <div className="root-history">
            <div className="history-heading"><span className="mini-label">Root history</span><span>each append creates a new snapshot commitment</span></div>
            <div className="history-list">
              {view.roots.map((root, index) => (
                <button type="button" className={`history-item ${index === selectedIndex ? 'is-selected' : ''}`} key={`${root}-${index}`} onClick={() => setSelectedIndex(index)}>
                  <span>#{index + 1}</span><b>{shortHash(root)}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}