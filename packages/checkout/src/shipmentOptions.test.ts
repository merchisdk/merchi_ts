import { chooseShipmentOption } from './shipmentOptions';

const pickup = { shipment: { shipmentMethod: { id: 1, name: 'Pickup', pickUp: true } } };
const express = { shipment: { shipmentMethod: { id: 2, name: 'Express', pickUp: false } } };

test('keeps a paid method when options are refetched cheapest-first', () => {
  const kept = chooseShipmentOption([pickup, express], express.shipment);
  expect(kept.shipmentMethod.id).toBe(2);
});

test('uses the cheapest option when nothing was selected', () => {
  const kept = chooseShipmentOption([pickup, express], null);
  expect(kept.shipmentMethod.id).toBe(1);
});

test('falls back to the cheapest option when the chosen method is gone', () => {
  const kept = chooseShipmentOption([pickup], express.shipment);
  expect(kept.shipmentMethod.id).toBe(1);
});
