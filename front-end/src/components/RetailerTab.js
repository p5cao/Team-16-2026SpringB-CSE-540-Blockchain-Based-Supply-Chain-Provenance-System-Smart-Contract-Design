import React from 'react';
import { WalletNotConnected, AccessDenied, CapabilitiesList } from './TabHelpers';

const CAPABILITIES = [
  { icon: '📬', title: 'Receive Shipment', desc: 'Acknowledge receipt of product shipments from the warehouse distributor.' },
  { icon: '↩️', title: 'Return to Warehouse', desc: 'Send products that failed quality checks back to the distributor warehouse.' },
  { icon: '🛒', title: 'Put on Shelf', desc: 'Mark approved products as available In Store for consumer purchase.' },
  { icon: '💳', title: 'Sell to Consumer', desc: 'Record a product sale to a consumer, completing the supply chain journey.' },
];

function RetailerTab({ account, role }) {
  const isRetailer = role === 4;

  if (!account) {
    return <WalletNotConnected roleName="Retailer" />;
  }

  if (!isRetailer) {
    return <AccessDenied icon="🛍️" roleName="Retailer" />;
  }

  return (
    <div>
      <h4>🛍️ Retailer Dashboard</h4>
      <p className="text-muted mb-4">Handle incoming shipments from distributors, manage store inventory, and process consumer sales.</p>
      <CapabilitiesList items={CAPABILITIES} colClass="col-md-3" />
    </div>
  );
}

export default RetailerTab;
