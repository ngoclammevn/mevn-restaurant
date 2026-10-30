export const FEEDBACK_VERSION: '1'
export const MAX_FEEDBACK_OPTIONS: 12
export const MAX_REVIEW_LABELS: 6
export function validateLabels(value: unknown): string[]
export function validateSuggestionLabels(value: unknown): string[]
export function fallbackLabels(name?: string): string[]
export function dishFeedbackProfile(name?: string): { key: string; pairs: string[][]; focus: string[] }
export function relevantFeedbackLabels(value: unknown, name?: string): string[]
export function feedbackSections(value: unknown): { id: string; title: string; labels: string[] }[]
export interface FeedbackSuggestion {
  order_item_id: string
  labels: string[]
  source: 'ai' | 'fallback'
}
export interface FeedbackSuggestionsRequest {
  order_id: string
  order_item_ids: string[]
  locale: 'vi'
}
export interface FeedbackSuggestionsResponse {
  version: '1'
  suggestions: FeedbackSuggestion[]
}
