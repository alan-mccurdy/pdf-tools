#!/usr/bin/env node
/**
 * IndexNow Ping Script for PDF Tools
 * Notifies search engines (Bing, Yandex, Seznam, etc.) of URL changes
 * Run after deploy to speed up indexing
 *
 * Usage:
 *   node scripts/indexnow-ping.mjs                    # Ping all URLs from sitemap
 *   node scripts/indexnow-ping.mjs --urls=https://... # Ping specific URLs
 *   node scripts/indexnow-ping.mjs --key=your-key     # Use custom IndexNow key
 *
 * Get a key at: https://www.indexnow.org/
 * Key must be hosted at: https://alan-mccurdy.github.io/pdf-tools/{key}.txt
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = 'https://alan-mccurdy.github.io/pdf-tools'
const SITEMAP_PATH = resolve('public/sitemap.xml')
const DEFAULT_KEY = 'rnf3m7x5y7xj4856w3ybj' // Change this to a random string

// IndexNow endpoints
const ENDPOINTS = [
  'https://api.indexnow.org/indexnow',           // Main endpoint (Bing, Yandex, etc.)
  'https://www.bing.com/indexnow',               // Bing direct
  'https://yandex.com/indexnow',                 // Yandex direct
]

function parseArgs() {
  const args = process.argv.slice(2)
  const result: Record<string, string> = {}

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      result[key] = value || 'true'
    }
  }

  return result
}

function parseSitemap(): string[] {
  try {
    const content = readFileSync(SITEMAP_PATH, 'utf-8')
    const urls = content.match(/<loc>(.*?)<\/loc>/g)
    if (!urls) return []
    return urls.map(u => u.replace(/<\/?loc>/g, '').trim())
  } catch {
    console.warn('⚠️  Could not read sitemap, using default routes')
    return []
  }
}

async function pingIndexNow(urls: string[], key: string, keyLocation: string) {
  const payload = {
    host: new URL(BASE_URL).hostname,
    key,
    keyLocation,
    urlList: urls,
  }

  console.log(`📤 Pinging ${urls.length} URLs to IndexNow...`)
  console.log(`🔑 Key: ${key}`)
  console.log(`📍 Key Location: ${keyLocation}`)

  const results = await Promise.allSettled(
    ENDPOINTS.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify(payload),
        })

        const text = await response.text()
        return { endpoint, status: response.status, ok: response.ok, text }
      } catch (error) {
        return { endpoint, status: 0, ok: false, text: String(error) }
      }
    })
  )

  console.log('\n📊 Results:')
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { endpoint, status, ok, text } = result.value
      const icon = ok ? '✅' : '❌'
      console.log(`  ${icon} ${endpoint}: ${status} ${ok ? 'OK' : 'FAILED'}`)
      if (!ok && text) console.log(`     ${text}`)
    } else {
      console.log(`  ❌ ${result.reason}`)
    }
  }

  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
  console.log(`\n${successCount > 0 ? '🎉' : '⚠️'} ${successCount}/${ENDPOINTS.length} endpoints succeeded`)

  return successCount > 0
}

async function main() {
  const args = parseArgs()

  // Get URLs to ping
  let urls: string[]
  if (args.urls) {
    urls = args.urls.split(',').map(u => u.trim())
  } else {
    urls = parseSitemap()
    if (urls.length === 0) {
      // Fallback to known routes
      urls = [
        `${BASE_URL}/`,
        `${BASE_URL}/editar-pdf`,
        `${BASE_URL}/unir-pdf`,
        `${BASE_URL}/word-a-pdf`,
        `${BASE_URL}/pdf-a-word`,
        `${BASE_URL}/separar-pdf`,
        `${BASE_URL}/rotar-pdf`,
        `${BASE_URL}/comprimir-pdf`,
        `${BASE_URL}/eliminar-paginas`,
        `${BASE_URL}/insertar-imagenes`,
        `${BASE_URL}/ocr-pdf`,
        `${BASE_URL}/privacidad`,
        `${BASE_URL}/terminos`,
        `${BASE_URL}/acerca`,
        `${BASE_URL}/contacto`,
      ]
    }
  }

  // Deduplicate
  urls = [...new Set(urls)]

  // Get key
  const key = args.key || DEFAULT_KEY
  const keyLocation = `${BASE_URL}/${key}.txt`

  console.log('🚀 IndexNow Ping - PDF Tools')
  console.log('==============================\n')

  const success = await pingIndexNow(urls, key, keyLocation)

  if (success) {
    console.log('\n✅ IndexNow ping completed successfully')
    console.log('💡 Search engines will crawl your URLs faster now')
  } else {
    console.log('\n⚠️  IndexNow ping had issues')
    console.log('💡 Check your key is hosted at:', keyLocation)
    console.log('💡 Generate a key at: https://www.indexnow.org/')
    process.exit(1)
  }
}

main().catch(console.error)