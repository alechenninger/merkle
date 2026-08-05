import { useMemo, useState } from 'react'
import { createInitialKeyTransPublications } from '../../demoData'
import { buildKeyTransView } from '../../domain/keytrans'

export type KeyTransDemoModel = ReturnType<typeof useKeyTransDemo>

function nextPublicationTimestamp(publicationCount: number) {
  const totalMinutes = 9 * 60 + 52 + publicationCount * 7
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

export function useKeyTransDemo() {
  const [publications, setPublications] = useState(createInitialKeyTransPublications)
  const [selectedLabel, setSelectedLabel] = useState('acct:alice')
  const [selectedVersion, setSelectedVersion] = useState(1)
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState(3)

  const labels = useMemo(
    () => Array.from(new Set(publications.flatMap((publication) => publication.updates.map((update) => update.label)))).sort(),
    [publications],
  )
  const versions = useMemo(
    () => Array.from(new Set(publications.flatMap((publication) => publication.updates)
      .filter((update) => update.label === selectedLabel)
      .map((update) => update.version))).sort((left, right) => left - right),
    [publications, selectedLabel],
  )
  const view = useMemo(
    () => buildKeyTransView(publications, selectedLabel, selectedVersion, selectedSnapshotIndex),
    [publications, selectedLabel, selectedSnapshotIndex, selectedVersion],
  )
  const isPrefixVerified = view.prefixProof.reconstructedRoot === view.snapshot.prefixTree.root.hash
  const isLogVerified = view.reconstructedLogRoot === view.treeHead.root
  const prefixProofHashes = useMemo(
    () => new Set(view.prefixProof.steps.map((step) => step.siblingHash)),
    [view.prefixProof.steps],
  )
  const logProofNodeKeys = useMemo(
    () => new Set(view.logProofElements.map((head) => `${head.start}-${head.end}`)),
    [view.logProofElements],
  )

  const selectLabel = (label: string) => {
    const nextVersions = publications.flatMap((publication) => publication.updates)
      .filter((update) => update.label === label)
      .map((update) => update.version)
    setSelectedLabel(label)
    setSelectedVersion(Math.max(...nextVersions))
  }

  const publishRotation = () => {
    const nextVersion = Math.max(...versions) + 1
    const publicationId = `pub_${String(publications.length + 1).padStart(3, '0')}`
    const updateId = `${selectedLabel.replace('acct:', '')}_${nextVersion}`
    setPublications((currentPublications) => [
      ...currentPublications,
      {
        id: publicationId,
        timestamp: nextPublicationTimestamp(currentPublications.length),
        updates: [{
          id: updateId,
          label: selectedLabel,
          version: nextVersion,
          value: `ed25519:${selectedLabel.replace('acct:', '')}-device-${String.fromCharCode(97 + nextVersion)}`,
          opening: `opening-${selectedLabel.replace('acct:', '')}-${nextVersion}`,
        }],
      },
    ])
    setSelectedVersion(nextVersion)
    setSelectedSnapshotIndex(publications.length)
  }

  const reset = () => {
    setPublications(createInitialKeyTransPublications())
    setSelectedLabel('acct:alice')
    setSelectedVersion(1)
    setSelectedSnapshotIndex(3)
  }

  return {
    publications,
    labels,
    versions,
    selectedLabel,
    selectedVersion,
    selectedSnapshotIndex: view.snapshotIndex,
    view,
    isPrefixVerified,
    isLogVerified,
    prefixProofHashes,
    logProofNodeKeys,
    selectLabel,
    setSelectedVersion,
    setSelectedSnapshotIndex,
    publishRotation,
    reset,
  }
}