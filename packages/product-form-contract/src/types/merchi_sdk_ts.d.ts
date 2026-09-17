// merchi_sdk_ts ships without type declarations; declare the minimal surface
// this package uses (the Merchi client and its Job entity).
declare module 'merchi_sdk_ts' {
  export interface MerchiJob {
    fromJson(
      json: Record<string, unknown>,
      options?: { makeDirty?: boolean; arrayValueStrict?: boolean },
    ): MerchiJob;
    getQuote(): Promise<MerchiJob>;
    toJson(): Record<string, unknown>;
  }

  export class Merchi {
    constructor(
      sessionToken?: string,
      clientToken?: string,
      invoiceToken?: string,
      cartToken?: string,
      backendUri?: string,
    );
    Job: new () => MerchiJob;
  }

  // Client-side pricing engine. Typed loosely here (the SDK ships no .d.ts);
  // estimateQuote returns a QuoteResult or an { unsupported } marker.
  export const pricing: {
    estimateQuote(
      rules: unknown,
      selections: unknown,
    ): {
      cost?: number;
      costPerUnit?: number;
      taxAmount?: number;
      totalCost?: number;
      currency?: string;
      groupCosts?: number[];
      unsupported?: string;
    };
  };
}
