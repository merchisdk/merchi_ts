import { useForm } from "react-hook-form";
import InputsAddress from "./InputsAddress";
import { CheckoutContainer, InnerContainer } from "../components/containers";
import { Title } from "../components";
import {
  checkoutShipmentHydrationAction,
  shipmentFormId,
} from "../utilities/shipment";
import { getCheckoutCartClient } from "../utilities/checkoutCartClient";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { useCartContext } from "../CartProvider";
import { useEffect, useRef, useState } from "react";
import { makeAddress, sanitizeAddressFields } from "../utilities/address";
import { cartEmbed } from "../utilities/helpers";
import { tabIdCheckout } from "../utilities/tabs";
import {
  addressHasContent,
  getSavedCheckoutAddress,
  saveCheckoutAddress,
} from "../utilities/local_storage";

interface PropsAddress {
  defaultAddress?: any;
  labelGeoSuggest?: string;
  hookForm: any;
  name?: string;
  placeholder?: string;
  updateAddress: (address: any) => void;
}

const AddressGeoSuggestInput = (props: PropsAddress) => (
  <InputsAddress {...props} name="receiverAddress" />
);

interface Props {
  address?: any;
  addressFieldsOpen: boolean;
  formId: string;
  notes?: string;
  showIcon?: boolean;
  deliveryNomenclature?: boolean;
  showHeadings?: boolean;
  setCartShipmentAddress: (values: any) => void | Promise<void>;
  toggleAddressFields: () => void;
}

function FormShipmentAddressAndNotes({
  address = {},
  formId,
  notes = "",
  showIcon = true,
  deliveryNomenclature = false,
  showHeadings = true,
  setCartShipmentAddress,
}: Props) {
  const { classNameCartFormGroup, updateCartShipmentAddress } =
    useCartContext();
  const hookForm = useForm({
    defaultValues: {
      receiverAddress: address,
      receiverNotes: notes,
    },
  });
  const { getValues, handleSubmit, register, reset } = hookForm;

  async function onSubmit() {
    await setCartShipmentAddress(getValues());
  }
  function updateAddress(addr: any) {
    const oldAddresses: any = getValues();
    const newAddress = addr ? { ...addr } : {};
    oldAddresses["receiverAddress"] = newAddress;
    reset(oldAddresses);
    updateCartShipmentAddress(newAddress);
  }
  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
      {showHeadings && (
        <CheckoutContainer>
          <InnerContainer paddingBottom="0px">
            <Title
              icon={showIcon ? faMapMarkerAlt : null}
              title="Delivery / billing address"
            />
          </InnerContainer>
        </CheckoutContainer>
      )}
      <AddressGeoSuggestInput
        defaultAddress={address}
        hookForm={hookForm}
        labelGeoSuggest={`Enter your ${
          deliveryNomenclature ? "delivery" : "shipping"
        } address`}
        name="receiverAddress"
        updateAddress={updateAddress}
      />
      <div className={classNameCartFormGroup}>
        <label>{deliveryNomenclature ? "Delivery" : "Shipment"} notes</label>
        <textarea
          className="form-control input"
          defaultValue={notes}
          placeholder="Example - Leave at top of stairs"
          rows={4}
          {...register("receiverNotes")}
        ></textarea>
      </div>
    </form>
  );
}

export function ActiveFormShipmentAddressAndNotes() {
  const {
    alertError,
    domainId,
    cart,
    setCart,
    setLoadingTotals,
    setActiveTabAndEditDisabled,
    updateCartShipmentAddress,
    getCartShipmentOptions,
  } = useCartContext();
  const saved = getSavedCheckoutAddress(domainId);
  const cartAddress = cart?.receiverAddress;
  const receiverAddress = addressHasContent(cartAddress)
    ? cartAddress
    : saved.address || {};
  const receiverNotes = cart?.receiverNotes || saved.receiverNotes || "";
  const [addressFieldsOpen, setAddressFieldsOpen] = useState(false);
  const hydratedShipmentOptionsRef = useRef(false);
  const currentCartId = useRef(cart?.id);

  useEffect(() => {
    currentCartId.current = cart?.id;
    return () => { currentCartId.current = undefined; };
  }, [cart?.id]);

  useEffect(() => {
    if (hydratedShipmentOptionsRef.current || !cart?.id) return;
    const draft = getSavedCheckoutAddress(domainId);
    const action = checkoutShipmentHydrationAction({
      cartAddress: cart?.receiverAddress,
      savedAddress: draft.address,
      shipmentGroups: cart?.shipmentGroups,
    });
    if (!action) return;
    hydratedShipmentOptionsRef.current = true;
    if (action === "apply-saved-address" && draft.address) {
      updateCartShipmentAddress(draft.address);
      return;
    }
    if (action === "refresh-quotes") {
      getCartShipmentOptions?.();
    }
  }, [
    cart?.id,
    cart?.receiverAddress,
    cart?.shipmentGroups,
    domainId,
    getCartShipmentOptions,
    updateCartShipmentAddress,
  ]);

  async function saveCartShipmentAddressAndGoToNextTab(values: any) {
    const cartId = cart?.id;
    if (!cartId || cart.invoice?.unpaid === false) return;

    const { receiverAddress: address, receiverNotes } = values;
    setLoadingTotals(true);
    try {
      const shipmentApi = await getCheckoutCartClient(cart, domainId);
      if (!shipmentApi) {
        alertError("Unable to verify this cart. Reload checkout and try again.");
        return;
      }
      // Never PATCH an existing Address via cart token — create a fresh embed.
      const addressFields = sanitizeAddressFields(address);
      const receiverAddress = makeAddress(addressFields, true);
      const cartEnt = new shipmentApi.Cart().fromJson(cart);
      cartEnt.receiverAddress = receiverAddress;
      cartEnt.receiverNotes = receiverNotes;
      const savedCart = await cartEnt.save({ embed: cartEmbed });
      if (currentCartId.current !== cartId) return;

      saveCheckoutAddress(domainId, addressFields, receiverNotes);
      const cartJson = savedCart.toJson();
      setCart((current: any) => current?.id === cartId ? cartJson : current);
      setActiveTabAndEditDisabled({
        tabId: tabIdCheckout,
        tabIndexToSet: 2,
        disabled: false,
      });
    } catch (e: any) {
      alertError(
        e.errorMessage || e.message || "Unable to set shipment address."
      );
    } finally {
      setLoadingTotals(false);
    }
  }
  return (
    <FormShipmentAddressAndNotes
      address={receiverAddress}
      addressFieldsOpen={addressFieldsOpen}
      formId={shipmentFormId}
      notes={receiverNotes}
      setCartShipmentAddress={saveCartShipmentAddressAndGoToNextTab}
      toggleAddressFields={() => setAddressFieldsOpen(!addressFieldsOpen)}
    />
  );
}

export default FormShipmentAddressAndNotes;
