import React from 'react';
import type { ProductFormComponent } from '../src';
import {
  OptionQuantityGrid,
  Section,
  Stack,
  Heading,
  Text,
  Field,
} from '../src';

/** Example: single group field (e.g. Colour) with per-option quantities. */
const ColourGridForm: ProductFormComponent = ({ product }) => {
  const independent = product.independentVariationFields ?? [];
  const hasGroups = (product.groupVariationFields?.length ?? 0) > 0;

  return (
    <Stack gap={24}>
      <Section>
        <Heading>{product?.name || 'Order form'}</Heading>
        {product?.description ? <Text muted>{product.description}</Text> : null}
      </Section>
      {hasGroups ? (
        <Section title="Quantities">
          <OptionQuantityGrid />
        </Section>
      ) : null}
      {independent.length ? (
        <Section title="Options">
          <Stack gap={16}>
            {independent.map((field) => (
              <Field key={field.id} field={field} />
            ))}
          </Stack>
        </Section>
      ) : null}
    </Stack>
  );
};

export default ColourGridForm;
