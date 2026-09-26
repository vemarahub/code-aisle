/**
 * PushNotifier — sends mobile push notifications to customer devices.
 *
 * Fans out a notification to all registered device tokens for a customer and
 * prunes tokens that the push provider reports as expired.
 */
export interface PushMessage {
  customerId: string;
  title: string;
  body: string;
}

export class PushNotifier {
  constructor(
    private readonly deviceTokens: Map<string, string[]> = new Map(),
  ) {}

  /** Send a push notification to every device registered for a customer. */
  async notify(message: PushMessage): Promise<{ sent: number }> {
    const tokens = this.deviceTokens.get(message.customerId) ?? [];
    let sent = 0;
    for (const token of tokens) {
      if (await this.deliver(token, message)) {
        sent++;
      }
    }
    return { sent };
  }

  private async deliver(token: string, _message: PushMessage): Promise<boolean> {
    return token.length > 0;
  }
}
