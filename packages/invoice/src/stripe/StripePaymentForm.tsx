'use client';

import * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';

export interface StripePaymentFormProps {
  apiUrl: string;
  resource: 'invoice' | 'cart';
  resourceId: number;
  resourceToken?: string;
  sessionToken?: string;
  allowPartial?: boolean;
  onSuccess: (invoice: any) => void;
  onError?: (message: string) => void;
  onBack?: () => void;
  dark?: boolean;
  locale?: 'en' | 'zh' | 'ko';
}

interface Attempt {
  id: string;
  status: string;
  recorded: boolean;
  invoice?: any;
  amountMinor: number;
  amountMajor: string;
  currency: string;
  publishableKey: string;
  stripeClientSecret?: string;
  methods: string[];
  cardWallets?: string[];
}

const messages = {
  en: { full: 'Pay full balance', partial: 'Pay a partial amount', amount: 'Payment amount', continue: 'Continue to payment', pay: 'Pay', cancel: 'Change amount', back: 'Back', loading: 'Checking payment…', pending: 'Payment is awaiting confirmation. You can safely return later.', retry: 'Check payment status', invalid: 'Enter an amount greater than zero, with no more than two decimal places.', success: 'Payment recorded', secure: 'Secure payment by Stripe', resume: 'Resume payment', methods: 'Choose a payment method', express: 'Express checkout' },
  zh: { full: '支付全部余额', partial: '支付部分金额', amount: '支付金额', continue: '继续付款', pay: '支付', cancel: '修改金额', back: '返回', loading: '正在核对付款…', pending: '正在等待支付确认。你可以稍后返回查看。', retry: '核对支付状态', invalid: '请输入大于零的金额，最多两位小数。', success: '付款已入账', secure: '由 Stripe 安全处理付款', resume: '继续付款', methods: '选择支付方式', express: '快捷支付' },
  ko: { full: '잔액 전액 결제', partial: '일부 금액 결제', amount: '결제 금액', continue: '결제 계속', pay: '결제', cancel: '금액 변경', back: '뒤로', loading: '결제 확인 중…', pending: '결제 확인을 기다리고 있습니다. 나중에 돌아와 확인할 수 있습니다.', retry: '결제 상태 확인', invalid: '소수점 두 자리 이하의 양수를 입력하세요.', success: '결제가 반영되었습니다', secure: 'Stripe 보안 결제', resume: '결제 계속', methods: '결제 수단 선택', express: '빠른 결제' },
};

