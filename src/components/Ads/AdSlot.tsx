import { useEffect, useRef } from 'react'

interface AdSlotProps {
  position: 'top' | 'sidebar' | 'bottom'
  className?: string
}

export default function AdSlot({ position, className = '' }: AdSlotProps) {
  const adRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      if (adRef.current && typeof window !== 'undefined') {
        (window as any).adsbygoogle = (window as any).adsbygoogle || [];
        (window as any).adsbygoogle.push({})
      }
    } catch (e) {
      console.error('AdSense error:', e)
    }
  }, [])

  return (
    <div className={`ad-slot ad-${position} ${className}`} ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot="XXXXXXXXXX"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      {/* Fallback visible while AdSense loads or if blocked */}
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          minHeight: position === 'sidebar' ? '250px' : '90px',
          background: 'var(--surface-1)',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-tertiary)',
          fontSize: '11px',
          letterSpacing: '0.05em',
        }}
      >
        Advertisement
      </div>
    </div>
  )
}
