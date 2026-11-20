'use client';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { readTestCheckoutFlag } from '@merchi/invoice/lib/testCheckout';
import { reportCheckoutFailure } from '../reportFailure';
import { submitBuyNow, submitQuoteRequest } from '../actions/confirm';
import { confirmCheckoutSubmission } from '../actions/checkoutConfirmation';
import TabPane from './TabPane';
import TitleStep from './TitleStep';
import FooterButtons from './FooterButtons';
import { currencyTaxAndCost } from './currency';
import {
  tabIdConfirm,
  tabIdCustomerInfo,
  tabIdShipment,
} from '../tabs_utils';
import {
  addressInOneLine,
  getClientEmail,
  isProductSupplierMOD,
  redirectOnSuccess,
} from '../utils';
import { useMerchiCheckboutContext } from './MerchiCheckoutProvider';
import {
  SummaryAmountRow,
  SummaryFieldRow,
} from './CheckoutSummaryFields';
import { DraftImagesStatic } from './DraftImageUploaded';
import JobInfoContent from './JobInfoContent';
import { SmallCustomerInfo } from './TabPaneCustomer';
import DiscountInputGroup from './DiscountInputGroup';
import { clearMerchiSource } from '../merchi_source';
import { clearCheckoutSession } from '../checkoutSession';

interface PropsConfirmInfoPanel {
  content: any;
  minHeight: any;
  onClick: () => void;
  showClickToEdit?: boolean;
  title: string;
}

export function ConfirmInfoPanel({
  content,
  minHeight,
  onClick,
  showClickToEdit,
}: PropsConfirmInfoPanel) {
  const cursor = showClickToEdit ? 'pointer' : 'auto';
  const {
    classNameMerchiCheckoutConfirmInfoPanel
  } = useMerchiCheckboutContext();
  return (
    <div
      className={classNameMerchiCheckoutConfirmInfoPanel}
      style={{ cursor, minHeight }}
      onClick={onClick}
    >
      <div className='flex-fill'>{content}</div>
    </div>
  );
}

function ConfirmAddressAndShipmentInfo() {
  const { job } = useMerchiCheckboutContext();
  const { shipping, shipment } = job;
  const shipmentMethod = shipment?.shipmentMethod;
  const methodName = shipmentMethod?.name ?? '—';

  return (
    <div className='text-left px-3 py-3 modal-merchi-checkout-shipment-detail merchi-checkout-summary'>
      <strong className='merchi-checkout-summary-order-detail-title'>
        Shipment Information
      </strong>
      {shipping && (
        <SummaryFieldRow
          label='Address'
          value={
            <span className='text-capitalize'>{addressInOneLine(shipping)}</span>
          }
        />
      )}
      {shipment && (
        <>
          <SummaryFieldRow label='Shipment method' value={methodName} />
          <SummaryAmountRow
            className='merchi-checkout-summary-shipment-cost'
            label='Shipment Cost'
            amount={currencyTaxAndCost(
              shipmentMethod?.currency,
              shipment.taxType,
              shipment.cost
            )}
          />
        </>
      )}
    </div>
  );
}

function DiscountGroupContainer() {
  const {
    discountLabel,
    discountClassNameInputdiscountLabel,
  } = useMerchiCheckboutContext();
  return (
    <div className='text-left py-3 modal-merchi-checkout-discount-code'>
      {discountLabel && (
        <label
          className={discountClassNameInputdiscountLabel}
          htmlFor='merchi-checkout-discount-codes'
        >
          {discountLabel}
        </label>
      )}
      <DiscountInputGroup />
    </div>
  );
}

