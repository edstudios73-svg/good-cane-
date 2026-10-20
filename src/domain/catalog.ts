// The menu. Flavour names, label colours and photos come from GoodCane's own
// posts; bottle sizes and prices are confirmed per order.

import type { Product } from './types'

const img = (id: string) => `/img/${id}.webp`

export const PRODUCTS: Product[] = [
  {
    id: 'mint-lemon',
    name: 'Mint & Lemon Sugarcane',
    short: 'Mint & Lemon',
    about: 'Fresh mint and lemon pressed with sugarcane. Bright and sour up front, cooling at the end. The one to reach for on a hot afternoon.',
    ingredients: 'Mint · Lemon · Sugarcane',
    description: 'Bright, sour and cooling.',
    accent: '#2d753e',
    tint: '#e2edd6',
    image: img('mint-lemon'),
    bottle: img('mint-lemon-bottle'),
  },
  {
    id: 'passion',
    name: 'Passion Fruit Sugarcane',
    short: 'Passion Fruit',
    about: 'Ripe passion fruit with raw sugarcane. Sweet, tangy and properly tropical.',
    ingredients: 'Passion fruit · Sugarcane',
    description: 'Sweet, tangy, tropical.',
    accent: '#6f35a3',
    tint: '#ece0f6',
    image: img('passion'),
    bottle: img('passion-bottle'),
  },
  {
    id: 'lemon-ginger',
    name: 'Lemon & Ginger Sugarcane',
    short: 'Lemon & Ginger',
    about: 'Lemon and fresh ginger with sugarcane. Zesty first, then a warm ginger kick.',
    ingredients: 'Lemon · Ginger · Sugarcane',
    description: 'Zesty with a warm ginger kick.',
    accent: '#c0603a',
    tint: '#f9e3d2',
    image: img('lemon-ginger'),
    bottle: img('lemon-ginger-bottle'),
  },
  {
    id: 'tigernut-coconut',
    name: 'Tigernut & Coconut Sugarcane',
    short: 'Tigernut & Coconut',
    about: 'Tigernut and coconut blended with sugarcane. Creamy, nutty and smooth, closer to a treat.',
    ingredients: 'Tigernut · Coconut · Sugarcane',
    description: 'Creamy, nutty, smooth.',
    accent: '#6f665e',
    tint: '#ede8e2',
    image: img('tigernut-coconut'),
    bottle: img('tigernut-coconut-bottle'),
  },
  {
    id: 'raw',
    name: 'Raw Sugarcane',
    short: 'Raw',
    about: 'Nothing but pressed sugarcane. Naturally sweet and light. Just the cane.',
    ingredients: '100% sugarcane',
    description: 'Just pressed. Nothing else.',
    accent: '#7f8a2e',
    tint: '#eeefcf',
    image: img('raw'),
    bottle: img('raw-bottle'),
  },
]

// The shop location is from GoodCane's public profile; the second pickup point
// and all delivery areas are placeholders until GoodCane confirms them.
export const PICKUP_POINTS = ['GoodCane shop · Aviation Road, Adenta', 'Pickup point B (sample)']
export const DELIVERY_AREAS = ['Delivery area 1 (sample)', 'Delivery area 2 (sample)', 'Delivery area 3 (sample)']
