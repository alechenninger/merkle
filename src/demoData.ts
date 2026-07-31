import type { LogEvent, SparseEntry } from './domain/types'

export const INITIAL_SPARSE_ENTRIES: SparseEntry[] = [
  { id: 'state_001', key: 'account:alice', value: '42', enabled: true },
  { id: 'state_002', key: 'account:bob', value: '17', enabled: true },
  { id: 'state_003', key: 'account:erin', value: '83', enabled: true },
  { id: 'state_004', key: 'account:dave', value: '06', enabled: true },
]

export const INITIAL_LOG_EVENTS: LogEvent[] = [
  { id: 'evt_001', kind: 'deposit', actor: 'Mina', detail: '80 credits', timestamp: '09:41:02' },
  { id: 'evt_002', kind: 'purchase', actor: 'Mina', detail: '12 credits', timestamp: '09:41:18' },
  { id: 'evt_003', kind: 'key rotation', actor: 'vault-7', detail: 'new signer', timestamp: '09:42:04' },
  { id: 'evt_004', kind: 'attestation', actor: 'Orion', detail: 'device 04', timestamp: '09:42:31' },
  { id: 'evt_005', kind: 'withdrawal', actor: 'Mina', detail: '9 credits', timestamp: '09:43:12' },
]

export const LOG_KIND_OPTIONS = ['deposit', 'purchase', 'key rotation', 'attestation', 'withdrawal']