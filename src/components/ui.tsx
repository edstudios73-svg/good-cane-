import type { ReactNode } from 'react'
import { STATUS_LABEL } from '../domain/orders'
import { PRODUCTS } from '../domain/seed'
import type { OrderLine, OrderStatus } from '../domain/types'

export function Bottle({ colour, size = 56 }: { colour: string; size?: number }) {
  return (
    <svg width={size * 0.55} height={size} viewBox="0 0 44 80" aria-hidden="true" className="bottle">
      <rect x="15" y="2" width="14" height="8" rx="2" fill="#0b0b0b" />
      <path d="M15 10h14v6c0 2 8 5 8 12v44a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6V28c0-7 8-10 8-12z" fill="#fff" stroke="#0b0b0b" strokeWidth="2" />
      <path d="M9 34h26v38a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4z" fill={colour} />
      <rect x="11" y="42" width="22" height="16" rx="2" fill="#fbf7ee" stroke="#0b0b0b" strokeWidth="1.5" />
      <path d="M15 48h14M15 52h10" stroke="#0b0b0b" strokeWidth="1.5" />
    </svg>
  )
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>
}

export function Logo() {
  return (
    <span className="logo" aria-label="GoodCane">
      <span>GOOD</span>
      <span>CANE</span>
    </span>
  )
}

export function SampleTag({ children = 'Sample data' }: { children?: ReactNode }) {
  return <span className="sample-tag">{children}</span>
}

export function productName(id: string): string {
  return PRODUCTS.find((p) => p.id === id)?.name ?? id
}

export function LinesList({ lines }: { lines: OrderLine[] }) {
  return (
    <ul className="lines">
      {lines.map((l) => (
        <li key={l.productId}>
          <span>{productName(l.productId)}</span>
          <span className="mono">× {l.qty}</span>
        </li>
      ))}
    </ul>
  )
}

export function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity of ${label}`}>
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
