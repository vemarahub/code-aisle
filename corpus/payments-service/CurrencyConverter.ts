/**
 * CurrencyConverter — converts monetary amounts between currencies.
 *
 * Applies exchange rates and rounds to the smallest currency unit. Used before
 * charging a customer in their local currency.
 */
export class CurrencyConverter {
  constructor(private readonly ratesToEur: Record<string, number>) {}

  /** Convert an amount in minor units from one currency to another. */
  convert(amountCents: number, from: string, to: string): number {
    const fromRate = this.ratesToEur[from];
    const toRate = this.ratesToEur[to];
    if (!fromRate || !toRate) {
      throw new Error(`Unsupported currency pair: ${from} -> ${to}`);
    }
    const inEur = amountCents / fromRate;
    return Math.round(inEur * toRate);
  }
}
