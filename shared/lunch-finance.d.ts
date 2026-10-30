export interface ClosureItem { order_id?: string; unit_price: number | null }
export interface Settlement { vendorAmount: number | null; amountDue: number | null; paymentState: 'paid' | 'unpaid' | 'sponsored'; priceSource: 'frozen' | 'current' | 'legacy_unknown' }
export function orderSettlement(menu: Record<string, any>, order: Record<string, any>, closureItems?: ClosureItem[]): Settlement
export function isOutstanding(menu: Record<string, any>, order: Record<string, any>): boolean
