export function shipmentMethodId(shipment: any) {
  return shipment?.shipmentMethod?.id ?? null;
}

/**
 * Options come back cheapest-first, and pickup is usually free. Keep the
 * method the customer already chose when that method is still in the list.
 */
export function chooseShipmentOption(shipments: any[], previous: any) {
  const rows = Array.isArray(shipments) ? shipments : [];
  const preferredId = shipmentMethodId(previous);
  if (preferredId != null) {
    const match = rows.find(
      (row) => shipmentMethodId(row?.shipment ?? row) === preferredId
    );
    if (match) return match.shipment ?? match;
  }
  const first = rows[0];
  if (!first) return null;
  return first.shipment ?? first;
}
