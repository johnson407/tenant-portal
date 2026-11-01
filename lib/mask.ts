/**
 * Masks a five-digit bank suffix for the tenant view. The tenant needs only
 * enough detail to recognize the transfer, not the full suffix.
 */
export function maskBankLast5(bankLast5: string): string {
  return `•••${bankLast5.slice(-2)}`;
}
