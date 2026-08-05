import { useMemo, useState } from 'react'
import { createKeyTransWalkthroughPublications } from '../../demoData'
import { buildKeyTransWalkthrough } from '../../domain/keytransWalkthrough'

export type KeyTransWalkthroughModel = ReturnType<typeof useKeyTransWalkthrough>

export function useKeyTransWalkthrough() {
  const [activeVersion, setActiveVersion] = useState(1)
  const [activePosition, setActivePosition] = useState(6)
  const [stateCommitted, setStateCommitted] = useState(false)
  const walkthrough = useMemo(() => buildKeyTransWalkthrough(createKeyTransWalkthroughPublications()), [])
  const activeSearchInspection = walkthrough.responseView.search.inspections.find((inspection) => inspection.position === activePosition) ?? walkthrough.responseView.search.inspections[0]
  const activeLadderStep = activeSearchInspection.binaryLadder.find((step) => step.version === activeVersion) ?? activeSearchInspection.binaryLadder[0]
  const activeProofBundle = activeSearchInspection.prefixProof
  const activePrefixResult = activeProofBundle?.results.find((result) => result.version === activeVersion)

  const reset = () => {
    setActiveVersion(1)
    setActivePosition(6)
    setStateCommitted(false)
  }

  return {
    ...walkthrough,
    activeVersion,
    activePosition,
    activeSearchInspection,
    activeLadderStep,
    activeProofBundle,
    activePrefixResult,
    stateCommitted,
    setActiveVersion,
    setActivePosition,
    commitState: () => setStateCommitted(true),
    reset,
  }
}