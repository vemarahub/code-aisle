/**
 * PaymentProcessor — charges customers and handles failed payments.
 *
 * Central entry point for processing a payment. Handles failed payment
 * scenarios such as insufficient funds, declined cards, and gateway timeouts,
 * and decides whether a payment should be retried.
 */
export interface PaymentRequest {
  customerId: string;
  amountCents: number;
  currency: string;
  cardToken: string;
}

export type PaymentResult =
  | { status: "succeeded"; transactionId: string }
  | { status: "failed"; reason: FailureReason; retryable: boolean };

export type FailureReason =
  | "insufficient_funds"
  | "card_declined"
  | "gateway_timeout"
  | "invalid_card";

export class PaymentProcessor {
  /** Attempt to charge a customer for the given amount. */
  async charge(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const transactionId = await this.callGateway(request);
      return { status: "succeeded", transactionId };
    } catch (error) {
      const reason = this.classifyFailure(error);
      return {
        status: "failed",
        reason,
        retryable: this.isRetryable(reason),
      };
    }
  }

  /** Decide whether a failed payment is safe to retry. */
  private isRetryable(reason: FailureReason): boolean {
    return reason === "gateway_timeout";
  }

  private classifyFailure(error: unknown): FailureReason {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("funds")) return "insufficient_funds";
    if (message.includes("declined")) return "card_declined";
    if (message.includes("timeout")) return "gateway_timeout";
    return "invalid_card";
  }

  private async callGateway(request: PaymentRequest): Promise<string> {
    if (request.amountCents <= 0) {
      throw new Error("Payment gateway declined: invalid amount");
    }
    return `txn_${request.customerId}_${Date.now()}`;
  }
}
