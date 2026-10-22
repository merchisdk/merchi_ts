'use client';
import { Suspense, lazy, useState } from 'react';
import { useMerchiCheckboutContext } from './MerchiCheckoutProvider';
import { tabIdPayment } from '../tabs_utils';
import TitleStep from './TitleStep';
import TabPane from './TabPane';
import CancelOrderConfirmModal from './CancelOrderConfirmModal';
import { getClientEmail, redirectOnSuccess } from '../utils';

const MerchiInvoice = lazy(() => import('@merchi/invoice'));

function TabPanePayment() {
  const {
    alertErrorShow,
    cancelCheckoutOrder,
    classNameMerchiCheckoutButtonCancelOrder,
    classNameMerchiCheckoutButtonDownloadInvoice,
    classNameMerchiCheckoutButtonPrimary,
    classNameMerchiCheckoutButtonSecondary,
    classNameMerchiInvoiceButtonPayInvoice,
    invoice,
    job,
    nextTab,
    redirectAfterSuccessUrl,
    redirectWithValue,
    setInvoice,
    urlApi,
  } = useMerchiCheckboutContext();
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  function handleConfirmCancel() {
    setConfirmCancelOpen(false);
    cancelCheckoutOrder();
  }

  return (
    <TabPane tabId={tabIdPayment}>
      <TitleStep title='Checkout / Payment' />
      <div className='d-flex checkout-border-top'>
        <div className='w-100 mt-3'>
          {invoice?.id && (
            <>
              <Suspense fallback={<div className='spinner' />}>
                <MerchiInvoice
                  alertErrorShow={alertErrorShow}
                  callbackCreditCardPaymentSuccess={(i: any) => {
                    const paidInvoice = i?.invoice ?? i;
                    setInvoice(paidInvoice);
                    if (paidInvoice?.unpaid) return;
                    if (redirectAfterSuccessUrl) {
                      redirectOnSuccess(
                        redirectAfterSuccessUrl,
                        redirectWithValue,
                        paidInvoice?.totalCost,
                        {
                          invoiceId: paidInvoice?.id ?? invoice?.id,
                          email:
                            getClientEmail(paidInvoice?.client) ||
                            getClientEmail(invoice?.client) ||
                            getClientEmail(job?.client),
                        },
                      );
                    } else {
                      setInvoice(i?.invoice ?? i);
                      nextTab();
                    }
                  }}
                  classNameMerchiInvoiceButtonDownloadInvoice={
                    classNameMerchiCheckoutButtonDownloadInvoice
                  }
                  classNameMerchiInvoiceButtonPayInvoice={
                    classNameMerchiInvoiceButtonPayInvoice
                  }
                  invoice={invoice}
                  urlApi={urlApi}
                />
              </Suspense>
              <div className='merchi-checkout-cancel-order'>
                <button
                  type='button'
                  className={classNameMerchiCheckoutButtonCancelOrder}
                  onClick={() => setConfirmCancelOpen(true)}
                >
                  Cancel Order
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <CancelOrderConfirmModal
        isOpen={confirmCancelOpen}
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        classNameConfirmButton={classNameMerchiCheckoutButtonPrimary}
        classNameDismissButton={classNameMerchiCheckoutButtonSecondary}
      />
    </TabPane>
  );
}

export default TabPanePayment;
