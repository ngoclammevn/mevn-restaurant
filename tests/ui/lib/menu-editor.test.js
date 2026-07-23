import { describe, expect, it } from 'vitest'
import {
  getOrderedDishUsage,
  parseMenuEditorDraft,
  serializeMenuEditorDraft,
  validateMenuEditorDraft,
} from '../../../src/lib/menuEditor'

describe('menu editor helpers', () => {
  it('round-trips structured OCR notes without losing fields', () => {
    const draft = parseMenuEditorDraft(JSON.stringify({
      notes: 'Ít cay',
      dishes: [{ name: 'Cơm gà', price: 45000, category: 'Món chính' }],
    }))

    expect(draft.kind).toBe('structured')
    expect(serializeMenuEditorDraft(draft)).toBe(
      '{"notes":"Ít cay","dishes":[{"name":"Cơm gà","price":45000,"category":"Món chính"}]}',
    )
  })

  it('keeps plain text and malformed JSON distinguishable', () => {
    expect(parseMenuEditorDraft('Cơm tấm - 40k')).toEqual({
      kind: 'plain',
      text: 'Cơm tấm - 40k',
    })
    expect(parseMenuEditorDraft('{"dishes":')).toEqual({
      kind: 'invalid',
      raw: '{"dishes":',
    })
  })

  it('treats successfully parsed non-object JSON as invalid', () => {
    for (const note of ['null', '45000', '"Cơm tấm"']) {
      expect(parseMenuEditorDraft(note)).toEqual({ kind: 'invalid', raw: note })
    }
  })

  it('validates names and normalizes prices', () => {
    const result = validateMenuEditorDraft({
      kind: 'structured',
      notes: '',
      dishes: [{ name: '  Cơm gà ', price: '45.000đ', category: 'Món chính' }],
    })

    expect(result).toEqual({ valid: true, error: null })
  })

  it('rejects missing dish names and invalid prices', () => {
    expect(validateMenuEditorDraft({
      kind: 'structured',
      dishes: [{ name: '   ', price: 45000 }],
    })).toMatchObject({ valid: false })
    expect(validateMenuEditorDraft({
      kind: 'structured',
      dishes: [{ name: 'Cơm gà', price: '-45.000đ' }],
    })).toMatchObject({ valid: false })
  })

  it('leaves plain and invalid drafts out of structured serialization', () => {
    expect(serializeMenuEditorDraft({ kind: 'plain', text: 'Cơm tấm - 40k' })).toBeNull()
    expect(serializeMenuEditorDraft({ kind: 'invalid', raw: '{"dishes":' })).toBeNull()
  })

  it('counts each exact ordered dish once per order and separates paid orders', () => {
    const usage = getOrderedDishUsage(
      [{ name: 'Cơm gà' }, { name: 'Bún bò' }],
      [
        { item_text: 'Cơm gà\nCơm gà\nBún bò', is_paid: true },
        { item_text: 'Cơm gà\nBún Bò', is_paid: false },
      ],
    )

    expect(usage.orderedNames).toEqual(new Set(['Cơm gà', 'Bún bò']))
    expect(usage.paidNames).toEqual(new Set(['Cơm gà', 'Bún bò']))
    expect(usage.counts).toEqual(new Map([['Cơm gà', 2], ['Bún bò', 1]]))
  })
})
