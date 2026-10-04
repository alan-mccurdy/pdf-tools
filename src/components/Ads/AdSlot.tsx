import { useEffect, useRef } from 'react'

interface AdSlotProps {
  position: 'top' | 'sidebar' | 'bottom'
  className?: string
  adClient?: string
  adSlot?: string
}

export default function AdSlot({ position, className = '', adClient, adSlot }: AdSlotProps) {
  const adRef = useRef<HTMLDivElement>(null)
  const isPlaceholder = !adClient || !adSlot || adClient.includes('XXXXXXXX') || adSlot.includes('XXXXXXXX')

  useEffect(() => {
    if (isPlaceholder) return
    try {
      if (adRef.current && typeof window !== 'undefined') {
        (window as any).adsbygoogle = (window as any).adsbygoogle || [];
        (window as any).adsbygoogle.push({})
      }
    } catch (e) {
      console.error('AdSense error:', e)
    }
  }, [isPlaceholder])

  if (isPlaceholder) return null

  return (
    <div className={`ad-slot ad-${position} ${className}`} ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
