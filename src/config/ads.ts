/**
 * Self-hosted ad system for PDF Tools
 * Zero-cost, privacy-respecting advertising for open-source projects
 * No tracking, no third-party cookies, no external dependencies
 */

export interface HouseAd {
  id: string
  title: string
  description: string
  cta: string
  url: string
  icon?: React.ReactNode
  category: 'own-project' | 'affiliate' | 'community'
  weight: number // Higher = more likely to show
  target?: '_blank' | '_self'
}

export interface AdConfig {
  // AdSense (optional - only used if configured)
  adsense?: {
    client: string
    slots: {
      top: string
      sidebar: string
      bottom: string
    }
    enabled: boolean
  }
  // House ads (always available, zero cost)
  houseAds: HouseAd[]
  // Display settings
  rotationInterval: number // ms
  maxHouseAdsPerSlot: number
}

// Your open-source projects to cross-promote
export const houseAds: HouseAd[] = [
  {
    id: 'auto-yt-shorts',
    title: 'Auto YouTube Shorts',
    description: 'Pipeline autónomo para crear Shorts con IA. n8n + Python + multi-model LLM.',
    cta: 'Ver en GitHub',
    url: 'https://github.com/alan-mccurdy/auto-yt-shorts',
    category: 'own-project',
    weight: 10,
    target: '_blank',
  },
  {
    id: 'soap-optimizer',
    title: 'SOAP Optimizer',
    description: 'Entrenamiento de modelos con Adam + Shampoo. Optimizador de 2º orden eficiente.',
    cta: 'Ver en GitHub',
    url: 'https://github.com/alan-mccurdy/SOAP',
    category: 'own-project',
    weight: 8,
    target: '_blank',
  },
  {
    id: 'alan-mccurdy-web',
    title: 'Portfolio & Blog',
    description: 'Proyectos, artículos técnicos y experimentos con IA local.',
    cta: 'Visitar web',
    url: 'https://alan-mccurdy.github.io',
    category: 'own-project',
    weight: 6,
    target: '_blank',
  },
  {
    id: 'pdf-tools-star',
    title: '¿Te gusta PDF Tools?',
    description: 'Dale una estrella en GitHub y comparte. Nos ayuda a crecer sin publicidad invasiva.',
    cta: 'Dar ⭐ en GitHub',
    url: 'https://github.com/alan-mccurdy/pdf-tools',
    category: 'own-project',
    weight: 5,
    target: '_blank',
  },
  {
    id: 'n8n-community',
    title: 'n8n Workflows',
    description: 'Workflow de n8n para automatización con IA. Listo para importar.',
    cta: 'Ver workflows',
    url: 'https://github.com/alan-mccurdy/n8n-workflows',
    category: 'community',
    weight: 4,
    target: '_blank',
  },
]

// Default config - AdSense disabled by default (requires approval)
export const defaultAdConfig: AdConfig = {
  adsense: {
    client: 'ca-pub-XXXXXXXXXXXXXXXX',
    slots: {
      top: 'XXXXXXXXXX',
      sidebar: 'XXXXXXXXXX',
      bottom: 'XXXXXXXXXX',
    },
    enabled: false, // Set to true ONLY after AdSense approval
  },
  houseAds,
  rotationInterval: 30000, // 30 seconds
  maxHouseAdsPerSlot: 1,
}

// Helper to pick weighted random ad
export function pickWeightedAd(ads: HouseAd[]): HouseAd {
  const totalWeight = ads.reduce((sum, ad) => sum + ad.weight, 0)
  let random = Math.random() * totalWeight
  for (const ad of ads) {
    random -= ad.weight
    if (random <= 0) return ad
  }
  return ads[0]
}

// Get ads for a specific position (can filter by category later)
export function getAdsForPosition(_position: 'top' | 'sidebar' | 'bottom', config: AdConfig = defaultAdConfig): HouseAd[] {
  const count = config.maxHouseAdsPerSlot
  const shuffled = [...config.houseAds].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function isAdsenseConfigured(config: AdConfig = defaultAdConfig): boolean {
  return config.adsense?.enabled === true &&
    config.adsense.client !== 'ca-pub-XXXXXXXXXXXXXXXX' &&
    !config.adsense.client.includes('XXXXXXXX')
}