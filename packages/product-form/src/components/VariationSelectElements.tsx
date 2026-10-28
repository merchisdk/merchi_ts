'use client';
import * as React from 'react';
import { useController } from 'react-hook-form';
import { isBoolean } from 'lodash';
import VariationOptionColour from './VariationOptionColour';
import VariationOptionImage from './VariationOptionImage';
import VariationError from './VariationError';
import VariationLabel from './VariationLabel';
import { useMerchiFormContext } from '../context/MerchiProductFormProvider';
import { quoteAfterFieldChange } from './quoteAfterFieldChange';
import { sortByPosition, splitSelectedOptions } from './utils';

const MAX_GRID_OPTION_COUNT = 3;

function optionCountLabel(count: number) {
  return count === 1 ? '1 option' : `${count} options`;
}

function scrollSelectedOptionIntoView(container: HTMLDivElement) {
  if (container.scrollWidth <= container.clientWidth) return;

  const selected = container.querySelector('.image-checked');
  const item = selected?.closest(
    '.merchi-embed-form_image-select-option-item-container, .merchi-embed-form_color-select-item'
  );
  if (!(item instanceof HTMLElement)) return;

  const containerRect = container.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  if (itemRect.left >= containerRect.left && itemRect.right <= containerRect.right) return;

  const offset = itemRect.left - containerRect.left + container.scrollLeft;
  container.scrollLeft = offset - (container.clientWidth - item.offsetWidth) / 2;
}

function determineBoolean(value: any) {
  return isBoolean(value) ? value : value === 'true' ? true : false;
}

function optionType(variation: any) {
  const { multipleSelect, sellerProductEditable } = variation.variationField;
  return determineBoolean(multipleSelect) ||
    determineBoolean(sellerProductEditable)
    ? 'checkbox'
    : 'radio';
}

interface OptionProps {
  disabled?: boolean;
  index: number;
  inputType: string;
  name: string;
  option: any;
  variation: any;
}

function VariationFieldOptionElement({
  disabled,
  index,
  inputType,
  name,
  option,
  variation,
}: OptionProps) {
  const { control, getQuote } = useMerchiFormContext();
  const { field } = useController({ name: `${name}.value`, control });
  const { variationField } = variation;
  const { sellerProductEditable } = variationField;
  const { optionId } = option;
  const inputId = `${name}.options.id-${optionId}`;
  const activeIds = splitSelectedOptions(field.value).map(String).filter(Boolean);
  const isActive = activeIds.includes(String(optionId));
  const optionInputType = optionType(variation);
  const doClick = () => {
    let updatedIds = [...activeIds];

    if (sellerProductEditable || optionInputType === 'checkbox') {
      // Checkbox Logic
      if (!updatedIds.includes(String(optionId))) {
        updatedIds.push(String(optionId));
      } else {
        updatedIds = updatedIds.filter(
          (existingId) => existingId !== String(optionId)
        );
      }
    } else if (optionInputType === 'radio') {
      // Radio Logic
      updatedIds = [String(optionId)];
    }
    quoteAfterFieldChange(
      field.onChange,
      getQuote,
      updatedIds.filter(Boolean).join(',')
    );
  };
  return (
    <>
      <input
        style={{ display: 'none' }}
        checked={isActive}
        value={optionId}
        type={optionInputType}
        id={inputId}
        name={`${name}.value`}
        onChange={() => true}
        disabled={disabled}
      />
      {inputType === 'image' ? (
        <VariationOptionImage
          doClick={doClick}
          isChecked={isActive}
          option={option}
        />
      ) : (
        <VariationOptionColour
          doClick={doClick}
          isChecked={isActive}
          option={option}
        />
      )}
    </>
  );
}

interface Props {
  disabled?: boolean;
  inputType?: string;
  name: string;
  variation: any;
  afterOptions?: React.ReactNode;
}

export const VariationSelectElements: React.FC<Props> = ({
  disabled,
  inputType = 'image',
  name,
  variation,
  afterOptions,
}) => {
  const { selectableOptions = [] } = variation;
  const isImage = inputType === 'image';
  const optionCount = selectableOptions.length;
  const optionLayout = optionCount > MAX_GRID_OPTION_COUNT ? 'scroll' : 'grid';
  const optionsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = optionsRef.current;
    if (!container || optionLayout !== 'scroll') return;
    const frame = requestAnimationFrame(() => scrollSelectedOptionIntoView(container));
    return () => cancelAnimationFrame(frame);
  }, [optionLayout, optionCount]);

  return (
    <div className={isImage ? 'merchi-image-select-container' : ''}>
      <VariationLabel
        name={name}
        variationClassName={`merchi-embed-form_input${
          isImage ? '-image' : ''
        }-select`}
        variation={variation}
        optionCountLabel={optionCount > 0 ? optionCountLabel(optionCount) : null}
      />
      <div
        ref={optionsRef}
        className={`${
          isImage
            ? 'merchi-embed-form_image-select-option-container'
            : 'merchi-embed-form_color-select-container'
        } merchi-embed-form_options--${optionLayout}`}
        data-option-layout={optionLayout}
        data-option-count={optionCount}
      >
        {sortByPosition(selectableOptions).map((option: any, index: number) => (
          <VariationFieldOptionElement
            key={`variation-option-${option.optionId}-${index}`}
            disabled={disabled}
            index={index}
            inputType={inputType}
            name={name}
            option={option}
            variation={variation}
          />
        ))}
      </div>
      {afterOptions}
      <VariationError name={name} />
    </div>
  );
};

interface FieldProps {
  disabled?: boolean;
  name: string;
  variation: any;
  afterOptions?: React.ReactNode;
}

export const VariationSelectImage = (props: FieldProps) => (
  <VariationSelectElements {...props} inputType='image' />
);
export const VariationSelectColour = (props: FieldProps) => (
  <VariationSelectElements {...props} inputType='colour' />
);
