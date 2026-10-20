import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CUSTOMER_STATUS_LABEL, STATUS_LABEL } from '../domain/orders'
import { PRODUCTS } from '../domain/catalog'
import type { OrderLine, OrderStatus, Product } from '../domain/types'

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}

export function productName(id: string): string {
  return productById(id)?.name ?? id
}

/** The bottle standing on its flavour colour (white photo background multiplies into the tint). */
export function BottleTile({ product, className = '', alt = '' }: { product: Product; className?: string; alt?: string }) {
  return (
    <span className={`bottle-tile ${className}`} style={{ background: product.tint }}>
      <img src={product.bottle} alt={alt} loading="lazy" />
    </span>
  )
}

export function ProductThumb({ product, size = 48 }: { product: Product; size?: number }) {
  return (
    <span className="thumb" style={{ width: size, height: size, background: product.tint }}>
      <img src={product.bottle} alt="" loading="lazy" />
    </span>
  )
}

/** "Mint & Lemon" bold over "Sugarcane juice" light, like a product label. */
export function FlavourTitle({ product, as: Tag = 'h3' }: { product: Product; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <Tag className="ftitle">
      <span>{product.short}</span>
      <span className="ftitle-sub">Sugarcane juice</span>
    </Tag>
  )
}

export function FlavourDot({ id }: { id: string }) {
  return <span className="dot" style={{ background: productById(id)?.accent ?? '#999' }} aria-hidden="true" />
}

export function StatusPill({ status, customer }: { status: OrderStatus; customer?: boolean }) {
  return <span className={`pill pill-${status}`}>{(customer ? CUSTOMER_STATUS_LABEL : STATUS_LABEL)[status]}</span>
}

export function Logo({ size = 40 }: { size?: number }) {
  return <img className="logo" src={`${import.meta.env.BASE_URL}img/logo.png`} alt="GoodCane" width={size} height={size} />
}

export function SampleTag({ children = 'Sample data' }: { children?: ReactNode }) {
  return <span className="sample-tag">{children}</span>
}

export function LinesList({ lines }: { lines: OrderLine[] }) {
  return (
    <ul className="lines">
      {lines.map((l) => (
        <li key={l.productId}>
          <span className="line-name">
            <FlavourDot id={l.productId} />
            {productName(l.productId)}
          </span>
          <span className="mono">× {l.qty}</span>
        </li>
      ))}
    </ul>
  )
}

export function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className={`stepper ${value ? 'on' : ''}`} role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Remove one ${label}`}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(24, value + 1))} aria-label={`Add one ${label}`}>
        +
      </button>
    </div>
  )
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Number that eases from its previous value to the new one. */
export function CountUp({ value, format = (n: number) => String(n) }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value)
      from.current = value
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(a + (value - a) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(Math.round(shown * 100) / 100)}</>
}

/** Countdown to a deadline in days, hours and minutes. */
export function Countdown({ until }: { until: Date }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, until.getTime() - now)
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor(ms / 3_600_000) % 24
  const m = Math.floor(ms / 60_000) % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (ms === 0) return <span className="countdown-val">Closed</span>
  return (
    <span className="countdown-val" role="timer" aria-label={`${d} days ${h} hours ${m} minutes left`}>
      <span>
        {d}
        <small>d</small>
      </span>
      <span>
        {pad(h)}
        <small>h</small>
      </span>
      <span>
        {pad(m)}
        <small>m</small>
      </span>
    </span>
  )
}
