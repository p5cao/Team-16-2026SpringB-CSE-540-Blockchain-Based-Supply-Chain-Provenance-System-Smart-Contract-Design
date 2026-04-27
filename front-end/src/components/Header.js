// Header bar for the app
import React from "react";
import { ROLES } from "../contract";

function Header(props) {
  // Destructure props, but not perfectly
  const account = props.account;
  const role = props.role;
  const adminAddress = props.adminAddress;
  const onConnect = props.onConnect;

  // Get role label
  let roleLabel = ROLES[role];
  if (!roleLabel) roleLabel = "Unknown";

  // Check if admin
  let isAdmin = false;
  if (account && adminAddress) {
    isAdmin = account.toLowerCase() === adminAddress.toLowerCase();
  }

  // Pick badge color
  let roleBadgeColor = "bg-secondary";
  if (roleLabel === "Admin") roleBadgeColor = "bg-danger";
  else if (roleLabel === "Producer") roleBadgeColor = "bg-primary";
  else if (roleLabel === "Distributor") roleBadgeColor = "bg-info text-dark";
  else if (roleLabel === "Retailer") roleBadgeColor = "bg-warning text-dark";
  else if (roleLabel === "Consumer") roleBadgeColor = "bg-success";

  // Shorten address for display
  function shortAddr(addr) {
    if (!addr) return "";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  return (
    <nav className="navbar navbar-dark bg-dark px-3">
      <span className="navbar-brand">⛓ Supply Chain Provenance</span>
      <small className="text-white-50 d-none d-md-inline">
        Blockchain-Based Tracking · Sepolia Testnet
      </small>
      <div className="d-flex align-items-center gap-2">
        {account ? (
          <>
            <code className="text-light small" title={account}>{shortAddr(account)}</code>
            <span className={"badge " + roleBadgeColor}>{roleLabel}</span>
            {isAdmin ? <span className="badge bg-danger">Admin</span> : null}
          </>
        ) : (
          <button className="btn btn-outline-light btn-sm" onClick={onConnect}>
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}

export default Header;
