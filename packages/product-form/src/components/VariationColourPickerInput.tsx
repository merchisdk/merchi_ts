'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useController } from 'react-hook-form';
import { FaPlus, FaTimes } from 'react-icons/fa';
import VariationError from './VariationError';
import VariationLabel from './VariationLabel';
import { useMerchiFormContext } from '../context/MerchiProductFormProvider';
import {
  colourRepeatBounds,
  colourRepeatError,
  coloursFromPickerValue,
  pickerValueFromColours,
} from '../utils/colourRepeat';

interface Props {
  disabled?: boolean;
  name: string;
  variation: any;
}

function slotsFor(value: unknown, min: number): string[] {
  const colours = coloursFromPickerValue(value);
  const slots = colours.slice();
  while (slots.length < min) slots.push('');
  return slots.length ? slots : [''];
}

function VariationColourPickerInput({ disabled, name, variation }: Props) {
  const {
    classNameInputContainer,
    classNameInput,
    control,
  } = useMerchiFormContext();
  const field = variation?.variationField || {};
  const { min, max } = colourRepeatBounds(field);
  const {
    field: formField,
    fieldState: { invalid },
  } = useController({
    name: `${name}.value`,
    control,
    rules: {
      validate: (value) => colourRepeatError(value, field) || true,
    },
  });
  const [slots, setSlots] = useState(() => slotsFor(formField.value, min));
  const stored = String(formField.value ?? '');
  useEffect(() => {
    setSlots((current) => {
      const currentStored = max > 1 ? pickerValueFromColours(current) : (current[0] || '');
      if (currentStored === stored) return current;
      return slotsFor(stored, min);
    });
  }, [stored, min, max]);
  const validationClass = invalid ? 'is-invalid' : '';

  const write = (next: string[]) => {
    setSlots(next);
    formField.onChange(max > 1 ? pickerValueFromColours(next) : (next[0] || ''));
  };

  if (max <= 1) {
    const shown = formField.value || '#000000';
    return (
      <div className={`${classNameInputContainer} merchi-input-color-container`}>
        <VariationLabel
          name={name}
          variationClassName='merchi-input-color'
          variation={variation}
        />
        <input
          aria-label={field.name}
          disabled={disabled}
          type='color'
          className={`${classNameInput} ${validationClass}`}
          value={shown}
          onChange={(event) => formField.onChange(event.target.value.toUpperCase())}
          onBlur={formField.onBlur}
        />
        <VariationError name={name} />
      </div>
    );
  }

  return (
    <div className={`${classNameInputContainer} merchi-input-color-container`}>
      <VariationLabel
        name={name}
        variationClassName='merchi-input-color'
        variation={variation}
      />
      <div className='merchi-colour-repeat'>
        {slots.map((slot, index) => (
          <div key={index} className='merchi-colour-repeat-item'>
            <div className='merchi-colour-repeat-swatch'>
              <input
                aria-label={`${field.name || 'Colour'} ${index + 1}`}
                disabled={disabled}
                type='color'
                className={`${classNameInput} ${validationClass}`}
                value={slot || '#000000'}
                onChange={(event) => {
                  const next = slots.slice();
                  next[index] = event.target.value.toUpperCase();
                  write(next);
                }}
              />
              {slots.length > min && !disabled && (
                <button
                  type='button'
                  className='merchi-colour-repeat-remove'
                  aria-label={`Remove colour ${index + 1}`}
                  onClick={() => write(slots.filter((_, slotIndex) => slotIndex !== index))}
                >
                  <FaTimes />
                </button>
              )}
            </div>
            <span className='merchi-colour-repeat-label'>
              {slot || 'Not chosen'}
            </span>
          </div>
        ))}
        {slots.length < max && !disabled && (
          <button
            type='button'
            className='merchi-colour-repeat-add'
            aria-label='Add colour'
            onClick={() => setSlots(slots.concat(''))}
          >
            <FaPlus />
          </button>
        )}
      </div>
      <VariationError name={name} />
    </div>
  );
}

export default VariationColourPickerInput;
