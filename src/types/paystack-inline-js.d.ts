// The parts of Paystack's Inline JS (v2) the booking form uses; the package
// ships without types. API: node_modules/@paystack/inline-js/README.md
declare module "@paystack/inline-js" {
  type TransactionCallbacks = {
    onLoad?: (tx: { id: number; accessCode: string; customer: Record<string, unknown> }) => void;
    onSuccess?: (tx: { id: number; reference: string; message: string }) => void;
    onCancel?: () => void;
    onError?: (error: { message: string }) => void;
  };

  type PopupTransaction = { id: string };

  export default class PaystackPop {
    isLoaded(): boolean;
    resumeTransaction(accessCode: string, callbacks?: TransactionCallbacks): PopupTransaction;
    cancelTransaction(id?: string): void;
  }
}
