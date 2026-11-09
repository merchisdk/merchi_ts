import { ShipmentService } from './shipment_services.js';

test('dhl exists', () => {
  expect(ShipmentService.SENDLE).toBe(1);
});

test('dhl express service id', () => {
  expect(ShipmentService.DHL_EXPRESS).toBe(4);
});
