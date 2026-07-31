import type { LogEvent, LogNode, SparseNode } from '../domain/types'
import type { TooltipDetails } from './tooltipText'

export function proofRoleDescription(pathNode: boolean, proofNode: boolean, root: boolean, leaf: boolean, active: boolean) {
  if (root) {
    return 'verification target'
  }
  if (proofNode) {
    return 'proof sibling'
  }
  if (pathNode && leaf) {
    return active ? 'selected leaf' : 'selected empty leaf'
  }
  if (pathNode) {
    return 'selected path'
  }
  return 'not in proof'
}

export function sparseNodeTooltip(node: SparseNode, pathNode: boolean, proofNode: boolean, depth: number): TooltipDetails {
  const root = node.level === depth
  const leaf = node.level === 0
  const badge = root ? 'root branch' : leaf ? (node.active ? 'populated leaf' : 'empty leaf') : 'branch'
  const proofRole = proofRoleDescription(pathNode, proofNode, root, leaf, Boolean(node.active))
  if (node.level === 0 && node.active) {
    return {
      badge,
      digest: node.hash,
      equation: 'SHA-256(JSON(["smt:leaf", path, key, value]))',
      inputs: `path = ${node.path} (first ${depth} bits of SHA-256(JSON(["smt:path", key])))\nkey = ${node.key}\nvalue = ${node.value ?? ''}`,
      proofRole,
    }
  }
  if (node.level === 0) {
    return {
      badge,
      digest: node.hash,
      equation: 'SHA-256(JSON(["smt:empty", "leaf"]))',
      inputs: `path = ${node.path}\nknown empty-leaf constant`,
      proofRole,
    }
  }
  return {
    badge,
    digest: node.hash,
    equation: 'SHA-256(JSON(["smt:node", left, right]))',
    inputs: `left = ${node.left?.hash ?? ''}\nright = ${node.right?.hash ?? ''}`,
    proofRole,
  }
}

export function logNodeTooltip(node: LogNode, event: LogEvent | undefined, pathNode: boolean, proofNode: boolean, root: boolean): TooltipDetails {
  const leaf = !node.left
  const badge = root ? 'root branch' : leaf ? 'event leaf' : 'branch'
  const proofRole = proofRoleDescription(pathNode, proofNode, root, leaf, Boolean(event))
  if (!node.left && event) {
    return {
      badge,
      digest: node.hash,
      equation: 'SHA-256(JSON(["log:leaf", id, kind, actor, detail, timestamp]))',
      inputs: `id = ${event.id}\nkind = ${event.kind}\nactor = ${event.actor}\ndetail = ${event.detail}\ntimestamp = ${event.timestamp}`,
      proofRole,
    }
  }
  return {
    badge,
    digest: node.hash,
    equation: 'SHA-256(JSON(["log:node", left, right]))',
    inputs: `left = ${node.left?.hash ?? ''}\nright = ${node.right?.hash ?? ''}`,
    proofRole,
  }
}

export function logLeafTooltip(event: LogEvent, hash: string, pathNode: boolean, proofNode: boolean) {
  return logNodeTooltip({ start: 0, end: 1, depth: 0, hash }, event, pathNode, proofNode, false)
}