import React from 'react';
import { WalletNotConnected, AccessDenied, CapabilitiesList } from './TabHelpers';

const CAPABILITIES = [
  { icon: '📦', title: 'Receive from Producer', desc: 'Acknowledge and record incoming product shipments from producers.' },
  { icon: '↩️', title: 'Return to Producer', desc: 'Mark products that failed quality inspection for return to the producer.' },
  { icon: '🚛', title: 'Ship to Retailer', desc: 'Dispatch approved inventory toward retailer locations.' },
];

function DistributorTab({ account, role }) {
  const isDistributor = role === 3;

  if (!account) {
    return <WalletNotConnected roleName="Distributor" />;
  }

  if (!isDistributor) {
    return <AccessDenied icon="🏬" roleName="Distributor" />;
  }

  return (
    <div>
      <h4>🏬 Distributor Dashboard</h4>
      <p className="text-muted mb-4">Manage warehouse operations: receive shipments, perform quality checks, and dispatch to retailers.</p>
      <CapabilitiesList items={CAPABILITIES} colClass="col-md-4" />
    </div>
  );
}

export default DistributorTab;
