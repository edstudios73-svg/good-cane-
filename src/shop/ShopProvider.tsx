import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { errorMessage, supabase } from '../lib/supabase'
import type { Fulfilment, Me, Order, OrderLine, SmsLog, Source } from '../domain/types'

const TOKEN_KEY = 'goodcane.token'
const RECENT_KEY = 'goodcane.recent'
const BASKET_KEY = 'goodcane.basket'
const FAV_KEY = 'goodcane.favourites'

export type Basket = Record<string, number>

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private mode; the session still works
  }
}

export interface NewOrder {
  name: string
  phone: string
  batchId: string
  lines: OrderLine[]
  fulfilment: Fulfilment
  location: string
  note?: string
  remindersOptIn: boolean
  source: Source
  reorderOf?: string
}

interface Account {
  customer: Me
  orders: Order[]
  sms: SmsLog[]
}

interface Shop {
  now: Date
  ready: boolean
  me: Me | undefined
  orders: Order[]
  sms: SmsLog[]
  basket: Basket
  setBasketQty: (productId: string, qty: number) => void
  clearBasket: () => void
  /** Replace the basket, e.g. with a past order to repeat it. */
  fillBasket: (b: Basket) => void
  favourites: string[]
  toggleFavourite: (productId: string) => void
  /** Short confirmation shown at the bottom of the screen. */
  toast: string | null
  flash: (message: string) => void
  placeOrder: (o: NewOrder) => Promise<Order>
  /** An order this phone can see: from the account, or one placed here before signing in. */
  loadOrder: (id: string) => Promise<{ order: Order; sms: SmsLog[] } | null>
  cancelOrder: (order: Order) => Promise<void>
  setReminders: (on: boolean) => Promise<void>
  requestCode: (phone: string) => Promise<void>
  verifyCode: (phone: string, code: string) => Promise<void>
  signOut: () => void
  forgetMe: () => Promise<void>
}

const Ctx = createContext<Shop | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => read(TOKEN_KEY, null))
  const [recent, setRecent] = useState<Record<string, string>>(() => read(RECENT_KEY, {}))
  const [account, setAccount] = useState<Account | null>(null)
  const [ready, setReady] = useState(false)
  const [basket, setBasket] = useState<Basket>(() => read(BASKET_KEY, {}))
  const [now, setNow] = useState(() => new Date())
  const [favourites, setFavourites] = useState<string[]>(() => read(FAV_KEY, []))
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => write(FAV_KEY, favourites), [favourites])

  const flash = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => write(BASKET_KEY, basket), [basket])
  useEffect(() => write(RECENT_KEY, recent), [recent])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const setToken = (t: string | null) => {
    setTokenState(t)
    write(TOKEN_KEY, t)
  }

  const refresh = useCallback(async (t: string | null) => {
    if (!t) {
      setAccount(null)
      setReady(true)
      return
    }
    const { data, error } = await supabase.rpc('my_account', { p_token: t })
    if (error) {
      setReady(true)
      return
    }
    if (!data) {
      setToken(null)
      setAccount(null)
    } else setAccount(data as Account)
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh(token)
  }, [token, refresh])

  const value = useMemo<Shop>(() => {
    const call = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) throw new Error(errorMessage(error))
      return data as T
    }

    return {
      now,
      ready,
      me: account?.customer,
      orders: account?.orders ?? [],
      sms: account?.sms ?? [],
      basket,
      setBasketQty: (productId, qty) =>
        setBasket((b) => {
          const next = { ...b }
          if (qty > 0) next[productId] = qty
          else delete next[productId]
          return next
        }),
      clearBasket: () => setBasket({}),
      fillBasket: (b) => setBasket({ ...b }),
      favourites,
      toggleFavourite: (id) => setFavourites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
      toast,
      flash,

      placeOrder: async (o) => {
        const res = await call<{ order: Order; token: string | null }>('place_order', {
          p_name: o.name,
          p_phone: o.phone,
          p_batch: o.batchId,
          p_lines: o.lines,
          p_fulfilment: o.fulfilment,
          p_location: o.location,
          p_note: o.note ?? null,
          p_reminders: o.remindersOptIn,
          p_source: o.source,
          p_reorder_of: o.reorderOf ?? null,
          p_token: token,
        })
        if (res.order.viewToken) setRecent((r) => ({ ...r, [res.order.id]: res.order.viewToken! }))
        if (res.token && res.token !== token) setToken(res.token)
        else await refresh(token)
        return res.order
      },

      loadOrder: async (id) => {
        const own = account?.orders.find((x) => x.id === id)
        if (own) return { order: own, sms: (account?.sms ?? []).filter((m) => m.orderId === id) }
        const vt = recent[id]
        if (!vt) return null
        return call<{ order: Order; sms: SmsLog[] } | null>('order_by_view_token', { p_view_token: vt })
      },

      cancelOrder: async (order) => {
        await call('cancel_order', { p_order: order.id, p_token: token ?? recent[order.id] ?? null })
        await refresh(token)
      },

      setReminders: async (on) => {
        if (!token) return
        await call('set_reminders', { p_token: token, p_on: on })
        await refresh(token)
      },

      requestCode: (phone) => call('request_login_code', { p_phone: phone }),

      verifyCode: async (phone, code) => {
        const t = await call<string | null>('verify_login_code', { p_phone: phone, p_code: code })
        if (!t) throw new Error("We couldn't find orders for that number.")
        setToken(t)
      },

      signOut: () => {
        setToken(null)
        setRecent({})
      },

      forgetMe: async () => {
        if (!token) return
        await call('forget_me', { p_token: token })
        setToken(null)
        setRecent({})
      },
    }
  }, [now, ready, account, basket, token, recent, refresh, favourites, toast, flash])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useShop(): Shop {
  const s = useContext(Ctx)
  if (!s) throw new Error('useShop outside ShopProvider')
  return s
}
