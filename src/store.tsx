import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isOpen } from './domain/batches'
import { cleanLines, normalisePhone, transition } from './domain/orders'
import { STATE_VERSION, createSeedState } from './domain/seed'
import type { AppState, BatchRecord, Customer, Fulfilment, Order, OrderLine, OrderStatus, Source } from './domain/types'

// Prototype persistence: one shared state object in this browser's
// localStorage. The customer and business views read the same data, so the
// end-to-end flow works on one device. A pilot would move this to a database.
const STATE_KEY = 'goodcane.state'
const ME_KEY = 'goodcane.me'

function load(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as AppState
      if (s.version === STATE_VERSION) return s
    }
  } catch {
    // Storage blocked or corrupt — fall back to fresh sample data.
  }
  return createSeedState(new Date())
}

function save(s: AppState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s))
  } catch {
    // Ignore: the demo still works for this session.
  }
}

function loadMe(): string | null {
  try {
    return localStorage.getItem(ME_KEY)
  } catch {
    return null
  }
}

function saveMe(phone: string | null) {
  try {
    if (phone) localStorage.setItem(ME_KEY, phone)
    else localStorage.removeItem(ME_KEY)
  } catch {
    // ignore
  }
}

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export interface NewOrder {
  name: string
  phone: string
  batchId: string
  lines: OrderLine[]
  fulfilment: Fulfilment
  location: string
  note?: string
  remindersOptIn: boolean
  reminderChannel: 'whatsapp' | 'sms'
  source: Source
  reorderOf?: string
}

interface Store {
  state: AppState
  now: Date
  /** Phone remembered on this device for "My orders". */
  me: string | null
  meCustomer: Customer | undefined
  setMe: (phone: string | null) => void
  placeOrder: (o: NewOrder) => Order
  customerCancel: (orderId: string) => void
  businessMove: (orderId: string, to: OrderStatus, note?: string) => void
  setReminders: (customerId: string, optIn: boolean, channel?: 'whatsapp' | 'sms') => void
  forgetCustomer: (customerId: string) => void
  logReminder: (customerId: string, batchId: string, message: string) => void
  saveBatchRecord: (r: BatchRecord) => void
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load)
  const [me, setMeState] = useState<string | null>(loadMe)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => save(state), [state])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  // Keep tabs in sync (e.g. customer view in one tab, business view in another).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATE_KEY) setState(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setMe = useCallback((phone: string | null) => {
    const p = phone ? normalisePhone(phone) : null
    setMeState(p)
    saveMe(p)
  }, [])

  const updateOrder = (orderId: string, fn: (o: Order) => Order) =>
    setState((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? fn(o) : o)) }))

  // Latest state, so placeOrder can return the created order synchronously.
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  const placeOrder = useCallback(
    (input: NewOrder): Order => {
      const s = stateRef.current
      const phone = normalisePhone(input.phone)
      const t = new Date()
      const existing = s.customers.find((c) => c.phone === phone)
      const customer: Customer = existing
        ? { ...existing, name: input.name.trim(), remindersOptIn: input.remindersOptIn, reminderChannel: input.reminderChannel }
        : {
            id: uid('cus'),
            name: input.name.trim(),
            phone,
            remindersOptIn: input.remindersOptIn,
            reminderChannel: input.reminderChannel,
            createdAt: t.toISOString(),
            sample: false,
          }
      const created: Order = {
        id: uid('ord'),
        number: s.nextOrderNumber,
        customerId: customer.id,
        batchId: input.batchId,
        lines: cleanLines(input.lines),
        fulfilment: input.fulfilment,
        location: input.location,
        note: input.note?.trim() || undefined,
        status: 'requested',
        history: [{ status: 'requested', at: t.toISOString(), by: 'customer' }],
        source: input.source,
        reorderOf: input.reorderOf,
        createdAt: t.toISOString(),
        sample: false,
      }
      const next: AppState = {
        ...s,
        customers: existing ? s.customers.map((c) => (c.id === customer.id ? customer : c)) : [...s.customers, customer],
        orders: [...s.orders, created],
        nextOrderNumber: s.nextOrderNumber + 1,
      }
      stateRef.current = next
      setState(next)
      setMe(phone)
      return created
    },
    [setMe],
  )

  const value = useMemo<Store>(
    () => ({
      state,
      now,
      me,
      meCustomer: me ? state.customers.find((c) => c.phone === me) : undefined,
      setMe,
      placeOrder,
      customerCancel: (orderId) => updateOrder(orderId, (o) => transition(o, 'cancelled', 'customer', new Date(), 'Cancelled by customer')),
      businessMove: (orderId, to, note) => updateOrder(orderId, (o) => transition(o, to, 'business', new Date(), note)),
      setReminders: (customerId, optIn, channel) =>
        setState((s) => ({
          ...s,
          customers: s.customers.map((c) => (c.id === customerId ? { ...c, remindersOptIn: optIn, reminderChannel: channel ?? c.reminderChannel } : c)),
        })),
      forgetCustomer: (customerId) => {
        // Anonymise rather than delete so the business keeps aggregate demand history.
        // Unpaid orders for batches that are still open are cancelled.
        const t = new Date()
        setState((s) => ({
          ...s,
          customers: s.customers.map((c) => (c.id === customerId ? { ...c, name: 'Deleted customer', phone: '', remindersOptIn: false } : c)),
          orders: s.orders.map((o) => {
            if (o.customerId !== customerId) return o
            const cancel = (o.status === 'requested' || o.status === 'confirmed') && isOpen(o.batchId, t)
            return {
              ...o,
              note: undefined,
              ...(cancel && {
                status: 'cancelled' as const,
                history: [...o.history, { status: 'cancelled' as const, at: t.toISOString(), by: 'customer' as const, note: 'Customer deleted their details' }],
              }),
            }
          }),
        }))
        setMe(null)
      },
      logReminder: (customerId, batchId, message) =>
        setState((s) => ({ ...s, reminderLog: [...s.reminderLog, { id: uid('rem'), customerId, batchId, message, at: new Date().toISOString() }] })),
      saveBatchRecord: (r) =>
        setState((s) => ({ ...s, batchRecords: [...s.batchRecords.filter((x) => x.batchId !== r.batchId), r] })),
      resetDemo: () => {
        setState(createSeedState(new Date()))
        setMe(null)
      },
    }),
    [state, now, me, setMe, placeOrder],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
