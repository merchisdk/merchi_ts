import { generatePublicInvoicePdf } from './invoice';

function pdfResponse() {
  return {
    ok: true,
    json: async () => ({ pdf: 'JVBERi0x' }),
  };
}

function dataUrlResponse() {
  return {
    ok: true,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  };
}

describe('generatePublicInvoicePdf filename', () => {
  const clicks: string[] = [];

  beforeEach(() => {
    clicks.length = 0;
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = () => 'blob:invoice';
    }
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:invoice');
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('data:')) return dataUrlResponse();
      return pdfResponse();
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads when domain is missing, using a fallback filename', async () => {
    const result = await generatePublicInvoicePdf('https://api.example/', {
      id: 42,
      invoiceToken: 'token',
      domain: null,
    });

    expect(result).toEqual({ success: true });
    expect(clicks).toEqual(['invoice-42.pdf']);
  });

  it('uses the fallback filename when domain or emailDomain is absent', async () => {
    await generatePublicInvoicePdf('https://api.example/', {
      id: 3,
      invoiceToken: 'token',
    });
    await generatePublicInvoicePdf('https://api.example/', {
      id: 4,
      invoiceToken: 'token',
      domain: { emailDomain: '' },
    });

    expect(clicks).toEqual(['invoice-3.pdf', 'invoice-4.pdf']);
  });

  it('keeps the email domain in the filename when it is present', async () => {
    await generatePublicInvoicePdf('https://api.example/', {
      id: 7,
      invoiceToken: 'token',
      domain: { emailDomain: 'shop.example' },
    });

    expect(clicks).toEqual(['shop.example-invoice-7.pdf']);
  });
});
