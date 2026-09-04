import type { Role } from "../../shared/types.ts";

export type Page = "orders" | "msr";

export function Masthead({ page, role, contract, onPage, onRole }: {
  page: Page; role: Role; contract: { agency: string; vehicle: string; number: string };
  onPage: (p: Page) => void; onRole: (r: Role) => void;
}) {
  return (
    <header className="masthead">
      <div className="masthead-row">
        <div className="masthead-title">Contract Transparency Portal</div>
        <div className="masthead-contract">{contract.agency} &nbsp;·&nbsp; {contract.vehicle} &nbsp;·&nbsp; {contract.number}</div>
      </div>
      <div className="masthead-nav">
        <nav className="nav-tabs">
          <button type="button" className={"nav-tab" + (page === "orders" ? " active" : "")} onClick={() => onPage("orders")}>Call Orders</button>
          <button type="button" className={"nav-tab" + (page === "msr" ? " active" : "")} onClick={() => onPage("msr")}>Monthly Status Reports</button>
        </nav>
        <div className="role-switch">
          <span className="eyebrow">View as</span>
          <button type="button" className={"pill" + (role === "customer" ? " active" : "")} onClick={() => onRole("customer")}>Customer</button>
          <button type="button" className={"pill" + (role === "pm" ? " active" : "")} onClick={() => onRole("pm")}>Project Manager</button>
        </div>
      </div>
    </header>
  );
}
