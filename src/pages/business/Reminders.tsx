import { formatCutoff, formatDay, openBatches } from '../../domain/batches'
import { reminderMessage, remindersDue } from '../../domain/reminders'
import { absoluteUrl } from '../../router'
import { useStore } from '../../store'

export function Reminders() {
  const { state, now, logReminder } = useStore()
  const batch = openBatches(now, 1)[0]
  const due = remindersDue(state.customers, state.orders, batch.id)
  const optedIn = state.customers.filter((c) => c.remindersOptIn).length
  const logged = state.reminderLog.filter((r) => r.batchId === batch.id)

  return (
    <div className="stack">
      <div className="notice">
        <strong>Sending is switched off.</strong> This prototype only previews messages. Nothing goes out until GoodCane approves the wording,
        channel and timing.
      </div>
      <p className="small">
        Batch {formatDay(batch.productionDate)} · cutoff {formatCutoff(batch.cutoff)}. {optedIn} of {state.customers.length} customers opted in.
        Due = opted in, ordered before, no order for this batch yet.
      </p>

      <h2 className="section-title">Due now ({due.length})</h2>
      {due.length === 0 && <p className="small">Everyone who opted in has already ordered for this batch.</p>}
      <ul className="order-cards">
        {due.map((c) => {
          const msg = reminderMessage(c, batch, absoluteUrl('/reorder?src=reminder'))
          const done = logged.some((r) => r.customerId === c.id)
          return (
            <li key={c.id} className="card">
              <div className="row-between">
                <strong>{c.name}</strong>
                <span className="mono small">{c.reminderChannel === 'sms' ? 'SMS' : 'WhatsApp'}</span>
              </div>
              <p className="msg-preview">{msg}</p>
              <button className="btn btn-sm" disabled={done} onClick={() => logReminder(c.id, batch.id, msg)}>
                {done ? '✓ Logged (not sent)' : 'Log preview (not sent)'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
