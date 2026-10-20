import { describe, expect, it } from 'vitest'
import { SMS_KINDS, maskPhone, smsBody, toIntl } from './sms'

describe('sms templates', () => {
  it('every message fits in one 160-character SMS', () => {
    for (const kind of SMS_KINDS) {
      const body = smsBody(kind, { batchId: '2026-10-24', orderNumber: 123456, bottles: 24 })
      expect(body.length, kind).toBeLessThanOrEqual(160)
      expect(body.startsWith('GoodCane:')).toBe(true)
    }
  })

  it('includes the order number and day', () => {
    expect(smsBody('received', { batchId: '2026-10-24', orderNumber: 43, bottles: 3 })).toBe(
      "GoodCane: Order #0043 received for Sat 24 Oct (3 bottles). We'll text you when it's confirmed.",
    )
    expect(smsBody('reminder', { batchId: '2026-10-31' })).toContain('close Thu 6pm')
    expect(smsBody('reminder', { batchId: '2026-10-31' })).toContain('STOP')
  })

  it('formats numbers for the provider and for display', () => {
    expect(toIntl('0241234567')).toBe('233241234567')
    expect(maskPhone('0241234567')).toBe('024 *** 4567')
  })
})
