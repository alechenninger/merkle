import { createPortal } from 'react-dom'
import { TooltipDetailsView } from './InfoTip'
import type { DiagramTooltipOwner } from './useDiagramTooltip'
import { tooltipAriaLabel, type TooltipDetails } from './tooltipText'

type DiagramTooltip = {
  owner: DiagramTooltipOwner
  details: TooltipDetails
  left: number
  top: number
  above: boolean
}

export function DiagramTooltipOverlay({ tooltip, owner }: { tooltip: DiagramTooltip | null; owner: DiagramTooltipOwner }) {
  if (!tooltip || tooltip.owner !== owner) {
    return null
  }
  const tooltipCard = (
    <div className={`diagram-tooltip ${tooltip.above ? 'is-above' : 'is-below'}`} style={{ left: tooltip.left, top: tooltip.top }} role="tooltip" aria-label={tooltipAriaLabel(undefined, tooltip.details)}>
      <TooltipDetailsView details={tooltip.details} />
    </div>
  )
  return createPortal(tooltipCard, document.body)
}