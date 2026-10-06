import type { FeedbackSuggestionsRequest } from '../../shared/feedback.js'
import { HttpError, isRecord, readBoundedJson } from './http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function parseRequest(request: Request): Promise<FeedbackSuggestionsRequest> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(400, 'invalid_body')
  const value = await readBoundedJson(request, 16 * 1024)
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'locale,order_id,order_item_ids' ||
      typeof value.order_id !== 'string' || !UUID.test(value.order_id) || value.locale !== 'vi' ||
      !Array.isArray(value.order_item_ids) || value.order_item_ids.length < 1 || value.order_item_ids.length > 20 ||
      !value.order_item_ids.every(id => typeof id === 'string' && UUID.test(id))) throw new HttpError(400, 'invalid_body')
  const ids = value.order_item_ids.map(id => id.toLowerCase())
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'invalid_body')
  return { order_id: value.order_id.toLowerCase(), order_item_ids: ids, locale: 'vi' }
}
