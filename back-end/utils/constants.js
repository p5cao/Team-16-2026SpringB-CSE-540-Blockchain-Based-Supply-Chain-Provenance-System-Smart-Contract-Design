/**
 * Mirrors the enums in SupplyChainProvenance.sol.
 * Used to derive human-readable names when writing to the DB.
 */

export const ROLE_NAMES = {
  0: 'UnRegistered',
  1: 'Producer',
  2: 'Consumer',
  3: 'Distributor',
  4: 'Retailer',
  5: 'Admin',
  6: 'Auditor',
};

export const STATUS_NAMES = {
  0:  'InProduction',
  1:  'ReadyToShip',
  2:  'InTransitToWarehouse',
  3:  'ShippedToWarehouse',
  4:  'WHQualityCheckPassed',
  5:  'ReturnedToProducer',
  6:  'InWarehouse',
  7:  'InTransitToRetailer',
  8:  'ShippedToRetailer',
  9:  'RetailerQualityCheckPassed',
  10: 'RetailerReturnedToWarehouse',
  11: 'InStore',
  12: 'Sold',
};

export function roleName(num) {
  return ROLE_NAMES[Number(num)] ?? 'Unknown';
}

export function statusName(num) {
  return STATUS_NAMES[Number(num)] ?? 'Unknown';
}
