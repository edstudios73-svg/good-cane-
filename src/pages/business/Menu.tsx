import { useState, type FormEvent } from 'react'
import { TASTES } from '../../domain/catalog'
import type { Product } from '../../domain/types'
import { formatPrice, reloadMenu, useMenu } from '../../lib/menu'
import { supabase } from '../../lib/supabase'

interface Draft {
  id?: string
  name: string
  price: string
  size: string
  taste: Product['taste']
  ingredients: string
  about: string
  accent: string
  photoUrl?: string
  active: boolean
}

const blank: Draft = { name: '', price: '', size: '500 ml', taste: 'Sweet', ingredients: '', about: '', accent: '#2d753e', active: true }

const toDraft = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  price: p.price != null ? String(p.price / 100) : '',
  size: p.size ?? '500 ml',
  taste: p.taste,
  ingredients: p.ingredients,
  about: p.about,
  accent: p.accent,
  active: p.active !== false,
})

function JuiceForm({ start, product, onDone }: { start: Draft; product?: Product; onDone: (msg: string) => void }) {
  const [d, setD] = useState(start)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const upload = async (file: File) => {
    setErr('')
    setBusy(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${(d.id ?? d.name) || 'juice'}-${Date.now()}.${ext}`.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase()
    const { error } = await supabase.storage.from('product-photos').upload(path, file, { contentType: file.type })
    setBusy(false)
    if (error) return setErr("The photo didn't upload. Try a smaller image.")
    set('photoUrl', supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.rpc('staff_save_product', { p: { ...d, price: d.price.trim() } })
    setBusy(false)
    if (error) return setErr(error.message)
    await reloadMenu()
    onDone(d.id ? `${d.name} saved.` : `${d.name} is on the menu.`)
  }

  const picture = d.photoUrl ?? product?.bottle

  return (
    <form className="juice-form" onSubmit={save}>
      <div className="juice-form-top">
        <label className="juice-photo" style={{ background: product?.tint ?? '#f5f2ef' }} title="Change photo">
          {picture ? <img src={picture} alt="" /> : <span>Add photo</span>}
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
        <div className="juice-form-main">
          <label className="field">
            <span>Name</span>
            <input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Pineapple Sugarcane" required />
          </label>
          <div className="juice-row">
            <label className="field">
              <span>Price per bottle (GH₵)</span>
              <input value={d.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" placeholder="Not set" />
            </label>
            <label className="field">
              <span>Size</span>
              <input value={d.size} onChange={(e) => set('size', e.target.value)} />
            </label>
          </div>
        </div>
      </div>
      <div className="juice-row">
        <label className="field">
          <span>Taste</span>
          <select value={d.taste} onChange={(e) => set('taste', e.target.value as Product['taste'])}>
            {TASTES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Label colour</span>
          <input type="color" value={d.accent} onChange={(e) => set('accent', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>What's in it</span>
        <input value={d.ingredients} onChange={(e) => set('ingredients', e.target.value)} placeholder="Pineapple · Sugarcane" />
      </label>
      <label className="field">
        <span>A line for customers</span>
        <textarea value={d.about} onChange={(e) => set('about', e.target.value)} rows={2} maxLength={400} placeholder="How it tastes, in your words." />
      </label>
      <div className="row-between wrap">
        <label className="check">
          <input type="checkbox" checked={d.active} onChange={(e) => set('active', e.target.checked)} />
          <span>On the menu</span>
        </label>
        <div className="row-between">
          {d.id && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone('')}>
              Close
            </button>
          )}
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? 'Saving…' : d.id ? 'Save' : 'Add to menu'}
          </button>
        </div>
      </div>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
    </form>
  )
}

export function Menu() {
  const menu = useMenu(true)
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const done = (m: string) => {
    setOpen(null)
    setMsg(m)
  }
  const unpriced = menu.filter((p) => p.active !== false && p.price == null).length

  return (
    <div className="stack menu-admin">
      <div className="row-between wrap">
        <div>
          <h2>Menu and prices</h2>
          <p className="small muted">
            {unpriced > 0
              ? `${unpriced} juice${unpriced === 1 ? ' has' : 's have'} no price yet. Until you add one, customers see "price confirmed by SMS".`
              : 'Every juice has a price. Prices are saved with each order, so changing one never alters past orders.'}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(open === 'new' ? null : 'new')}>
          + Add a juice
        </button>
      </div>
      {msg && <p className="small saved-note">{msg}</p>}

      {open === 'new' && (
        <section className="card">
          <h3>New juice</h3>
          <JuiceForm start={blank} onDone={done} />
        </section>
      )}

      <ul className="menu-list">
        {menu.map((p) => (
          <li key={p.id} className={`card ${p.active === false ? 'is-hidden' : ''}`}>
            {open === p.id ? (
              <JuiceForm start={toDraft(p)} product={p} onDone={done} />
            ) : (
              <button className="menu-row" onClick={() => setOpen(p.id)}>
                <span className="menu-thumb" style={{ background: p.tint }}>
                  <img src={p.bottle} alt="" />
                </span>
                <span className="menu-name">
                  <strong>{p.name}</strong>
                  <span className="small muted">
                    {p.size} · {p.taste}
                    {p.active === false && ' · hidden'}
                  </span>
                </span>
                <span className={`menu-price ${p.price == null ? 'unset' : ''}`}>{p.price != null ? formatPrice(p.price) : 'Add price'}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
