import { describe, expect, it } from 'vitest'
import { createKeyTransWalkthroughPublications } from '../demoData'
import {
  KEYTRANS_WALKTHROUGH_LADDER,
  buildKeyTransWalkthrough,
  verifyKeyTransResponse,
} from './keytransWalkthrough'
import type { KeyTransSearchResponse } from './types'

function verifyTamperedResponse(
  walkthrough: ReturnType<typeof buildKeyTransWalkthrough>,
  mutate: (response: KeyTransSearchResponse) => void,
) {
  const response = structuredClone(walkthrough.response)
  mutate(response)
  return verifyKeyTransResponse(walkthrough.request, response, walkthrough.previousState)
}

describe('Key Transparency client walkthrough', () => {
  it('reconstructs size seven from Bob\'s retained size-five state', () => {
    const walkthrough = buildKeyTransWalkthrough(createKeyTransWalkthroughPublications())
    expect(walkthrough.request).toEqual({ last: 5, label: 'acct:alice' })
    expect(walkthrough.response.version).toBe(1)
    expect(walkthrough.responseView.binaryLadder.map((step) => step.version)).toEqual(KEYTRANS_WALKTHROUGH_LADDER)
    expect(walkthrough.responseView.binaryLadder.map((step) => step.result)).toEqual([
      'inclusion',
      'inclusion',
      'non-inclusion',
      'non-inclusion',
    ])
    expect(walkthrough.response.binary_ladder[1].commitment).toBeUndefined()
    expect(walkthrough.responseView.search.inspections.map((inspection) => inspection.position)).toEqual([4, 6, 7])
    expect(walkthrough.responseView.search.inspections[2].binaryLadder.map((step) => step.version)).toEqual(KEYTRANS_WALKTHROUGH_LADDER)
    expect(walkthrough.responseView.search.inspections[2].prefixProof.results.map((result) => result.result)).toEqual([
      'inclusion',
      'inclusion',
      'nonInclusionLeaf',
      'nonInclusionParent',
    ])
    expect(walkthrough.response.full_tree_head).toMatchObject({
      head_type: 'updated',
      tree_head: { tree_size: 7 },
    })
    expect(Object.keys(walkthrough.response).sort()).toEqual(['binary_ladder', 'full_tree_head', 'opening', 'search', 'value', 'version'])
    const fullTreeHead = walkthrough.response.full_tree_head
    expect(Object.keys(fullTreeHead).sort()).toEqual(['head_type', 'tree_head'])
    if (fullTreeHead.head_type !== 'updated') {
      throw new Error('Expected updated tree head in walkthrough fixture')
    }
    expect(Object.keys(fullTreeHead.tree_head).sort()).toEqual(['signature', 'tree_size'])
    expect(Object.keys(walkthrough.response.search).sort()).toEqual(['inclusion', 'prefix_proofs', 'prefix_roots', 'timestamps'])
    expect(Object.keys(walkthrough.response.search.prefix_proofs[0]).sort()).toEqual(['elements', 'results'])
    expect(Object.keys(walkthrough.response.search.prefix_proofs[0].results[0]).sort()).toEqual(['depth', 'result_type'])
    const nonInclusionResult = walkthrough.response.search.prefix_proofs[0].results[1]
    expect(Object.keys(nonInclusionResult).sort()).toEqual(['depth', 'leaf', 'result_type'])
    if (nonInclusionResult.result_type !== 'nonInclusionLeaf') {
      throw new Error('Expected non-inclusion leaf result in walkthrough fixture')
    }
    expect(Object.keys(nonInclusionResult.leaf).sort()).toEqual(['commitment', 'vrf_output'])
    expect(Object.keys(walkthrough.response.binary_ladder[0]).sort()).toEqual(['commitment', 'proof'])
    expect(Object.keys(walkthrough.response.binary_ladder[1]).sort()).toEqual(['proof'])
    expect(walkthrough.response.binary_ladder[0]).not.toHaveProperty('version')
    expect(walkthrough.response.binary_ladder[0]).not.toHaveProperty('address')
    expect(walkthrough.response.binary_ladder[0]).not.toHaveProperty('result')
    expect(walkthrough.response.search.prefix_proofs[0]).not.toHaveProperty('position')
    expect(walkthrough.response.search.timestamps).toEqual(['10:17:00', '10:24:00'])
    expect(walkthrough.response.search.prefix_roots).toEqual([])
    expect(walkthrough.transcript.filter((entry) => entry.role === 'search').map((entry) => entry.position)).toEqual([4, 6, 7])
    expect(walkthrough.transcript.at(-1)?.title).toBe('Rightmost confirmation')
    expect(walkthrough.targetCommitment).toBe(walkthrough.targetRecord.commitment)
    expect(walkthrough.reconstruction.matchesTreeHead).toBe(true)
    expect(walkthrough.previousLogTree.root?.end).toBe(5)
    expect(walkthrough.currentLogTree.root?.end).toBe(7)
    expect(walkthrough.snapshots[5].prefixTree.records).toHaveLength(7)
    expect(walkthrough.verification).toEqual({
      vrfProofsVerified: true,
      prefixProofsVerified: true,
      targetCommitmentMatches: true,
      timestampsMonotonic: true,
      logRootMatches: true,
      treeHeadSignatureVerified: true,
    })
    expect(walkthrough.nextState.tree_head.tree_size).toBe(7)
    expect(walkthrough.nextState.full_subtree_heads.map((head) => `${head.start}-${head.end}`)).toEqual(['0-4', '4-6', '6-7'])
  })

  it('keeps the three-leaf balanced-head decomposition visible in the model', () => {
    const walkthrough = buildKeyTransWalkthrough(createKeyTransWalkthroughPublications())

    expect(`${walkthrough.balancedHeadExample.source.start}-${walkthrough.balancedHeadExample.source.end}`).toBe('4-7')
    expect(walkthrough.balancedHeadExample.heads.map((head) => `${head.start}-${head.end}`)).toEqual(['4-6', '6-7'])
  })

  it('reconstructs verification inputs from response material', () => {
    const walkthrough = buildKeyTransWalkthrough(createKeyTransWalkthroughPublications())

    for (const field of ['opening', 'value'] as const) {
      const tampered = verifyTamperedResponse(walkthrough, (response) => {
        response[field] = `${response[field]}-tampered`
      })

      expect(tampered.targetCommitment).not.toBe(walkthrough.targetCommitment)
      expect(tampered.reconstruction.candidateRoot).not.toBe(walkthrough.reconstruction.candidateRoot)
      expect(tampered.verification.targetCommitmentMatches).toBe(false)
      expect(tampered.verification.logRootMatches).toBe(false)
    }

    const tamperedTimestamp = verifyTamperedResponse(walkthrough, (response) => {
      response.search.timestamps[1] = '10:25:00'
    })
    expect(tamperedTimestamp.reconstruction.candidateRoot).not.toBe(walkthrough.reconstruction.candidateRoot)
    expect(tamperedTimestamp.verification.logRootMatches).toBe(false)

    const timestampBeforeRetainedFrontier = verifyTamperedResponse(walkthrough, (response) => {
      response.search.timestamps[0] = '10:09:00'
    })
    expect(timestampBeforeRetainedFrontier.verification.timestampsMonotonic).toBe(false)

    const tamperedPrefixRoot = verifyTamperedResponse(walkthrough, (response) => {
      response.search.prefix_roots.push('0'.repeat(64))
    })
    expect(tamperedPrefixRoot.reconstruction.candidateRoot).not.toBe(walkthrough.reconstruction.candidateRoot)
    expect(tamperedPrefixRoot.verification.prefixProofsVerified).toBe(false)
    expect(tamperedPrefixRoot.verification.logRootMatches).toBe(false)

    const tamperedPrefixProof = verifyTamperedResponse(walkthrough, (response) => {
      const positionSeven = response.search.prefix_proofs[2]!
      const targetResult = walkthrough.responseView.search.inspections[2].prefixProof.results.find((result) => result.version === response.version)!
      const siblingIndex = positionSeven.elements.indexOf(targetResult.proof.steps[0].siblingHash)
      positionSeven.elements[siblingIndex] = '0'.repeat(64)
    })
    expect(tamperedPrefixProof.reconstruction.candidateRoot).not.toBe(walkthrough.reconstruction.candidateRoot)
    expect(tamperedPrefixProof.verification.prefixProofsVerified).toBe(false)
    expect(tamperedPrefixProof.verification.logRootMatches).toBe(false)

    const tamperedRetainedAnchor = verifyTamperedResponse(walkthrough, (response) => {
      const positionFour = response.search.prefix_proofs[0]!
      positionFour.elements[0] = '0'.repeat(64)
    })
    expect(tamperedRetainedAnchor.verification.prefixProofsVerified).toBe(false)
  })
})