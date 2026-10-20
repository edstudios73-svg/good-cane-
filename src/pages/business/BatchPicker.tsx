import { formatDay, isOpen, openBatches, pastBatches, type Batch } from '../../domain/batches'
import { useStaff } from '../../staff/StaffProvider'

/** Open batches first, then recent closed ones. */
export function useBatchOptions(): Batch[] {
  const { now } = useStaff()
  return [...openBatches(now, 3), ...pastBatches(now, 6)]
}

export function batchLabel(b: Batch, now: Date): string {
  if (isOpen(b.id, now)) return `${formatDay(b.productionDate)} · open`
  return b.productionDate.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    ? `${formatDay(b.productionDate)} · closed, in production`
    : `${formatDay(b.productionDate)} · done`
}

export function BatchPicker({ value, onChange, allowAll }: { value: string; onChange: (id: string) => void; allowAll?: boolean }) {
  const { now } = useStaff()
  const options = useBatchOptions()
  return (
    <label className="field inline">
      <span>Batch</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value="all">All batches</option>}
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {batchLabel(b, now)}
          </option>
        ))}
      </select>
    </label>
  )
}
