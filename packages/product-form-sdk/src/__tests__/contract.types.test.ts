import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProductFormSdkVersion, SDK_VERSION } from '../version';
import type { ProductFormComponent, ProductFormProps } from '../types/form';

const packageVersion = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8'),
).version as string;

describe('contract', () => {
  it('getProductFormSdkVersion matches package.json', () => {
    expect(getProductFormSdkVersion()).toBe(packageVersion);
    expect(SDK_VERSION).toBe(packageVersion);
  });

  it('a form component can be typed against ProductFormProps', () => {
    const form: ProductFormComponent = (props: ProductFormProps) => {
      void props.product.id;
      void props.pricing.getQuote;
      void props.actions.buyNow;
      void props.helpers.serializeJob;
      return null;
    };
    expect(typeof form).toBe('function');
  });
});
