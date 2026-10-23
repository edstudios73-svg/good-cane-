// The live menu: GoodCane's five juices plus anything staff add in the dashboard.
// Starts from the built-in catalogue so the shop renders instantly, then picks up
// prices, new juices and hidden items from the database.

import { useSyncExternalStore } from 'react'
import { PRODUCTS, TASTES } from '../domain/catalog'
import type { Product } from '../domain/types'
import { supabase } from './supabase'

interface ProductRow {
  id: string
  name: string
  active: boolean
  sort: number
  price_pesewas: number | null
  size: string
  taste: Product['taste']
  about: string
  ingredients: string
  accent: string
  photo_url: string | null
}

let menu: Product[] = PRODUCTS
const listeners = new Set<() => void>()

/** Label colour mixed 85% towards white, for card backgrounds. */
function tintOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.85)
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

/** A plain bottle in the juice's colour, until staff upload a photo. */
function bottleSketch(accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 300"><rect x="44" y="6" width="32" height="26" rx="5" fill="#f4f4f2" stroke="#d9d6d0"/><path d="M42 32h36v22c0 8 18 14 18 34v186a14 14 0 0 1-14 14H38a14 14 0 0 1-14-14V88c0-20 18-26 18-34z" fill="${accent}" opacity=".9"/><rect x="24" y="130" width="72" height="96" fill="#fff" opacity=".85"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function toProduct(r: ProductRow): Product {
  const known = PRODUCTS.find((p) => p.id === r.id)
  r = { ...r, accent: r.accent ?? known?.accent ?? '#2d753e', size: r.size ?? known?.size ?? '500 ml', price_pesewas: r.price_pesewas ?? null }
  const picture = r.photo_url ?? known?.bottle ?? bottleSketch(r.accent)
  return {
    id: r.id,
    name: r.name,
    short: known?.short ?? (r.name.replace(/\s*sugarcane\s*$/i, '') || r.name),
    about: r.about || known?.about || '',
    ingredients: r.ingredients || known?.ingredients || '',
    description: known?.description ?? '',
    taste: TASTES.includes(r.taste) ? r.taste : (known?.taste ?? 'Pure'),
    accent: known && !r.photo_url ? known.accent : r.accent,
    tint: known && !r.photo_url ? known.tint : tintOf(r.accent),
    bottle: picture,
    image: r.photo_url ?? known?.image ?? picture,
    price: r.price_pesewas,
    size: r.size || '500 ml',
    active: r.active,
  }
}

export async function reloadMenu(): Promise<void> {
  const { data, error } = await supabase.from('products').select('*').order('sort')
  if (error || !data?.length) return
  menu = (data as ProductRow[]).map(toProduct)
  listeners.forEach((l) => l())
}

let started = false
function subscribe(l: () => void) {
  listeners.add(l)
  if (!started) {
    started = true
    void reloadMenu()
  }
  return () => listeners.delete(l)
}

/** Juices on sale. Pass `all` for the dashboard, which also sees hidden ones. */
export function useMenu(all = false): Product[] {
  const list = useSyncExternalStore(subscribe, () => menu)
  return all ? list : list.filter((p) => p.active)
}

export function menuItem(id: string): Product | undefined {
  return menu.find((p) => p.id === id)
}

/** Pesewas to "GH₵ 25" or "GH₵ 25.50". */
export function formatPrice(pesewas: number): string {
  const cedis = pesewas / 100
  return `GH₵ ${Number.isInteger(cedis) ? cedis : cedis.toFixed(2)}`
}

/** Order total when every line carries a price, otherwise null. */
export function linesTotal(lines: { qty: number; price?: number | null }[]): number | null {
  if (!lines.length || lines.some((l) => l.price == null)) return null
  return lines.reduce((n, l) => n + l.qty * (l.price as number), 0)
}
