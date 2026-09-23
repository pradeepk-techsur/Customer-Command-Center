import type { Role } from "../../shared/types.ts";

export type Page = "orders" | "admin" | "actionitems" | "deliverables" | "contractfile";

export function Masthead({ page, role, userName, contract, onPage, onLogout }: {
  page: Page; role: Role; userName?: string; contract: { agency: string; vehicle: string; number: string };
  onPage: (p: Page) => void; onLogout?: () => void;
}) {
  const roleLabel = role === "pm" ? "Project Manager" : role === "program_manager" ? "Program Manager" : role === "admin" ? "Administrator" : "Customer";
  const isProgramManager = role === "program_manager";
  // pm (Aidan/Jessica) can only reach the Approved Sign-in List within Admin, per decision #4.
  const canAccessAdmin = role === "admin" || role === "program_manager" || role === "pm";

  return (
    <header className="masthead">
      <div className="masthead-row">
        <button type="button" className="masthead-title" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} onClick={() => onPage("orders")}>TechSur Mission Control</button>
        <div className="masthead-contract">{contract.agency} &nbsp;·&nbsp; {contract.vehicle} &nbsp;·&nbsp; {contract.number}</div>
      </div>
      <div className="masthead-nav">
        <nav className="nav-tabs">
          <button type="button" className={"nav-tab" + (page === "orders" ? " active" : "")} onClick={() => onPage("orders")}>BPA Dashboard</button>
          <button type="button" className={"nav-tab" + (page === "actionitems" ? " active" : "")} onClick={() => onPage("actionitems")}>Action Items</button>
          <button type="button" className={"nav-tab" + (page === "deliverables" ? " active" : "")} onClick={() => onPage("deliverables")}>Contracts Deliverables</button>
          <button type="button" className={"nav-tab" + (page === "contractfile" ? " active" : "")} onClick={() => onPage("contractfile")}>Contract File</button>
          {canAccessAdmin && (
            <button type="button" className={"nav-tab" + (page === "admin" ? " active" : "")} onClick={() => onPage("admin")}>{isProgramManager ? "Manage Users" : "Admin"}</button>
          )}
        </nav>
        {userName && onLogout && (
          <div className="user-menu">
            <span className="user-name">{userName}</span>
            <span className="user-role">({roleLabel})</span>
            <button type="button" className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        )}
      </div>
    </header>
  );
}
