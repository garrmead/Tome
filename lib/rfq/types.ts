export const RFQ_STATUSES = ["open", "quoted", "won", "lost", "cancelled"] as const
export type RfqStatus = (typeof RFQ_STATUSES)[number]

export interface RfqItemInput {
  product_line_id: string
  quantity: number
  note?: string
}
