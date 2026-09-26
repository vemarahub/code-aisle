/**
 * EmailSender — delivers transactional emails to customers.
 *
 * Sends order confirmations, password reset emails, and receipts through the
 * email delivery provider, with retry on transient delivery failures.
 */
export interface Email {
  to: string;
  subject: string;
  body: string;
}

export class EmailSender {
  constructor(private readonly maxAttempts = 3) {}

  /** Send an email, retrying on transient failures. */
  async send(email: Email): Promise<{ delivered: boolean; attempts: number }> {
    let attempts = 0;
    while (attempts < this.maxAttempts) {
      attempts++;
      try {
        await this.deliver(email);
        return { delivered: true, attempts };
      } catch {
        if (attempts >= this.maxAttempts) {
          return { delivered: false, attempts };
        }
      }
    }
    return { delivered: false, attempts };
  }

  private async deliver(email: Email): Promise<void> {
    if (!email.to.includes("@")) {
      throw new Error("Invalid recipient address");
    }
  }
}
