export function centerSelectedTreeNode(frame: HTMLDivElement | null, selector: string) {
  if (!frame) {
    return
  }
  const target = frame.querySelector<SVGGElement>(selector)
  if (!target) {
    return
  }
  const frameRect = frame.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const targetCenter = targetRect.left + targetRect.width / 2
  const frameCenter = frameRect.left + frameRect.width / 2
  frame.scrollLeft += targetCenter - frameCenter
}