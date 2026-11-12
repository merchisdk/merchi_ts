'use client';
import * as React from 'react';
import { useId, useRef, useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useMerchiFormContext } from '../context/MerchiProductFormProvider';
import Variations from './Variations';
import { submitLead } from '../actions/leads';

/** Public store contacts shown when a lead submission needs recovery. */
export interface LeadContactFallback {
  phone?: string;
  email?: string;
}

interface Props {
  contactFallback?: LeadContactFallback;
  hideSubmitButtons?: boolean;
  submitLabel?: string;
  successMessage?: string;
  hideBuiltInSuccess?: boolean;
  onSuccess?: () => void;
}

const contactFields = {
  name: {
    name: 'client.name',
    label: 'Name',
    type: 'text',
    autoComplete: 'name',
    placeholder: 'Full name',
    validate: (value: string) => Boolean(value?.trim()) || 'Enter your name.',
  },
  email: {
    name: 'client.emailAddresses.0.emailAddress',
    label: 'Email address',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'info@example.com',
    validate: (value: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value?.trim() ?? '') ||
      'Enter a valid email address.',
  },
  phone: {
    name: 'client.phoneNumbers.0.number',
    label: 'Phone number',
    type: 'tel',
    autoComplete: 'tel',
    placeholder: 'Phone number',
    validate: (value: string) => {
      const phone = value?.trim();
      if (!phone) return true;
      const number = phone.replace(/\s*(?:ext\.?|x|#)\s*\d+$/i, '');
      const digits = number.replace(/\D/g, '');
      return (
        (/^\+?[\d ()./-]+$/.test(number) && digits.length >= 6 && digits.length <= 15) ||
        'Enter a valid phone number or leave it blank.'
      );
    },
  },
} as const;

function submissionMessage(error: unknown, captchaRequired: boolean): string {
  const { statusCode, errorCode } = (error ?? {}) as { statusCode?: number; errorCode?: number };
  if (errorCode === 226 && captchaRequired) return 'Complete the verification again, then try submitting.';
  if (statusCode === 429) return 'Too many attempts. Wait before trying again.';
  if (statusCode === 400 || statusCode === 422) {
    return 'Your message wasn’t sent. Check your contact details and try again.';
  }
  return 'We couldn’t send your message. Please try again.';
}

function FormLead({
  hideSubmitButtons = false,
  submitLabel = 'Submit',
  successMessage = 'Thank you! We will be in touch shortly.',
  hideBuiltInSuccess = false,
  onSuccess,
  contactFallback,
}: Props) {
  const {
    apiUrl,
    classNameButtonSubmit,
    classNameButtonsSubmitContainer,
    classNameInput,
    hcaptchaSiteKey,
    hookForm,
    onSubmit,
    product,
  } = useMerchiFormContext();

  const {
    handleSubmit,
    register,
    getFieldState,
    formState,
  } = hookForm;
  const { isSubmitting } = formState;
  const formId = useId();

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fallbackPhone = contactFallback?.phone?.trim();
  const fallbackEmail = contactFallback?.email?.trim();
  const [hcaptchaToken, setHcaptchaToken] = useState<string>('');
  const captchaRef = useRef<HCaptcha | null>(null);
  const siteKey = (hcaptchaSiteKey || '').trim();
  const captchaRequired = Boolean(siteKey);

  const hasVariations =
    Array.isArray(product?.independentVariationFields) &&
    product.independentVariationFields.length > 0;

  async function doSubmit(values: any) {
    setError(null);
    if (captchaRequired && !hcaptchaToken) {
      setError('Please complete the captcha.');
      return;
    }
    try {
      const { client, variations, variationsGroups, website } = values;
      await submitLead(
        {
          client,
          product,
          variations,
          variationsGroups,
        },
        apiUrl ?? '',
        {
          website: website ?? '',
          hcaptchaToken: hcaptchaToken || undefined,
        },
      );
    } catch (error: unknown) {
      setError(submissionMessage(error, captchaRequired));
      setHcaptchaToken('');
      captchaRef.current?.resetCaptcha();
      console.error('Lead form submit failed:', error);
      return;
    }
    setSubmitted(true);
    onSuccess?.();
    onSubmit?.(null);
  }

  function renderContactField(key: keyof typeof contactFields) {
    const { name, label, type, autoComplete, placeholder, validate } = contactFields[key];
    const id = `${formId}-${key}`;
    const fieldError = getFieldState(name, formState).error?.message;
    return (
      <div className="merchi-lead-form-field flex flex-col gap-1">
        <label htmlFor={id} className="merchi-lead-form-label text-sm font-medium text-zinc-700">
          {label}
        </label>
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          required={key !== 'phone'}
          className={classNameInput}
          placeholder={placeholder}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${id}-error` : undefined}
          {...register(name, { validate })}
        />
        {fieldError && (
          <p id={`${id}-error`} role="alert" className="text-sm text-red-700">{fieldError}</p>
        )}
      </div>
    );
  }

  if (submitted) {
    if (hideBuiltInSuccess) return null;
    return (
      <div className="merchi-lead-form-success">
        <p>{successMessage}</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(doSubmit, () => setError('Check the fields marked below and try again.'))}
    >
      {error && (
        <div role="alert" className="merchi-lead-form-error mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {(fallbackPhone || fallbackEmail) && (
            <p className="mt-1">
              If it still fails,{' '}
              {fallbackPhone && (
                <a className="underline" href={`tel:${fallbackPhone.replace(/[^+\d]/g, '')}`}>call {fallbackPhone}</a>
              )}
              {fallbackPhone && fallbackEmail && ' or '}
              {fallbackEmail && (
                <a className="underline" href={`mailto:${fallbackEmail}`}>email {fallbackEmail}</a>
              )}
              .
            </p>
          )}
        </div>
      )}

      {/* Honeypot: hidden from humans; bots that fill it are rejected server-side. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <label htmlFor={`${formId}-website`}>Website</label>
        <input
          id={`${formId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('website')}
        />
      </div>

      <div className="merchi-lead-form-client-fields space-y-4">
        {renderContactField('name')}
        {renderContactField('email')}
        {renderContactField('phone')}
      </div>

      {hasVariations && (
        <div className="merchi-embed-form_variantion-container">
          <Variations />
        </div>
      )}

      {captchaRequired && (
        <div className="merchi-lead-form-captcha mt-4 flex justify-center">
          <HCaptcha
            ref={captchaRef}
            sitekey={siteKey}
            onVerify={(token) => setHcaptchaToken(token)}
            onExpire={() => setHcaptchaToken('')}
            onError={() => setHcaptchaToken('')}
          />
        </div>
      )}

      {!hideSubmitButtons && (
        <div className={classNameButtonsSubmitContainer}>
          <button
            type="submit"
            className={classNameButtonSubmit}
            disabled={isSubmitting || (captchaRequired && !hcaptchaToken)}
          >
            {isSubmitting ? 'Sending…' : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

export default FormLead;
