import React from 'react';
import { WalletNotConnected, AccessDenied, CapabilitiesList } from './TabHelpers';

const CAPABILITIES = [
  { icon: '🔍', title: 'View Product History', desc: 'Look up any product by ID to see its full blockchain-verified supply chain journey.' },
];

function ConsumerTab({ account, role }) {
  const isConsumer = role === 2;

  if (!account) {
    return <WalletNotConnected roleName="Consumer" />;
  }

  if (!isConsumer) {
    return <AccessDenied icon="🔍" roleName="Consumer" />;
  }

  return (
    <div>
      <h4>🔍 Consumer Dashboard</h4>
      <p className="text-muted mb-4">Verify product authenticity and trace the complete provenance journey from producer to shelf.</p>
      <CapabilitiesList items={CAPABILITIES} colClass="col-md-4" />
    </div>
  );
}

export default ConsumerTab;
