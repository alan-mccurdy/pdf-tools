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

  // Placeholder for development — replace pub ID before production
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
    </div>
  )
}
