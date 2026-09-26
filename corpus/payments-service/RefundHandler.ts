/**
 * RefundHandler — issues refunds for completed transactions.
 *
 * Handles full and partial refunds, and enforces the rule that you cannot
 * refund more than the original captured amount.
 */
export interface RefundRequest {
  transactionId: string;
  amountCents: number;
  reason: string;
}

export class RefundHandler {
  /** Issue a refund against a previously captured transaction. */
  async refund(
    request: RefundRequest,
    originalAmountCents: number,
  ): Promise<{ refundId: string; amountCents: number }> {
    if (request.amountCents <= 0) {
      throw new Error("Refund amount must be positive");
    }
    if (request.amountCents > originalAmountCents) {
      throw new Error("Cannot refund more than the original charge");
    }
    return {
      refundId: `rfnd_${request.transactionId}`,
      amountCents: request.amountCents,
    };
  }
}
