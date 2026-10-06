import type { FeedbackSuggestionsRequest } from '../../shared/feedback.js'
import { HttpError, isRecord, readBoundedJson, type Config } from './http.ts'

export interface Dish {
  id: string
  name: string
  category: string
}

function singleRelation(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value
  if (Array.isArray(value) && value.length === 1 && isRecord(value[0])) return value[0]
  return undefined
}

export function boundedMetadata(value: unknown, max: number): string {
  return typeof value === 'string' ? value.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function vietnamToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function readRows(config: Config, token: string, table: string, params: Record<string, string>, fetcher: typeof fetch): Promise<unknown[]> {
  const url = new URL(`/rest/v1/${table}`, config.supabaseUrl)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  try {
    const response = await fetcher(url.toString(), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(4000),
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (response.status === 401 || response.status === 403) throw new HttpError(403, 'forbidden')
    if (!response.ok) throw new HttpError(503, 'data_unavailable')
    const rows = await readBoundedJson(response, 64 * 1024, 503)
    if (!Array.isArray(rows)) throw new HttpError(503, 'data_unavailable')
    return rows
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) throw error
    throw new HttpError(503, 'data_unavailable')
  }
}

export async function loadOwnedDishes(config: Config, token: string, subject: string, body: FeedbackSuggestionsRequest, fetcher: typeof fetch = fetch, now = new Date()): Promise<Dish[]> {
  const orders = await readRows(config, token, 'orders', { select: 'id,user_id,menu_id,menus!inner(menu_date)', id: `eq.${body.order_id}`, limit: '2' }, fetcher)
  const order = orders[0]
  if (orders.length !== 1 || !isRecord(order) || order.id !== body.order_id || order.user_id !== subject || typeof order.menu_id !== 'string') throw new HttpError(403, 'forbidden')
  const menu = singleRelation(order.menus)
  const date = menu?.menu_date
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > vietnamToday(now)) throw new HttpError(403, 'forbidden')

  const rows = await readRows(config, token, 'order_items', {
    select: 'id,order_id,menu_id,name_snapshot,menu_items(category)',
    order_id: `eq.${body.order_id}`, id: `in.(${body.order_item_ids.join(',')})`, limit: '20',
  }, fetcher)
  if (rows.length !== body.order_item_ids.length) throw new HttpError(403, 'forbidden')
  const dishes = new Map<string, Dish>()
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string' || !body.order_item_ids.includes(row.id) ||
        row.order_id !== body.order_id || row.menu_id !== order.menu_id || dishes.has(row.id)) throw new HttpError(403, 'forbidden')
    const name = boundedMetadata(row.name_snapshot, 120)
    if (!name) throw new HttpError(403, 'forbidden')
    dishes.set(row.id, { id: row.id, name, category: boundedMetadata(singleRelation(row.menu_items)?.category, 48) })
  }
  return body.order_item_ids.map(id => {
    const dish = dishes.get(id)
    if (!dish) throw new HttpError(403, 'forbidden')
    return dish
  })
}
