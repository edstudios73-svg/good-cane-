import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { errorMessage, supabase } from '../lib/supabase'
import type { AppState, BatchRecord, Customer, Order, OrderStatus, SmsLog } from '../domain/types'

interface Staff {
  session: Session | null
  /** null while checking. */
  isStaff: boolean | null
  loading: boolean
  now: Date
  state: AppState
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  reload: () => Promise<void>
  businessMove: (orderId: string, to: OrderStatus, note?: string, notify?: boolean) => Promise<void>
  sendReminders: (batchId: string) => Promise<number>
  saveBatchRecord: (r: BatchRecord) => Promise<void>
}

const EMPTY: AppState = { customers: [], orders: [], batchRecords: [], smsLog: [] }

const toCustomer = (r: any): Customer => ({
  id: r.id,
  name: r.name,
  phone: r.phone ?? '',
  remindersOptIn: r.reminders_opt_in,
  reminderChannel: 'sms',
  createdAt: r.created_at,
  sample: r.is_sample,
})

const toOrder = (r: any): Order => ({
  id: r.id,
  number: r.number,
  customerId: r.customer_id,
  batchId: r.batch_date,
  lines: r.lines,
  fulfilment: r.fulfilment,
  location: r.location,
  note: r.note ?? undefined,
  status: r.status,
  history: r.history,
  source: r.source,
  reorderOf: r.reorder_of ?? undefined,
  createdAt: r.created_at,
  sample: r.is_sample,
})

const toRecord = (r: any): BatchRecord => ({ batchId: r.batch_date, forecast: r.forecast ?? undefined, produced: r.produced ?? undefined, sold: r.sold ?? undefined })

const toSms = (r: any): SmsLog => ({
  id: r.id,
  customerId: r.customer_id,
  orderId: r.order_id,
  batchId: r.batch_date,
  kind: r.kind,
  to: r.to_phone,
  body: r.body,
  status: r.status,
  at: r.created_at,
  error: r.error,
})

const Ctx = createContext<Staff | null>(null)

export function StaffProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)
  const [state, setState] = useState<AppState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setIsStaff(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => {
      data.subscription.unsubscribe()
      clearInterval(t)
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    await supabase.rpc('staff_refresh_sms')
    const [c, o, b, m] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('batch_records').select('*'),
      supabase.from('sms_log').select('*').order('created_at', { ascending: false }).limit(500),
    ])
    setState({
      customers: (c.data ?? []).map(toCustomer),
      orders: (o.data ?? []).map(toOrder),
      batchRecords: (b.data ?? []).map(toRecord),
      smsLog: (m.data ?? []).map(toSms),
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!session) {
      setState(EMPTY)
      return
    }
    void supabase.rpc('is_staff').then(({ data }) => {
      setIsStaff(Boolean(data))
      if (data) void reload()
    })
  }, [session, reload])

  // New orders and SMS delivery updates appear without refreshing the page.
  const pending = useRef<number | null>(null)
  useEffect(() => {
    if (!isStaff) return
    const ch = supabase
      .channel('staff-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => schedule())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_log' }, () => schedule())
      .subscribe()
    function schedule() {
      if (pending.current) window.clearTimeout(pending.current)
      pending.current = window.setTimeout(() => void reload(), 400)
    }
    const poll = setInterval(() => void reload(), 60_000)
    return () => {
      void supabase.removeChannel(ch)
      clearInterval(poll)
    }
  }, [isStaff, reload])

  const value = useMemo<Staff>(
    () => ({
      session,
      isStaff,
      loading,
      now,
      state,
      reload,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : errorMessage(error))
      },
      signOut: async () => {
        await supabase.auth.signOut()
        setIsStaff(false)
      },
      businessMove: async (orderId, to, note, notify = true) => {
        const { error } = await supabase.rpc('staff_set_status', { p_order: orderId, p_status: to, p_note: note ?? null, p_notify: notify })
        if (error) throw new Error(errorMessage(error))
        await reload()
      },
      sendReminders: async (batchId) => {
        const { data, error } = await supabase.rpc('staff_send_reminders', { p_batch: batchId })
        if (error) throw new Error(errorMessage(error))
        await reload()
        return data as number
      },
      saveBatchRecord: async (r) => {
        const { error } = await supabase
          .from('batch_records')
          .upsert({ batch_date: r.batchId, forecast: r.forecast ?? null, produced: r.produced ?? null, sold: r.sold ?? null, updated_at: new Date().toISOString() })
        if (error) throw new Error(errorMessage(error))
        await reload()
      },
    }),
    [session, isStaff, loading, now, state, reload],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStaff(): Staff {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStaff outside StaffProvider')
  return s
}
