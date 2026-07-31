import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js'

export const SHA256_BYTES = 32

export function sha256(input: string) {
  return Array.from(nobleSha256(new TextEncoder().encode(input)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function encodeHashFields(domain: string, ...fields: string[]) {
  return JSON.stringify([domain, ...fields])
}

export function hashFields(domain: string, ...fields: string[]) {
  return sha256(encodeHashFields(domain, ...fields))
}

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}