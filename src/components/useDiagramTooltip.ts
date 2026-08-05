import { useState, type MouseEvent } from 'react'
import type { TooltipDetails } from './tooltipText'

export type DiagramTooltipOwner = 'sparse' | 'log' | 'keytrans-prefix' | 'keytrans-log'

type DiagramTooltip = {
  owner: DiagramTooltipOwner
  details: TooltipDetails
  left: number
  top: number
  above: boolean
}

export function useDiagramTooltip() {
  const [tooltip, setTooltip] = useState<DiagramTooltip | null>(null)

  const show = (event: MouseEvent<SVGGElement>, details: TooltipDetails, owner: DiagramTooltipOwner) => {
    const targetRect = event.currentTarget.getBoundingClientRect()
    const tooltipWidth = Math.min(350, window.innerWidth - 24)
    const targetCenter = targetRect.left + targetRect.width / 2
    const minLeft = 12
    const maxLeft = window.innerWidth - tooltipWidth - 12
    const left = Math.max(minLeft, Math.min(maxLeft, targetCenter - tooltipWidth / 2))
    const above = targetRect.top > 180
    const top = above ? targetRect.top - 10 : targetRect.bottom + 10
    setTooltip({ owner, details, left, top, above })
  }

  return { tooltip, show, hide: () => setTooltip(null) }
}