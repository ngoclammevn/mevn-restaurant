export interface PickupCandidate { userId?: string; user_id?: string; full_name?: string | null; available?: boolean; receivedCount?: number; received_count?: number; last_received_at?: string | null; phone_e164?: string | null }
export function normalizePickupPhone(input: unknown): string
export function secureRandomIndex(upperExclusive: number): number
export function choosePickupCandidate<T extends PickupCandidate>(candidates: T[], randomIndex?: (upperExclusive: number) => number): T | null
