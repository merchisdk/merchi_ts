'use client';
import React from 'react';
import { debounce } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMerchiCheckboutContext } from '../MerchiCheckoutProvider';
import InputsAddress from './InputsAddress';
import CheckboxBillingAddressSameAsShippingAddress from './CheckboxBillingAddressSameAsShippingAddress';
import InputError from './InputError';
import { ListShipmentQuoteOptions } from '../lists';
import {
  getSavedShippingAddress,
  loadCheckoutSession,
} from '../../checkoutSession';
import { chooseShipmentOption } from '../../shipmentOptions';

interface PropsAddress {
  defaultAddress?: any;
  labelGeoSuggest?: string;
  hookForm: any;
  name?: string;
  placeholder?: string;
  recommendedAddress?: any;
  updateAddress: (address: any) => void;
}

const ShippingAddressInputs = (props: PropsAddress) => (
  <InputsAddress {...props} name='shippingAddress' />
);
const BillingAddressInputs = (props: PropsAddress) => (
  <InputsAddress {...props} name='billingAddress' />
);

interface Props {
  formId: string;
}

function addressesMatch(left: any, right: any) {
  if (!left?.lineOne || !right?.lineOne) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function FormAddresses({ formId }: Props) {
  const { job, merchi, nextTab, product, setJob } = useMerchiCheckboutContext();
  const recommendedShipping = getSavedShippingAddress(
    loadCheckoutSession(product)
  );
  const [
    billingAddressSameAsShippingAddress,
    setBillingAddressSameAsShippingAddress,
  ] = useState(() => addressesMatch(job.shipping, job.billing));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shipmentOptions, setShipmentOptions] = useState([]);
  const hookForm = useForm({
    defaultValues: {
      shippingAddress: job.shipping || {},
      billingAddress: job.billing || {},
    },
  });
  const {
    getValues,
    handleSubmit,
    reset,
  } = hookForm;
  // Back closes the checkout modal and unmounts this form. A quote request
  // that is still running must not then replace the customer's method with
  // the cheapest default (usually pickup).
  const shipmentFetchGeneration = useRef(0);
  const checkoutRef = useRef({ job, merchi, setJob });
  checkoutRef.current = { job, merchi, setJob };
  const debouncedFetchShippingOptions = useRef(
    debounce(async (address: any, generation: number) => {
      const { job: currentJob, merchi: currentMerchi, setJob: setCurrentJob } =
        checkoutRef.current;
      setError(null);
      setLoading(true);
      try {
        const { product = {}, quantity = 0 } = currentJob;
        const addressEnt = new currentMerchi.Address()
          .fromJson(address, {makeDirty: true})
          .toFormData({_prefix: 'address-0'});
        const query: any[] = [['quantity', quantity.toString()]];
        const r = await currentMerchi.authenticatedFetch(
          `/products/${(product as any).id}/shipment_options/`,
          {body: addressEnt, method: 'POST', query}
        );
        if (generation !== shipmentFetchGeneration.current) return;
        const shipments = r.shipments ?? [];
        setShipmentOptions(shipments);
        setCurrentJob((prev: any) => ({
          ...prev,
          shipment: chooseShipmentOption(shipments, prev?.shipment),
        }));
      } catch (e: any) {
        if (generation !== shipmentFetchGeneration.current) return;
        setError(e);
      } finally {
        if (generation === shipmentFetchGeneration.current) setLoading(false);
      }
    }, 1000)
  ).current;

  useEffect(() => {
    return () => {
      shipmentFetchGeneration.current += 1;
      debouncedFetchShippingOptions.cancel();
    };
  }, [debouncedFetchShippingOptions]);

  useEffect(() => {
    if (!job.shipping?.lineOne) return;

    reset({
      shippingAddress: job.shipping,
      billingAddress: job.billing || job.shipping,
    });
    setBillingAddressSameAsShippingAddress(
      addressesMatch(job.shipping, job.billing)
    );
    const generation = shipmentFetchGeneration.current;
    debouncedFetchShippingOptions(job.shipping, generation);
  }, [job.shipping?.lineOne]);

  function persistAddressToJob(name: string, address: any) {
    setJob((prev: any) => {
      if (name === 'shippingAddress') {
        return {
          ...prev,
          shipping: address,
          billing: billingAddressSameAsShippingAddress
            ? address
            : prev.billing,
        };
      }
      return { ...prev, billing: address };
    });
  }

  async function updateAddress(name: string, fetch: boolean, address: any) {
    // Guard against accidental non-object values (e.g. a field name string),
    // which would wipe nested address inputs on reset.
    if (!address || typeof address !== 'object') return;

    const values = getValues();
    values[name] = address;
    reset(values);
    persistAddressToJob(name, address);
    if (fetch) {
      debouncedFetchShippingOptions(address, shipmentFetchGeneration.current);
    }
  }
  function onSelectShipment(shipment: any) {
    setJob((prev: any) => ({ ...prev, shipment }));
  }
  async function onSubmit(values: any) {
    const address = values.shippingAddress;
    const newJob = { ...job };
    newJob.shipping = address;
    newJob.billing = billingAddressSameAsShippingAddress
      ? address
      : values.billingAddress;
    setJob(newJob);
    nextTab();
  }
  return (
    <>
      <form id={formId} onSubmit={handleSubmit(onSubmit)}>
        <ShippingAddressInputs
          defaultAddress={job.shipping}
          hookForm={hookForm}
          name='shippingAddress'
          recommendedAddress={recommendedShipping}
          updateAddress={(addr: any) =>
            updateAddress('shippingAddress', true, addr)
          }
        />
        <CheckboxBillingAddressSameAsShippingAddress
          billingAddressSameAsShippingAddress={
            billingAddressSameAsShippingAddress
          }
          setBillingAddressSameAsShippingAddress={
            setBillingAddressSameAsShippingAddress
          }
        />
        {!billingAddressSameAsShippingAddress && (
          <BillingAddressInputs
            defaultAddress={job.billing}
            hookForm={hookForm}
            labelGeoSuggest='Billing Address'
            name='billingAddress'
            updateAddress={(addr: any) =>
              updateAddress('billingAddress', false, addr)
            }
          />
        )}
        <InputError error={error || {}} />
        <ListShipmentQuoteOptions
          doSelectShipmentOption={onSelectShipment}
          loading={loading}
          selectedOption={job.shipment}
          shipmentOptions={shipmentOptions}
        />
      </form>
    </>
  );
}

export default FormAddresses;
