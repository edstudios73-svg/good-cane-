import { useEffect, useState } from 'react'
import { useStaff } from '../../staff/StaffProvider'

const JOBS = [
  { key: 'auto_reminder', title: 'Last call', when: 'Thursdays, 9am', what: 'Opted-in regulars who haven’t ordered yet get “orders close today at 6pm”.' },
  { key: 'auto_pickup_day', title: 'Ready today', when: 'Saturdays, 7am', what: 'Everyone with a confirmed order gets “your juice is pressed and ready” with the pickup address.' },
  { key: 'auto_daily_summary', title: 'Daily summary', when: 'Every day, 8pm', what: 'You get today’s new orders, bottles, and how many still need confirming.' },
] as const

export function Automations() {
  const { settings, setSetting, sendSummaryNow } = useStaff()
  const [phone, setPhone] = useState(settings.staff_phone ?? '')
  const [msg, setMsg] = useState('')
  useEffect(() => setPhone(settings.staff_phone ?? ''), [settings.staff_phone])

  const run = async (fn: () => Promise<void>, ok: string) => {
    setMsg('')
    try {
      await fn()
      setMsg(ok)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <section className="card automations">
      <div className="row-between wrap">
        <div>
          <h2>Automatic texts</h2>
          <p className="small muted">
            Sent from {settings.sms_sender ? <strong>{settings.sms_sender}</strong> : 'your sender ID'}. Order received and status texts always go out on their own.
          </p>
        </div>
        <label className="switch-toggle" title="All texts on or off">
          <input
            type="checkbox"
            checked={settings.sms_live === 'true'}
            onChange={(e) => void run(() => setSetting('sms_live', String(e.target.checked)), e.target.checked ? 'Texts are on.' : 'All texts paused.')}
          />
          <span aria-hidden="true" />
          <span className="sr-only">All texts on</span>
        </label>
      </div>

      <ul className="auto-list">
        {JOBS.map((j) => (
          <li key={j.key}>
            <div>
              <strong>{j.title}</strong> <span className="auto-when">{j.when}</span>
              <p className="small muted">{j.what}</p>
            </div>
            <label className="switch-toggle">
              <input type="checkbox" checked={settings[j.key] === 'true'} onChange={(e) => void run(() => setSetting(j.key, String(e.target.checked)), `${j.title} ${e.target.checked ? 'on' : 'off'}.`)} />
              <span aria-hidden="true" />
              <span className="sr-only">{j.title}</span>
            </label>
          </li>
        ))}
      </ul>

      <form
        className="auto-phone"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => setSetting('staff_phone', phone), phone ? 'Summary number saved.' : 'Summary number removed.')
        }}
      >
        <label className="field">
          <span>Your number for the daily summary</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="024 123 4567" />
        </label>
        <button className="btn btn-sm">Save</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!settings.staff_phone} onClick={() => void run(sendSummaryNow, 'Summary sent to your phone.')}>
          Text me today’s summary
        </button>
      </form>
      {msg && <p className="small">{msg}</p>}
    </section>
  )
}
