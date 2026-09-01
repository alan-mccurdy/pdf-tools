/**
 * Tooltip Help Component
 * Provides contextual help tooltips for PDF editor features
 */

import { useState, useRef, useEffect, useCallback } from 'react'

interface TooltipProps {
  text: string
  children: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ text, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipEl = tooltipRef.current
    const tooltipRect = tooltipEl.getBoundingClientRect()

    let x = rect.left + rect.width / 2 - tooltipRect.width / 2
    let y = rect.top

    switch (placement) {
      case 'bottom':
        y = rect.bottom + 8
        break
      case 'left':
        x = rect.left - tooltipRect.width - 8
        y = rect.top + rect.height / 2 - tooltipRect.height / 2
        break
      case 'right':
        x = rect.right + 8
        y = rect.top + rect.height / 2 - tooltipRect.height / 2
        break
      default:
        y = rect.top - tooltipRect.height - 8
    }

    x = Math.max(10, Math.min(window.innerWidth - tooltipRect.width - 10, x))
    y = Math.max(10, y)

    setPosition({ x, y })
  }, [visible, placement])

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        className="cursor-help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        tabIndex={0}
      >
        {children}
      </div>

      {visible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 px-3 py-2 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-w-xs break-words"
          style={{ left: position.x, top: position.y }}
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={() => setVisible(false)}
        >
          {text}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-t border-slate-700 border-l-transparent border-r-transparent border-b-slate-700" />
        </div>
      )}
    </div>
  )
}

export default Tooltip