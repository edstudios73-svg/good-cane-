import { useEffect, useState } from 'react'

// Minimal hash router: static hosting needs no rewrite rules, and links shared
// on WhatsApp/TikTok keep working.

export interface Route {
  path: string
  query: URLSearchParams
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs = ''] = raw.split('?')
  return { path: path || '/', query: new URLSearchParams(qs) }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(to: string) {
  window.location.hash = to
}

export function href(to: string): string {
  return '#' + to
}

/** Absolute link to a route, e.g. for reminder messages. */
export function absoluteUrl(to: string): string {
  return `${window.location.origin}${window.location.pathname}#${to}`
}

const SOURCES = ['tiktok', 'instagram', 'whatsapp'] as const
type Campaign = (typeof SOURCES)[number] | 'direct'

/**
 * Where the visitor came from, from `?src=tiktok` on the page URL or hash.
 * Lets GoodCane see which channel turns discovery into orders.
 */
export function campaignSource(): Campaign {
  const fromPage = new URLSearchParams(window.location.search).get('src')
  const fromHash = parse().query.get('src')
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem('goodcane.src')
  } catch {
    // ignore
  }
  const src = fromPage ?? fromHash ?? stored
  if (src && (SOURCES as readonly string[]).includes(src)) {
    try {
      sessionStorage.setItem('goodcane.src', src)
    } catch {
      // ignore
    }
    return src as Campaign
  }
  return 'direct'
}
