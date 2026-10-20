import { useEffect, useState, useRef } from 'react'
import { defaultAdConfig, type HouseAd, isAdsenseConfigured, getAdsForPosition } from '../../config/ads'

interface AdSlotProps {
  position: 'top' | 'sidebar' | 'bottom'
  className?: string
  config?: Partial<typeof defaultAdConfig>
}

function HouseAdCard({ ad, position }: { ad: HouseAd; position: 'top' | 'sidebar' | 'bottom' }) {
  return (
    <a
      href={ad.url}
      target={ad.target || '_blank'}
      rel="noopener noreferrer"
      className={`house-ad house-ad-${position} spatial-card-static flex items-center gap-3 p-4 transition-all duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] cursor-pointer group`}
      style={{ textDecoration: 'none' }}
      aria-label={ad.title}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{ background: 'var(--accent-medium)', color: 'var(--accent)' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ad.title}</div>
        <div className="text-sm truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{ad.description}</div>
        <div className="text-xs font-medium mt-1.5" style={{ color: 'var(--accent)' }}>{ad.cta}</div>
      </div>
      <svg
        className="w-5 h-5 flex-shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  )
}

function AdSenseSlot({ client, slot }: { client: string; slot: string }) {
  const adRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      if (adRef.current && typeof window !== 'undefined') {
        (window as any).adsbygoogle = (window as any).adsbygoogle || []
        ;(window as any).adsbygoogle.push({})
      }
    } catch (e) {
      console.error('AdSense error:', e)
    }
  }, [])

  return (
    <div className="adsense-slot" ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}

export default function AdSlot({ position, className = '', config }: AdSlotProps) {
  const mergedConfig = { ...defaultAdConfig, ...config }
  const [currentAd, setCurrentAd] = useState<HouseAd | null>(null)
  const [showAdsense, setShowAdsense] = useState(false)
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialize with a random house ad
  useEffect(() => {
    const ads = getAdsForPosition(position, mergedConfig)
    if (ads.length > 0) {
      setCurrentAd(ads[0])
    }

    // Check if AdSense is properly configured
    const adsenseReady = isAdsenseConfigured(mergedConfig)
    setShowAdsense(adsenseReady)

    // Rotation interval for house ads (only if not showing AdSense)
    if (!adsenseReady && mergedConfig.rotationInterval > 0) {
      const intervalId = window.setInterval(() => {
        const ads = getAdsForPosition(position, mergedConfig)
        if (ads.length > 0) {
          setCurrentAd(ads[Math.floor(Math.random() * ads.length)])
        }
      }, mergedConfig.rotationInterval)
      rotationRef.current = intervalId as unknown as ReturnType<typeof setInterval>
    }

    return () => {
      if (rotationRef.current) {
        clearInterval(rotationRef.current)
      }
    }
  }, [position, mergedConfig])

  // Don't render anything if no ads available
  if (!currentAd && !showAdsense) return null

  const containerClass = `ad-slot ad-${position} ${className}`

  if (showAdsense && mergedConfig.adsense) {
    return (
      <div className={containerClass}>
        <AdSenseSlot
          client={mergedConfig.adsense.client}
          slot={mergedConfig.adsense.slots[position]}
        />
      </div>
    )
  }

  return (
    <div className={containerClass} role="complementary" aria-label="Enlace patrocinado">
      {currentAd && <HouseAdCard ad={currentAd} position={position} />}
    </div>
  )
}