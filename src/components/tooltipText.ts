export type TooltipDetails = {
  badge: string
  digest?: string
  equation?: string
  inputs?: string
  proofRole?: string
}

export function tooltipAriaLabel(text: string | undefined, details?: TooltipDetails) {
  if (!details) {
    return text ?? ''
  }
  return [
    details.badge,
    details.digest && `Digest: ${details.digest}`,
    details.equation && `Equation: ${details.equation}`,
    details.inputs && `Inputs: ${details.inputs}`,
    details.proofRole && `Proof role: ${details.proofRole}`,
  ].filter(Boolean).join('. ')
}