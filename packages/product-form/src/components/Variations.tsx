'use client';
import * as React from 'react';
import DynamicVariationInput from './DynamicVariationInput';
import { useFieldArray } from 'react-hook-form';
import { useMerchiFormContext } from '../context/MerchiProductFormProvider';
import { shouldHideSingleOptionSelection } from '../utils/singleOptionVariation';
import {
  clampVariationColumns,
  variationLayoutSpan,
} from '../utils/variationLayout';

interface Props {
  containerClass?: string;
  columns?: number;
  disabled?: boolean;
  name?: string;
  keyName?: string;
}

function getSelectedOptionIds(variations: any[]): Set<number> {
  const ids = new Set<number>();
  for (const variation of variations) {
    const { value } = variation;
    if (!value) continue;
    String(value).split(',').forEach((id: string) => {
      const parsed = parseInt(id.trim(), 10);
      if (!isNaN(parsed)) ids.add(parsed);
    });
  }
  return ids;
}

function layoutSpanForVariation(variation: any, product: any): unknown {
  const direct = variation?.variationField?.layoutSpan;
  if (direct != null && direct !== '') return direct;
  const id = Number(variation?.variationField?.id);
  if (!Number.isFinite(id)) return direct;
  const fields = [
    ...(product?.independentVariationFields || []),
    ...(product?.groupVariationFields || []),
  ];
  const field = fields.find((item: any) => Number(item?.id) === id);
  return field?.layoutSpan ?? direct;
}

function isDynamicVariationVisible(
  variation: any,
  selectedOptionIds: Set<number>,
): boolean {
  const selectedBy: any[] = variation?.variationField?.selectedBy;
  if (!selectedBy || selectedBy.length === 0) return true;
  return selectedBy.some((opt: any) => opt.id && selectedOptionIds.has(opt.id));
}

function Variations({
  containerClass,
  columns,
  disabled,
  name = 'variations',
  keyName = 'variationArrayFieldId',
}: Props) {
  const { control, hookForm, product } = useMerchiFormContext();
  const { watch } = hookForm;
  const { fields } = useFieldArray({ control, keyName, name });
  const currentVariations: any[] = watch(name) || [];
  // Group fields can be gated by independent options (and vice versa is rare).
  // Mirror the server: group selected_options = group.variations + job.variations.
  const independentVariations: any[] =
    name === 'variations' ? [] : watch('variations') || [];
  const selectedOptionIds = getSelectedOptionIds([
    ...independentVariations,
    ...currentVariations,
  ]);
  const columnCount = clampVariationColumns(
    columns ??
      (name === 'variations'
        ? product?.independentVariationColumns
        : product?.groupVariationColumns),
  );
  if (!fields.length) return null;
  // One column keeps the fields in the parent stack. A grid wrapper would
  // still take a flex slot when every field is hidden.
  const gridStyle: React.CSSProperties = columnCount > 1
    ? { ['--merchi-variation-columns' as string]: String(columnCount) }
    : { display: 'contents' };
  return (
    <div
      className="merchi-embed-form_variation-grid"
      style={gridStyle}
    >
      {fields.map((fieldItem: any, index: number) => {
        const current = currentVariations[index];
        // Field-array items are the source of truth for variationField /
        // selectableOptions. Watched values can omit those after a value-only
        // update; never let that strip metadata or the input tree crashes and
        // the form collapses.
        const variation = {
          ...fieldItem,
          value: current?.value ?? fieldItem.value,
          variationFiles: current?.variationFiles ?? fieldItem.variationFiles,
          onceOffCost: current?.onceOffCost ?? fieldItem.onceOffCost,
          unitCost: current?.unitCost ?? fieldItem.unitCost,
          cost: current?.cost ?? fieldItem.cost,
          selectableOptions:
            current?.selectableOptions ?? fieldItem.selectableOptions,
          variationField: fieldItem.variationField ?? current?.variationField,
        };
        if (!isDynamicVariationVisible(variation, selectedOptionIds)) {
          return null;
        }
        const hideSelection = shouldHideSingleOptionSelection(variation);
        const span = variationLayoutSpan(
          layoutSpanForVariation(variation, product),
          columnCount,
        );
        return (
          <fieldset
            className={hideSelection ? undefined : containerClass}
            key={fieldItem[keyName]}
            name={`${name}[${index}]`}
            hidden={hideSelection}
            style={hideSelection ? undefined : { gridColumn: `span ${span}` }}
          >
            <DynamicVariationInput
              disabled={disabled}
              index={index}
              name={name}
              variation={variation}
            />
          </fieldset>
        );
      })}
    </div>
  );
}

export default Variations;
