import { CART_FAILURE_SOURCES, reportCartFailure } from './reportFailure';

const urlToFile = async (url: string, filename: string, type: string) => {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new File([buf], filename, { type });
};

const urlToFilePdf = async (url: string, filename: string) => {
  const file = await urlToFile(url, filename, 'application/pdf');
  return file;
};

function publicInvoicePdfFilename(invoice: any): string {
  const id = invoice?.id;
  const emailDomain = invoice?.domain?.emailDomain;
  return emailDomain ? `${emailDomain}-invoice-${id}.pdf` : `invoice-${id}.pdf`;
}

export async function generatePublicInvoicePdf(apiUrl: string, invoice: any, receipt?: boolean) {
  const id = invoice.id;
  const filename = publicInvoicePdfFilename(invoice);

  const queryString = new URLSearchParams({
    invoice_token: invoice.invoiceToken
  }).toString();

  const fetchOptions: any = {
    method: 'GET',
    mode: 'cors'
  };
  const uri = receipt ? '/generate/receipt/pdf/' : '/generate/pdf/';
  try {
    const response = await fetch(
      `${apiUrl}invoices/${id}${uri}?${queryString}`,
      fetchOptions
    );

    if (!response.ok) {
      throw new Error("Error fetching PDF.");
    }

    const r = await response.json();
    const pdf = await urlToFilePdf(
      `data:application/pdf;base64,${r.pdf}`,
      filename
    );

    const url = URL.createObjectURL(pdf);
    const doc = (document as any);
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = pdf.name;

    // Append to the DOM
    doc.body.appendChild(anchor);

    // Trigger `click` event
    anchor.click();

    // Remove element from DOM
    doc.body.removeChild(anchor);

    return { success: true };
  } catch (e: any) {
    reportCartFailure(e, CART_FAILURE_SOURCES.invoicePdf);
    throw e;
  }
}