const checkoutStyles = `
.merchi-stripe-payment { --pay-primary: var(--primary, #ff4449); --pay-primary-text: var(--primary-foreground, #fff); --pay-surface: var(--card, #fff); --pay-muted: var(--muted, #f6f9fc); --pay-border: var(--border, #e9ecef); --pay-text: var(--foreground, #32325d); --pay-subtle: var(--muted-foreground, #8898aa); }
.merchi-stripe-payment__amount { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; padding: 16px 18px; border: 1px solid var(--pay-border); border-radius: 12px; background: linear-gradient(120deg, var(--pay-muted), var(--pay-surface)); }
.merchi-stripe-payment__amount span { color: var(--pay-subtle); font-size: 13px; font-weight: 600; }
.merchi-stripe-payment__amount strong { color: var(--pay-text); font-size: 24px; line-height: 1.2; white-space: nowrap; }
.merchi-stripe-payment__label { margin: 0 0 12px; color: var(--pay-text); font-size: 14px; font-weight: 650; }
.merchi-stripe-payment__choices { display: grid; gap: 10px; margin: 0; padding: 0; border: 0; }
.merchi-stripe-payment__choice { display: flex; align-items: center; gap: 10px; min-height: 50px; padding: 12px 14px; border: 1px solid var(--pay-border); border-radius: 9px; background: var(--pay-surface); cursor: pointer; font-size: 14px; font-weight: 600; transition: border-color .18s, background-color .18s, box-shadow .18s; }
.merchi-stripe-payment__choice:hover { border-color: var(--pay-primary); }
.merchi-stripe-payment__choice.is-selected { border-color: var(--pay-primary); background: var(--pay-muted); box-shadow: inset 3px 0 0 var(--pay-primary); }
.merchi-stripe-payment__choice input { margin: 0; accent-color: var(--pay-primary); }
.merchi-stripe-payment__partial { padding: 4px 2px 0; }
.merchi-stripe-payment__partial label { display: block; margin-bottom: 7px; font-size: 13px; font-weight: 600; }
.merchi-stripe-payment__partial input { box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--pay-border); border-radius: 8px; background: var(--pay-surface); color: var(--pay-text); font: inherit; }
.merchi-stripe-payment__button { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 11px 16px; border: 1px solid transparent; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 650; line-height: 1.3; cursor: pointer; transition: background-color .18s, border-color .18s, box-shadow .18s, transform .18s; }
.merchi-stripe-payment__button:focus-visible, .merchi-stripe-payment__choice:focus-within, .merchi-stripe-payment__partial input:focus-visible { outline: 3px solid var(--pay-primary); outline-offset: 2px; }
.merchi-stripe-payment__button:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; transform: none; }
.merchi-stripe-payment__button--primary { width: 100%; margin-top: 22px; background: var(--pay-primary); color: var(--pay-primary-text); box-shadow: 0 7px 18px -8px var(--pay-primary); font-size: 16px; }
.merchi-stripe-payment__button--primary:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 10px 22px -8px var(--pay-primary); }
.merchi-stripe-payment__button--secondary { border-color: var(--pay-border); background: var(--pay-surface); color: var(--pay-text); box-shadow: 0 1px 3px rgba(50, 50, 93, .08); }
.merchi-stripe-payment__button--secondary:not(:disabled):hover { transform: translateY(-2px); border-color: var(--pay-primary); background: var(--pay-muted); box-shadow: 0 5px 12px rgba(50, 50, 93, .10); }
.merchi-stripe-payment__button--back { margin-top: 10px; border-color: transparent; background: transparent; color: var(--pay-subtle); }
.merchi-stripe-payment__button--back:not(:disabled):hover { color: var(--pay-primary); background: var(--pay-muted); }
.merchi-stripe-payment__actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.merchi-stripe-payment__secure { margin: 20px 0 0; color: var(--pay-subtle); font-size: 12px; text-align: center; }
.merchi-stripe-payment__error { padding: 10px 12px; border-radius: 8px; background: var(--pay-muted); color: var(--destructive, #f5365c); font-size: 13px; }
@media (max-width: 430px) { .merchi-stripe-payment__actions { grid-template-columns: 1fr; } .merchi-stripe-payment__amount { padding: 14px; } }
@media (prefers-reduced-motion: reduce) { .merchi-stripe-payment__button, .merchi-stripe-payment__choice { transition: none; } .merchi-stripe-payment__button:not(:disabled):hover { transform: none; } }
`;

function PaymentFields({ attempt, check, report, text, formattedAmount }: {
  attempt: Attempt; check: () => Promise<void>; report: (message: string) => void; text: typeof messages.en; formattedAmount: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [expressAvailable, setExpressAvailable] = useState(false);
  const confirm = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set('merchi_payment_attempt', attempt.id);
      const result = await stripe.confirmPayment({ elements,
        confirmParams: { return_url: returnUrl.toString() }, redirect: 'if_required' });
      if (result.error) report(result.error.message || 'Payment could not be confirmed.');
      await check();
    } catch (error: any) {
      report(error.message || 'Payment could not be confirmed.');
    } finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void confirm();
  };
  return <form onSubmit={submit}>
    {attempt.methods.includes('card') && <div style={{ display: expressAvailable ? 'block' : 'none', marginBottom: 20 }}>
      <p className="merchi-stripe-payment__label">{text.express}</p>
      <ExpressCheckoutElement
        options={{ layout: { maxColumns: 2, maxRows: 3, overflow: 'never' },
          paymentMethods: { applePay: attempt.cardWallets?.includes('apple_pay') ? 'auto' : 'never', googlePay: attempt.cardWallets?.includes('google_pay') ? 'auto' : 'never', link: 'auto', paypal: 'never', klarna: 'never', amazonPay: 'never' } }}
        onReady={({ availablePaymentMethods }) => setExpressAvailable(Boolean(availablePaymentMethods?.applePay || availablePaymentMethods?.googlePay || availablePaymentMethods?.link))}
        onConfirm={() => { void confirm(); }}
      />
    </div>}
    <p className="merchi-stripe-payment__label">{text.methods}</p>
    <PaymentElement options={{
      layout: { type: 'accordion', defaultCollapsed: false, radios: 'always', spacedAccordionItems: true,
        visibleAccordionItemsCount: attempt.methods.length },
      paymentMethodOrder: attempt.methods,
      wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
      defaultValues: {},
    }}
      onReady={() => setReady(true)} onLoadError={(event) => report(event.error.message)} />
    <button type="submit" disabled={!stripe || !ready || busy} className="merchi-stripe-payment__button merchi-stripe-payment__button--primary">
      {busy ? text.loading : `${text.pay} ${formattedAmount}`}
    </button>
  </form>;
}