function ConfirmInfo() {
  const { job, setActiveTabById } = useMerchiCheckboutContext();
  const { client, ownDrafts, product } = job;
  const isResell = isProductSupplierMOD(product);
  const needsShipping = product && product.needsShipping;
  return (
    <>
      {client && (
        <ConfirmInfoPanel
          minHeight='0px'
          onClick={() => setActiveTabById(tabIdCustomerInfo)}
          showClickToEdit={false}
          title='Edit'
          content={<SmallCustomerInfo />}
        />
      )}
      <ConfirmInfoPanel
        minHeight='0px'
        onClick={() => {
          return;
        }}
        showClickToEdit={false}
        title='Edit'
        content={<JobInfoContent />}
      />
      {!!(!isResell && needsShipping) && (
        <ConfirmInfoPanel
          minHeight='0px'
          onClick={() => setActiveTabById(tabIdShipment)}
          showClickToEdit={false}
          title='Edit'
          content={<ConfirmAddressAndShipmentInfo />}
        />
      )}
      {ownDrafts?.length > 0 && (
        <ConfirmInfoPanel
          minHeight='0px'
          onClick={() => null}
          showClickToEdit={false}
          title='Edit'
          content={
            ownDrafts.length ? (
              <div className='parent-variation-card px-3 py-3 mt-4 file-upload-preview'>
                <strong>Uploaded Files</strong>
                <DraftImagesStatic
                  className='width-100 mt-2 z-index-10000'
                  items={ownDrafts}
                />
              </div>
            ) : (
              ''
            )
          }
        />
      )}
    </>
  );
}

function TabPaneConfirm() {
  const {
    alertErrorShow,
    job,
    isBuyRequest,
    nextTab,
    product,
    redirectAfterSuccessUrl,
    redirectAfterQuoteSuccessUrl,
    redirectWithValue,
    setInvoice,
    setJob,
    showDiscountCode,
    urlApi,
  } = useMerchiCheckboutContext();
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [testCheckout, setTestCheckout] = useState<boolean | null>(null);
  useEffect(() => { setTestCheckout(readTestCheckoutFlag()); }, []);
  async function submit() {
    if (submitting.current || testCheckout === null) return;
    const currentMode = readTestCheckoutFlag();
    if (currentMode !== testCheckout) {
      setTestCheckout(currentMode);
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      const result = await confirmCheckoutSubmission(
        () => isBuyRequest
          ? submitBuyNow(urlApi, { ...job, product: { id: product.id } }, testCheckout)
          : submitQuoteRequest(urlApi, job, testCheckout),
        isBuyRequest ? 'order' : 'quote request',
        testCheckout,
      );
      if (result.confirmed === false) {
        reportCheckoutFailure(result.error, result.statusCode);
        alertErrorShow(result.message);
        return;
      }

      clearMerchiSource();
      if (isBuyRequest) {
        setInvoice({ ...result.entity });
        nextTab();
        return;
      }

      clearCheckoutSession(product);
      const rawRedirect = redirectAfterQuoteSuccessUrl ?? redirectAfterSuccessUrl;
      const quoteRedirect = typeof rawRedirect === 'string' ? rawRedirect.trim() : '';
      setJob(prev => ({ ...prev, id: result.entity.id, isTest: result.entity.isTest }));
      if (quoteRedirect && !result.entity.isTest) {
        try {
          redirectOnSuccess(quoteRedirect, redirectWithValue, result.entity.totalCost, {
            invoiceId: result.entity.id,
            email: getClientEmail(result.entity.client) || getClientEmail(job?.client),
          });
          return;
        } catch {
          // The quote already exists. Show it in checkout if navigation fails.
        }
      }
      nextTab();
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }
  return (
    <TabPane tabId={tabIdConfirm}>
      <TitleStep title='Confirm - Quote Summary' />
      {testCheckout && <p role='status'>{isBuyRequest ? 'Test checkout' : 'Test quote'}</p>}
      <ConfirmInfo />
      {showDiscountCode && (
        <DiscountGroupContainer />
      )}
      <FooterButtons
        forceDisabled={testCheckout === null}
        loading={loading}
        onClickNext={submit}
      />
    </TabPane>
  );
}

export default TabPaneConfirm;
