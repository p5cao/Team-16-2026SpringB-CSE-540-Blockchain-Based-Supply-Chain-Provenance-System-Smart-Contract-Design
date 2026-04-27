// Shared helpers used across the different tab components
import React from "react";

// Shows a message when wallet is not connected
function WalletNotConnected(props) {
  const roleName = props.roleName;
  return (
    <div className="text-center py-5">
      <div className="fs-1">🔗</div>
      <h4>Wallet Not Connected</h4>
      <p className="text-muted">
        Connect your MetaMask wallet to access {roleName} capabilities.
      </p>
    </div>
  );
}

// Shows a message when user doesn't have the right role
function AccessDenied(props) {
  const icon = props.icon;
  const roleName = props.roleName;
  const extra = props.extra;
  return (
    <div className="text-center py-5">
      <div className="fs-1">{icon}</div>
      <h4>{roleName} Access Required</h4>
      <p className="text-muted">
        Your current role does not have {roleName} privileges.
      </p>
      <p className="text-muted">
        Contact the contract Admin to have the <strong>{roleName}</strong> role assigned to your address.
      </p>
      {extra ? extra : null}
    </div>
  );
}

// Returns the right Bootstrap alert class for a status
function alertClass(status) {
  if (status === "success") return "alert-success";
  if (status === "error") return "alert-danger";
  return "alert-info";
}

// Renders a list of "Coming Soon" capability cards
function CapabilitiesList(props) {
  const items = props.items;
  const colClass = props.colClass || 'col-md-4';

  const cards = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    cards.push(
      <div className={colClass} key={item.title}>
        <div className="card h-100">
          <div className="card-body text-center">
            <div className="fs-2 mb-2">{item.icon}</div>
            <h6 className="card-title">{item.title}</h6>
            <p className="card-text text-muted small">{item.desc}</p>
            <span className="badge bg-secondary">Coming Soon</span>
          </div>
        </div>
      </div>
    );
  }

  return <div className="row g-3">{cards}</div>;
}

export { WalletNotConnected, AccessDenied, alertClass, CapabilitiesList };
