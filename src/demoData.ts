import type { KeyTransPublication, LogEvent, SparseEntry } from './domain/types'

export function createInitialSparseEntries(): SparseEntry[] {
  return [
    { id: 'state_001', key: 'account:alice', value: '42', enabled: true },
    { id: 'state_002', key: 'account:bob', value: '17', enabled: true },
    { id: 'state_003', key: 'account:carol', value: '83', enabled: true },
    { id: 'state_004', key: 'account:dave', value: '06', enabled: true },
  ]
}

export function createInitialLogEvents(): LogEvent[] {
  return [
    { id: 'evt_001', kind: 'deposit', actor: 'Mina', detail: '80 credits', timestamp: '09:41:02' },
    { id: 'evt_002', kind: 'purchase', actor: 'Mina', detail: '12 credits', timestamp: '09:41:18' },
    { id: 'evt_003', kind: 'key rotation', actor: 'vault-7', detail: 'new signer', timestamp: '09:42:04' },
    { id: 'evt_004', kind: 'attestation', actor: 'Orion', detail: 'device 04', timestamp: '09:42:31' },
    { id: 'evt_005', kind: 'withdrawal', actor: 'Mina', detail: '9 credits', timestamp: '09:43:12' },
  ]
}

export function createInitialKeyTransPublications(): KeyTransPublication[] {
  return [
    {
      id: 'pub_001',
      timestamp: '09:52:00',
      updates: [
        { id: 'alice_0', label: 'acct:alice', version: 0, value: 'ed25519:alice-device-a', opening: 'opening-alice-0' },
        { id: 'bob_0', label: 'acct:bob', version: 0, value: 'ed25519:bob-device-a', opening: 'opening-bob-0' },
      ],
    },
    {
      id: 'pub_002',
      timestamp: '09:57:00',
      updates: [
        { id: 'carol_0', label: 'acct:carol', version: 0, value: 'ed25519:carol-device-a', opening: 'opening-carol-0' },
        { id: 'dave_0', label: 'acct:dave', version: 0, value: 'ed25519:dave-device-a', opening: 'opening-dave-0' },
      ],
    },
    {
      id: 'pub_003',
      timestamp: '10:04:00',
      updates: [{ id: 'alice_1', label: 'acct:alice', version: 1, value: 'ed25519:alice-device-b', opening: 'opening-alice-1' }],
    },
    {
      id: 'pub_004',
      timestamp: '10:11:00',
      updates: [{ id: 'bob_1', label: 'acct:bob', version: 1, value: 'ed25519:bob-device-b', opening: 'opening-bob-1' }],
    },
  ]
}

export function createKeyTransWalkthroughPublications(): KeyTransPublication[] {
  return [
    {
      id: 'pub_001',
      timestamp: '09:42:00',
      updates: [
        { id: 'alice_0', label: 'acct:alice', version: 0, value: 'ed25519:alice-device-a', opening: 'opening-alice-0' },
        { id: 'bob_0', label: 'acct:bob', version: 0, value: 'ed25519:bob-device-a', opening: 'opening-bob-0' },
      ],
    },
    {
      id: 'pub_002',
      timestamp: '09:49:00',
      updates: [{ id: 'acct_carol_0', label: 'acct:carol', version: 0, value: 'ed25519:carol-device-a', opening: 'opening-carol-0' }],
    },
    {
      id: 'pub_003',
      timestamp: '09:56:00',
      updates: [{ id: 'acct_dave_0', label: 'acct:dave', version: 0, value: 'ed25519:dave-device-a', opening: 'opening-dave-0' }],
    },
    {
      id: 'pub_004',
      timestamp: '10:03:00',
      updates: [{ id: 'acct_eve_0', label: 'acct:eve', version: 0, value: 'ed25519:eve-device-a', opening: 'opening-eve-0' }],
    },
    {
      id: 'pub_005',
      timestamp: '10:10:00',
      updates: [{ id: 'bob_1', label: 'acct:bob', version: 1, value: 'ed25519:bob-device-b', opening: 'opening-bob-1' }],
    },
    {
      id: 'pub_006',
      timestamp: '10:17:00',
      updates: [{ id: 'alice_1', label: 'acct:alice', version: 1, value: 'ed25519:alice-device-b', opening: 'opening-alice-1' }],
    },
    {
      id: 'pub_007',
      timestamp: '10:24:00',
      updates: [{ id: 'acct_carol_1', label: 'acct:carol', version: 1, value: 'ed25519:carol-device-b', opening: 'opening-carol-1' }],
    },
  ]
}

export const LOG_KIND_OPTIONS = ['deposit', 'purchase', 'key rotation', 'attestation', 'withdrawal']