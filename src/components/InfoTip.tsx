import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { tooltipAriaLabel, type TooltipDetails } from './tooltipText'

export type TooltipTag = 'b' | 'div' | 'span' | 'strong'

type InfoTipProps = {
  text?: string
  details?: TooltipDetails
  children: ReactNode
  as?: TooltipTag
  className?: string
  below?: boolean
  focusable?: boolean
}

type TooltipPosition = {
  left: number
  top: number
  below: boolean
}

export function TooltipDetailsView({ details }: { details: TooltipDetails }) {
  return (
    <>
      <div className="tooltip-badge-row">
        <span className="tooltip-badge">{details.badge}</span>
        {details.proofRole && <span className="tooltip-role-badge">{details.proofRole}</span>}
      </div>
      {details.digest && <div className="tooltip-field"><span className="tooltip-field-label">digest</span><code className="tooltip-field-value">{details.digest}</code></div>}
      {details.equation && <div className="tooltip-field"><span className="tooltip-field-label">equation</span><code className="tooltip-field-value">{details.equation}</code></div>}
      {details.inputs && <div className="tooltip-field"><span className="tooltip-field-label">inputs</span><code className="tooltip-field-value">{details.inputs}</code></div>}
    </>
  )
}

export function InfoTip({ text, details, children, as = 'span', className = '', below = false, focusable = false }: InfoTipProps) {
  const Tag = as
  const tooltipId = `tooltip-${useId().replaceAll(':', '')}`
  const triggerRef = useRef<HTMLElement | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const isOpen = isHovered || isFocused

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) {
        return
      }
      const rect = trigger.getBoundingClientRect()
      const cardWidth = Math.min(340, Math.max(0, window.innerWidth - 28))
      const minCenter = 14 + cardWidth / 2
      const maxCenter = window.innerWidth - 14 - cardWidth / 2
      const left = Math.max(minCenter, Math.min(maxCenter, rect.left + rect.width / 2))
      const showBelow = below || rect.top < 170
      setPosition({ left, top: showBelow ? rect.bottom + 10 : rect.top - 10, below: showBelow })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [below, isOpen])

  const tooltipCard = isOpen && position ? createPortal(
    <div
      id={tooltipId}
      className={`info-tip-card ${position.below ? 'is-below' : 'is-above'}`}
      style={{ left: position.left, top: position.top }}
      role="tooltip"
    >
      {details ? <TooltipDetailsView details={details} /> : <span className="info-tip-copy">{text}</span>}
    </div>,
    document.body,
  ) : null

  return (
    <>
      <Tag
        ref={(element: HTMLElement | null) => { triggerRef.current = element }}
        className={`info-tip ${below ? 'info-tip-below' : ''} ${focusable ? 'is-focusable' : ''} ${className}`}
        tabIndex={focusable ? 0 : undefined}
        aria-label={focusable ? tooltipAriaLabel(text, details) : undefined}
        aria-describedby={focusable && isOpen ? tooltipId : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onPointerDown={(event) => {
          if (focusable) {
            event.preventDefault()
            setIsFocused(false)
          }
        }}
        onBlur={(event) => {
          if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsFocused(false)
          }
        }}
      >
        {children}
      </Tag>
      {tooltipCard}
    </>
  )
}