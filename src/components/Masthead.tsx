import type { Role } from "../../shared/types.ts";

export type Page = "orders" | "msr" | "myreports" | "weeklyreports" | "admin";

export function Masthead({ page, role, userName, contract, onPage, onLogout }: {
  page: Page; role: Role; userName?: string; contract: { agency: string; vehicle: string; number: string };
  onPage: (p: Page) => void; onLogout?: () => void;
}) {
  const roleLabel = role === "pm" ? "Project Manager" : role === "program_manager" ? "Program Manager" : role === "admin" ? "Administrator" : "Customer";
  const isAdmin = role === "admin";
  const isProgramManager = role === "program_manager";
  const isPm = role === "pm";
  const canAccessMsr = role === "customer" || role === "program_manager" || role === "admin";
  const canViewWeeklyReports = role === "customer" || role === "program_manager" || role === "admin";
  const showCallOrders = role !== "pm";
  const canAccessAdmin = role === "admin" || role === "program_manager";
  
  return (
    <header className="masthead">
      <div className="masthead-row">
        <div className="masthead-title">Contract Transparency Portal</div>
        <div className="masthead-contract">{contract.agency} &nbsp;·&nbsp; {contract.vehicle} &nbsp;·&nbsp; {contract.number}</div>
      </div>
      <div className="masthead-nav">
        <nav className="nav-tabs">
          {showCallOrders && (
            <button type="button" className={"nav-tab" + (page === "orders" ? " active" : "")} onClick={() => onPage("orders")}>Call Orders</button>
          )}
          {canViewWeeklyReports && (
            <button type="button" className={"nav-tab" + (page === "weeklyreports" ? " active" : "")} onClick={() => onPage("weeklyreports")}>Weekly Status Reports</button>
          )}
          {canAccessMsr && (
            <button type="button" className={"nav-tab" + (page === "msr" ? " active" : "")} onClick={() => onPage("msr")}>Monthly Status Reports</button>
          )}
          {canAccessAdmin && (
            <button type="button" className={"nav-tab" + (page === "admin" ? " active" : "")} onClick={() => onPage("admin")}>{isProgramManager ? "Manage Customers" : "Admin"}</button>
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
