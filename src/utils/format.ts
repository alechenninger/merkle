import { utf8ByteLength } from '../domain/hash'

export function shortHash(hash: string) {
  return `${hash.slice(0, 6)}..${hash.slice(-4)}`
}

export function shortKey(key: string) {
  return key.length > 6 ? `${key.slice(0, 4)}..` : key
}

export function formatByteCount(bytes: number) {
  return `${bytes.toLocaleString()} B`
}

export function valueSummary(value: string) {
  return value.length > 24 ? `${value.slice(0, 20)}... (${formatByteCount(utf8ByteLength(value))})` : value
}

export function diagramWidth(leafCount: number) {
  return Math.max(760, leafCount * 140)
}

export function diagramNodeX(spanStart: number, spanEnd: number, leafCount: number, width: number) {
  return ((spanStart + spanEnd) / 2 / Math.max(leafCount, 1)) * width
}