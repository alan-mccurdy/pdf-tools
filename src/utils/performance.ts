/**
 * Performance Monitoring Utilities
 * Lightweight, privacy-friendly web vitals tracking
 * No external dependencies, no PII collected
 */

interface WebVitals {
  lcp?: number      // Largest Contentful Paint (ms)
  fid?: number      // First Input Delay (ms)
  cls?: number      // Cumulative Layout Shift (score * 1000)
  ttfb?: number     // Time to First Byte (ms)
  fcp?: number      // First Contentful Paint (ms)
  inp?: number      // Interaction to Next Paint (ms)
}

interface VitalsData extends WebVitals {
  timestamp: number
  url: string
  userAgent: string
  connection?: string
  deviceMemory?: number
  hardwareConcurrency?: number
}

let vitalsBuffer: VitalsData | null = null
let hasReported = false

/**
 * Initialize web vitals collection
 * Call once at app startup
 */
export function initWebVitals(onReport?: (data: VitalsData) => void): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return () => {}
  }

  const data: VitalsData = {
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent.slice(0, 200),
    connection: (navigator as any).connection?.effectiveType,
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  }

  vitalsBuffer = data

  // LCP - Largest Contentful Paint
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      if (lastEntry && vitalsBuffer) {
        vitalsBuffer.lcp = Math.round(lastEntry.startTime)
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {}

  // FCP - First Contentful Paint
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const fcpEntry = entries.find(e => e.name === 'first-contentful-paint')
      if (fcpEntry && vitalsBuffer) {
        vitalsBuffer.fcp = Math.round(fcpEntry.startTime)
      }
    }).observe({ type: 'paint', buffered: true })
  } catch {}

  // FID - First Input Delay (deprecated, use INP)
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const firstEntry = entries[0] as PerformanceEventTiming
      if (firstEntry && vitalsBuffer) {
        vitalsBuffer.fid = Math.round(firstEntry.processingStart - firstEntry.startTime)
      }
    }).observe({ type: 'first-input', buffered: true })
  } catch {}

  // INP - Interaction to Next Paint (replaces FID)
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      let maxInp = 0
      for (const entry of entries) {
        const inp = (entry as any).processingStart
          ? (entry as any).processingStart - entry.startTime + (entry as any).duration
          : entry.duration
        if (inp > maxInp) maxInp = inp
      }
      if (maxInp > 0 && vitalsBuffer) {
        vitalsBuffer.inp = Math.round(maxInp)
      }
    }).observe({ type: 'event', buffered: true })
  } catch {}

  // CLS - Cumulative Layout Shift
  try {
    let clsValue = 0
    let sessionValue = 0
    let sessionEntries: PerformanceEntry[] = []

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as any
        if (!layoutShift.hadRecentInput) {
          const value = layoutShift.value
          sessionValue += value
          sessionEntries.push(entry)

          // Session gap: 1 second between shifts, max 5 seconds total
          const firstEntry = sessionEntries[0]
          if (entry.startTime - firstEntry.startTime > 5000) {
            sessionValue = value
            sessionEntries = [entry]
          }

          if (sessionValue > clsValue) {
            clsValue = sessionValue
          }

          if (vitalsBuffer) {
            vitalsBuffer.cls = Math.round(clsValue * 1000) / 1000
          }
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}

  // TTFB - Time to First Byte (from navigation timing)
  try {
    const navEntries = performance.getEntriesByType('navigation')
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming
      data.ttfb = Math.round(nav.responseStart - nav.requestStart)
    }
  } catch {}

  // Report function
  const report = () => {
    if (hasReported || !vitalsBuffer) return
    hasReported = true

    // Filter out undefined values
    const cleanData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(vitalsBuffer)) {
      if (value !== undefined) {
        cleanData[key] = value
      }
    }

    // Call custom callback if provided
    if (onReport) {
      onReport(vitalsBuffer)
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('[Web Vitals]', cleanData)
    }

    // In production, send to analytics endpoint via sendBeacon
    // Example:
    // if (navigator.sendBeacon) {
    //   navigator.sendBeacon('/api/vitals', JSON.stringify(cleanData))
    // }
  }

  // Report on page hide (most reliable)
  const handlePageHide = () => report()
  window.addEventListener('pagehide', handlePageHide)

  // Also report after a delay as fallback
  const timeoutId = setTimeout(report, 10000)

  // Return cleanup function
  return () => {
    window.removeEventListener('pagehide', handlePageHide)
    clearTimeout(timeoutId)
  }
}

