import { useState } from 'react'
import { formatCutoff, formatDay, openBatches } from '../../domain/batches'
import { formatOrderNumber } from '../../domain/orders'
import { remindersDue } from '../../domain/reminders'
import { maskPhone, smsBody } from '../../domain/sms'
import type { SmsKind, SmsStatus } from '../../domain/types'
import { useStaff } from '../../staff/StaffProvider'

const KIND_LABEL: Record<SmsKind, string> = {
  received: 'Order received',
  confirmed: 'Confirmed',
  paid: 'Payment received',
  fulfilled: 'Delivered',
  cancelled: 'Cancelled',
  reminder: 'Weekly reminder',
  login_code: 'Sign-in code',
}

const STATUS_LABEL: Record<SmsStatus, string> = {
  queued: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  skipped: 'Not sent',
}

export function Messages() {
  const { state, now, sendReminders } = useStaff()
  const [flash, setFlash] = useState('')
  const batch = openBatches(now, 1)[0]
  const alreadyReminded = new Set(state.smsLog.filter((m) => m.kind === 'reminder' && m.batchId === batch.id).map((m) => m.customerId))
  const sent = state.smsLog.filter((m) => m.status === 'sent').length
  const failed = state.smsLog.filter((m) => m.status === 'failed').length
  const due = remindersDue(state.customers, state.orders, batch.id).filter((c) => !alreadyReminded.has(c.id))
  const optedIn = state.customers.filter((c) => c.remindersOptIn).length
  const log = [...state.smsLog].sort((a, b) => b.at.localeCompare(a.at))
  const orderNo = (id?: string | null) => {
    const o = state.orders.find((x) => x.id === id)
    return o ? formatOrderNumber(o.number) : ''
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row-between wrap">
          <div>
            <h2>Weekly reminder · {formatDay(batch.productionDate)}</h2>
            <p className="small muted">
              Orders close {formatCutoff(batch.cutoff)}. {optedIn} customers have opted in. {due.length} haven't ordered or been reminded yet.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={due.length === 0}
            onClick={async () => {
              if (!confirm(`Text the reminder to ${due.length} customer${due.length === 1 ? '' : 's'}?`)) return
              try {
                const n = await sendReminders(batch.id)
                setFlash(`${n} reminder${n === 1 ? '' : 's'} sent.`)
              } catch (e) {
                setFlash((e as Error).message)
              }
            }}
          >
            Send reminder to {due.length}
          </button>
        </div>
        <p className="msg-preview">{smsBody('reminder', { batchId: batch.id })}</p>
        {flash && <p className="small">{flash}</p>}
      </section>

      <section className="card table-wrap">
        <div className="row-between wrap">
          <h2>Message log</h2>
          <span className="small muted">
            {sent} sent · {failed} failed
          </span>
        </div>
        {log.length === 0 ? (
          <p className="small muted">No texts yet. Customers get one when they order and whenever you change their order.</p>
        ) : (
          <table className="demand-table sms-table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Type</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => {
                const c = state.customers.find((x) => x.id === m.customerId)
                return (
                  <tr key={m.id}>
                    <td className="nowrap small">
                      {new Date(m.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="nowrap small">
                      {c?.name}
                      <br />
                      <span className="muted">{maskPhone(m.to)}</span>
                    </td>
                    <td className="nowrap small">
                      {KIND_LABEL[m.kind]} {orderNo(m.orderId)}
                    </td>
                    <td className="small sms-body">{m.body}</td>
                    <td>
                      <span className={`sms-status sms-${m.status}`}>{STATUS_LABEL[m.status]}</span>
                      {m.error && <p className="small muted sms-error">{m.error}</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