/** Only the backend's recorded payment state invokes onSuccess. */
export function StripePaymentForm({ apiUrl, resource, resourceId, resourceToken, sessionToken,
  allowPartial = false, onSuccess, onError, onBack, dark = false, locale = 'en' }: StripePaymentFormProps) {
  const text = messages[locale];
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [restoring, setRestoring] = useState(true);
  const [paymentOptions, setPaymentOptions] = useState<{ minorUnitFactor: number; currency: string; amountMinor: number } | null>(null);
  const requestKey = useRef<string | null>(null);
  const completed = useRef(false);
  const callback = useRef({ onSuccess, onError });
  callback.current = { onSuccess, onError };
  const fieldId = useId();
  const base = `${apiUrl.replace(/\/$/, '')}/payments/stripe/${resource}/${resourceId}/attempts/`;
  const storageKey = `merchi-payment:${base}`;
  const request = useCallback(async (suffix: string, method = 'GET', body?: object) => {
    const url = new URL(suffix === 'options' ? base.replace(/attempts\/$/, 'options/') : base + suffix);
    if (resourceToken) url.searchParams.set(`${resource}_token`, resourceToken);
    if (sessionToken) url.searchParams.set('session_token', sessionToken);
    const response = await fetch(url.toString(), { method, mode: 'cors', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || 'Unable to process payment.'), { status: response.status });
    return data;
  }, [base, resourceToken, sessionToken, resource]);
  const remember = useCallback((id?: string) => {
    try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
  }, [storageKey]);
  const accept = useCallback((value: Attempt) => {
    setAttempt(value);
    remember(value.id);
    if (value.recorded && value.invoice && !completed.current) {
      completed.current = true;
      remember();
      const url = new URL(window.location.href);
      ['merchi_payment_attempt', 'payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach(key => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, '', url.toString());
      callback.current.onSuccess(value.invoice);
    }
  }, [remember]);
  const report = useCallback((message: string) => {
    setError(message);
    callback.current.onError?.(message);
  }, []);
  useEffect(() => {
    let active = true;
    completed.current = false;
    requestKey.current = null;
    setAttempt(null);
    setRestoring(true);
    const url = new URL(window.location.href);
    let id = url.searchParams.get('merchi_payment_attempt');
    try { id = id || sessionStorage.getItem(storageKey); } catch { /* Optional storage. */ }
    // Strip Stripe's client secret from the visible URL as soon as it returns.
    ['payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach(key => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', url.toString());
    if (id) request(`${encodeURIComponent(id)}/`).then(value => { if (active) accept(value); })
      .catch(error => { if (active) report(error.message); })
      .finally(() => { if (active) setRestoring(false); });
    else setRestoring(false);
    return () => { active = false; };
  }, [request, storageKey, accept, report]);
  useEffect(() => {
    let active = true;
    if (resource === 'invoice') request('options').then(value => { if (active) setPaymentOptions(value); })
      .catch(error => { if (active) report(error.message); });
    return () => { active = false; };
  }, [request, resource, report]);
  const check = useCallback(async () => {
    if (!attempt) return;
    try { accept(await request(`${attempt.id}/`)); } catch (error: any) { report(error.message); }
  }, [attempt, request, accept, report]);
  useEffect(() => {
    if (!attempt || attempt.recorded || ['canceled', 'failed'].includes(attempt.status)) return;
    // Poll slowly even while a QR code is visible. Webhooks also reconcile after the page closes.
    const timer = window.setTimeout(() => { void check(); }, 5000);
    return () => window.clearTimeout(timer);
  }, [attempt, check]);
  const start = async () => {
    if (busy) return;
    setError('');
    const rawMinor = Number(amount) * (paymentOptions?.minorUnitFactor || 100);
    const minor = partial ? Math.round(rawMinor) : undefined;
    if (partial && (!/^\d+(\.\d{1,2})?$/.test(amount) || !minor || !Number.isSafeInteger(minor) || Math.abs(rawMinor - minor) > 1e-7)) { report(text.invalid); return; }
    setBusy(true);
    try {
      // Reuse across network errors; the server also coalesces active attempts.
      requestKey.current = requestKey.current || `checkout:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      accept(await request('', 'POST', { requestKey: requestKey.current, ...(partial ? { amountMinor: minor } : {}) }));
    } catch (error: any) { if (error.status === 400) requestKey.current = null; report(error.message); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      const result = await request(`${attempt.id}/`, 'DELETE');
      if (result.recorded) accept(result);
      else if (result.status === 'canceled') { setAttempt(null); requestKey.current = null; remember(); setError(''); }
      else report(text.pending);
    } catch (error: any) { report(error.message); }
    finally { setBusy(false); }
  };
  const stripe = useMemo(() => attempt?.publishableKey ? loadStripe(attempt.publishableKey) : null, [attempt?.publishableKey]);
  const options: StripeElementsOptions = useMemo(() => ({ clientSecret: attempt?.stripeClientSecret,
    appearance: { theme: dark ? 'night' : 'stripe' }, locale: locale === 'zh' ? 'zh' : locale }), [attempt?.stripeClientSecret, dark, locale]);
  const terminal = attempt && ['canceled', 'failed'].includes(attempt.status);
  const formattedAmount = attempt ? new Intl.NumberFormat(locale, { style: 'currency', currency: attempt.currency }).format(Number(attempt.amountMajor)) : '';
  return <section className="merchi-stripe-payment" aria-label={text.secure} style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
    <style>{checkoutStyles}</style>
    {paymentOptions && !attempt && <div className="merchi-stripe-payment__amount"><span>{text.amount}</span><strong>{new Intl.NumberFormat(locale, { style: 'currency', currency: paymentOptions.currency }).format(paymentOptions.amountMinor / paymentOptions.minorUnitFactor)}</strong></div>}
    {error && <p role="alert" className="merchi-stripe-payment__error">{error}</p>}
    {restoring ? <p role="status">{text.loading}</p> : attempt?.recorded ? <p role="status">{text.success}</p> : !attempt || terminal ? <>
      {allowPartial && paymentOptions && <fieldset disabled={busy} aria-label={`${text.full} / ${text.partial}`} className="merchi-stripe-payment__choices">
        <label className={`merchi-stripe-payment__choice${partial ? '' : ' is-selected'}`}><input type="radio" name={fieldId} checked={!partial} onChange={() => setPartial(false)} /> {text.full}</label>
        <label className={`merchi-stripe-payment__choice${partial ? ' is-selected' : ''}`}><input type="radio" name={fieldId} checked={partial} onChange={() => setPartial(true)} /> {text.partial}</label>
        {partial && <div className="merchi-stripe-payment__partial"><label htmlFor={fieldId}>{text.amount}</label><input id={fieldId} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!!error} /></div>}
      </fieldset>}
      <button type="button" onClick={() => void start()} disabled={busy} className="merchi-stripe-payment__button merchi-stripe-payment__button--primary">{busy ? text.loading : text.continue}</button>
    </> : <>
      <div className="merchi-stripe-payment__amount"><span>{text.amount}</span><strong>{formattedAmount}</strong></div>
      {attempt.stripeClientSecret && stripe && !['processing', 'requires_capture'].includes(attempt.status) && <Elements key={attempt.id} stripe={stripe} options={options}>
        <PaymentFields attempt={attempt} check={check} report={report} text={text} formattedAmount={formattedAmount} />
      </Elements>}
      {attempt.status === 'processing' && <p role="status">{text.pending}</p>}
      <div className="merchi-stripe-payment__actions">
        <button type="button" onClick={() => void check()} disabled={busy} className="merchi-stripe-payment__button merchi-stripe-payment__button--secondary">{text.retry}</button>
        <button type="button" onClick={() => void cancel()} disabled={busy} className="merchi-stripe-payment__button merchi-stripe-payment__button--secondary">{text.cancel}</button>
      </div>
    </>}
    {onBack && <button type="button" onClick={onBack} disabled={busy} className="merchi-stripe-payment__button merchi-stripe-payment__button--back">{text.back}</button>}
    <p className="merchi-stripe-payment__secure">{text.secure}</p>
  </section>;
}