/**
 * Get current vitals snapshot (for debugging)
 */
export function getCurrentVitals(): VitalsData | null {
  return vitalsBuffer
}

/**
 * Manually trigger vitals report
 */
export function reportVitals(): void {
  if (vitalsBuffer && !hasReported) {
    hasReported = true
    console.log('[Web Vitals] Manual report:', vitalsBuffer)
  }
}

/**
 * Performance marks for custom measurements
 */
export function markStart(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(`${name}:start`)
  }
}

export function markEnd(name: string): number | null {
  if (typeof performance === 'undefined' || !performance.mark || !performance.measure) {
    return null
  }

  performance.mark(`${name}:end`)
  try {
    performance.measure(name, `${name}:start`, `${name}:end`)
    const measures = performance.getEntriesByName(name, 'measure')
    if (measures.length > 0) {
      return measures[measures.length - 1].duration
    }
  } catch {}
  return null
}

/**
 * Measure async function duration
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  markStart(name)
  try {
    return await fn()
  } finally {
    markEnd(name)
  }
}

/**
 * Resource timing helpers
 */
export function getResourceTimings(): PerformanceResourceTiming[] {
  if (typeof performance === 'undefined') return []
  return performance.getEntriesByType('resource') as PerformanceResourceTiming[]
}

export function getSlowResources(thresholdMs = 500): PerformanceResourceTiming[] {
  return getResourceTimings()
    .filter(r => r.duration > thresholdMs)
    .sort((a, b) => b.duration - a.duration)
}

/**
 * Bundle size estimation (development only)
 */
export function estimateBundleSize(): Record<string, number> {
  if (!import.meta.env.DEV) return {}

  const resources = getResourceTimings()
  const sizes: Record<string, number> = {}

  for (const resource of resources) {
    if (resource.name.includes('/assets/js/') && resource.name.endsWith('.js')) {
      const name = resource.name.split('/').pop()?.replace(/-[a-f0-9]+\.js$/, '') || 'unknown'
      sizes[name] = (sizes[name] || 0) + (resource.transferSize || 0)
    }
  }

  return sizes
}

// Thresholds for Core Web Vitals (from web.dev/vitals)
export const VITALS_THRESHOLDS = {
  lcp: { good: 2500, needsImprovement: 4000 },      // ms
  fid: { good: 100, needsImprovement: 300 },        // ms
  inp: { good: 200, needsImprovement: 500 },        // ms
  cls: { good: 0.1, needsImprovement: 0.25 },       // score
  ttfb: { good: 800, needsImprovement: 1800 },      // ms
  fcp: { good: 1800, needsImprovement: 3000 },      // ms
} as const

export function getVitalsRating(vitals: Partial<WebVitals>): Record<string, 'good' | 'needs-improvement' | 'poor'> {
  const ratings: Record<string, 'good' | 'needs-improvement' | 'poor'> = {}

  for (const [key, value] of Object.entries(vitals)) {
    const threshold = VITALS_THRESHOLDS[key as keyof typeof VITALS_THRESHOLDS]
    if (threshold && value !== undefined) {
      if (value <= threshold.good) ratings[key] = 'good'
      else if (value <= threshold.needsImprovement) ratings[key] = 'needs-improvement'
      else ratings[key] = 'poor'
    }
  }

  return ratings
}