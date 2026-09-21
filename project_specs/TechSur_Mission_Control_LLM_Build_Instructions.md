# TechSur Mission Control
## Master Build Instructions for an LLM Coding Agent

**Document purpose:** Use this document as the governing instruction for designing and building TechSur Mission Control. Treat it as the primary source of truth. Do not infer requirements from earlier prototypes when they conflict with this document.

---

## 1. Your Role

Act as a senior product architect, UX designer, security architect, data architect, and full-stack engineer. Build a secure, maintainable, role-based contract-management and weekly-briefing system called **TechSur Mission Control**.

Your job is to:

1. Understand the existing application and technology stack before changing code.
2. Preserve working components that conform to this specification.
3. Replace or revise components that conflict with this specification.
4. Build only the approved Phase I scope.
5. Use one shared data model so information is entered once and reused throughout the system.
6. Produce tested, traceable, accessible, and maintainable code.

Do not invent business rules, fields, integrations, roles, calculations, workflows, or Phase II features. Record unresolved matters in the Decision Log and stop at the applicable approval gate.

---

## 2. Product Vision

Mission Control must communicate that TechSur is:

- Technology-forward.
- Mission-ready.
- Transparent with its customers.
- Disciplined about contract and program management.
- Focused on reducing administrative burden.

The system must give government Contracting Officer's Representatives (CORs) clear, current, and drillable information while making Monday preparation for Tuesday status meetings faster for TechSur staff.

### Priority order

When two requirements conflict, use this order:

1. Tuesday weekly-brief readiness.
2. Accuracy, traceability, and customer transparency.
3. Enter information once and reuse it everywhere.
4. Simple maintenance for Paul, Aidan, and Jessica.
5. Security and least-privilege access.
6. Visual polish.
7. Optional convenience features.

The system must never add work merely to create a more elaborate workflow.

---

## 3. Governing Design Principle

Use the following operating model:

> Maintain once → generate current views → review the weekly brief → lock the record → use it in the Tuesday meeting → carry decisions and actions into the next cycle.

Core contract, financial, invoice, staffing, deliverable, risk, issue, and action data must not be copied into separate weekly-report tables. The weekly brief must reference or snapshot the same governed records.

Weekly narrative is the only report-specific content that administrators should normally add during weekly preparation.

---

## 4. Phase I Scope

### 4.1 Included

- Password-free customer access using an approved-email allowlist and temporary magic links.
- SSO for TechSur staff when supported by the current environment.
- Role-based authorization.
- BPA and call-order hierarchy.
- Periods of performance, including base and option periods.
- CLIN-level funding and monthly actual/projected spend.
- Invoice tracking and linked invoice files.
- Contract award and modification files.
- Deliverable tracking and file or external-URL references.
- Personnel, billets, LCATs, assignments, onboarding, government property, former staff, and personnel movements.
- Action items, risks, and issues.
- Weekly Status Brief grouped by call order.
- Weekly narrative and discussion points.
- COR preview.
- Weekly-report locking, versioning, archive, and search.
- Complete audit history for important changes and access events.
- Uploading the BPA Monthly Status Report as a deliverable.

### 4.2 Explicitly excluded from Phase I

- Call Order PM data-entry or submission workflow.
- The existing Project Manager submission followed by Program Manager revision workflow.
- Leave tracking.
- A workflow that assembles the Monthly Status Report from Call Order PM submissions.
- Automatically emailing marketing content to unapproved addresses.
- AI-generated contract, financial, staffing, risk, issue, or status-report content.
- New external integrations not explicitly approved.

### 4.3 Phase II candidates

- Call Order PM direct input.
- Leave management.
- Monthly Status Report workflow and aggregation.
- Approved marketing-nurture integration.
- Additional notifications, workflow automation, or external-system integrations.

Do not expose inactive Phase II controls in the Phase I user interface.

---

## 5. Users and Permissions

### 5.1 BPA Program Manager — Paul

Paul is accountable for the accuracy and readiness of the weekly brief.

Paul can:

- View all Mission Control information.
- Create and update all operational records.
- Upload and link files.
- Add and edit weekly narrative.
- Preview the COR experience.
- Lock and publish a weekly report.
- Create a corrected report version when a locked report contains an error.
- View audit history.

Paul cannot directly alter or delete a locked report version. Corrections must create a new version while preserving the original.

### 5.2 PM Support — Aidan and Jessica

Aidan and Jessica maintain operational information continuously.

They can:

- View all Mission Control information.
- Create and update contract, financial, invoice, staffing, deliverable, action, risk, issue, and weekly-narrative records.
- Upload and link files.
- Prepare the weekly brief.
- Preview the COR experience.
- View audit history for records they can maintain.

They cannot:

- Lock or publish the official weekly report.
- Correct or supersede a locked report.
- Change role assignments or approved-email access unless separately authorized.

### 5.3 CORs — Joan and Dean-Anne

Joan and Dean-Anne are read-only customer users.

They can:

- Open the current published weekly brief.
- Expand each call-order section.
- Drill into supporting contract, financial, invoice, staffing, deliverable, action, risk, and issue information.
- Open authorized uploaded files or external links.
- Search and view locked historical weekly reports.

They cannot:

- Create, edit, delete, lock, publish, or correct records.
- View internal drafts unless Paul has explicitly published them.
- View security administration or access-attempt data.

### 5.4 Authorization rule

Enforce permissions on the server/API for every read and write. Hiding a button in the user interface is not authorization.

---

## 6. Primary UI Navigation

Use one consistent application shell. The navigation must contain:

1. **Weekly Brief**
2. **Contracts**
3. **Staffing**
4. **Deliverables**
5. **Risks & Issues**
6. **Report Archive**

### Role-based landing pages

- CORs land directly on the current published Weekly Brief.
- Paul, Aidan, and Jessica land on a Preparation Center showing records that need attention before the next meeting.

The Preparation Center must be exception-driven. It should identify items such as:

- A newly received modification that has not been entered.
- A PoP approaching expiration.
- An overdue invoice.
- An open billet or incomplete onboarding milestone.
- A deliverable approaching or past its due date.
- An unresolved action, risk, or issue.
- Missing weekly narrative or validation errors.

Do not create decorative dashboard cards without a direct user action or decision behind them.

---

## 7. Core Data Model

Use normalized entities and stable identifiers. Do not store important history only in free text.

### 7.1 Contract hierarchy

The minimum hierarchy is:

```text
BPA Award
  └── Call Order
        └── Period of Performance
              └── CLIN
```

Required entities:

- `bpa_award`
- `call_order`
- `period_of_performance`
- `clin`
- `contract_modification`
- `funding_transaction`
- `monthly_spend`
- `invoice`
- `contract_file`
- `deliverable`
- `billet`
- `person`
- `person_assignment`
- `personnel_movement`
- `government_asset`
- `onboarding_milestone`
- `action_item`
- `risk`
- `issue`
- `issue_update`
- `weekly_report`
- `weekly_report_call_order`
- `weekly_narrative`
- `weekly_report_snapshot`
- `audit_event`
- `approved_user`
- `authentication_event`

### 7.2 History rule

Do not overwrite historical assignments, LCATs, PoPs, funding actions, status changes, or locked reports. Use effective dates and status history.

### 7.3 File-reference rule

A file reference must support either:

- A file uploaded to Mission Control; or
- An authorized external URL, such as an AO SharePoint link.

Store the display name, reference type, URL or file identifier, associated record, uploaded/linked by, and timestamp. Do not assume that a COR can open an external link; display a clear access error without exposing credentials or internal system details.

---

## 8. Contract Workspace Requirements

### 8.1 Contract summary

The first record must be the BPA award. Call orders follow it.

Show:

- Call Order Name.
- Current Period of Performance.
- Funded Value.
- Expenditures to Date.
- Estimate at Completion.

Selecting a call order opens its detail workspace.

### 8.2 Call-order detail sections

Each call order must provide:

1. Financial Status.
2. Invoices.
3. Contract File.
4. Deliverables.
5. Staffing.
6. Risks.
7. Issues.

Use a clear tab or section pattern. Preserve the user's selected call order while navigating between these sections.

---

## 9. Financial Rules

### 9.1 Required values

At call-order and CLIN level, support:

- Funds Obligated.
- Funds Expended.
- Funds Remaining.
- Monthly Actual Spend.
- Monthly Projected Spend.
- Estimate at Completion.
- Over/Under.

### 9.2 Calculations

Use these formulas:

```text
Funds Remaining = Funds Obligated - Funds Expended

Estimate at Completion = Funds Expended
                       + Sum of Projected Spend for all future months

Over/Under = Funds Obligated - Estimate at Completion
```

Interpretation:

- Positive Over/Under means projected under funding.
- Zero means projected to use exactly all funding.
- Negative means projected over funding.

### 9.3 Warning rules

- Display EAC in red when `EAC > Funds Obligated`.
- Display Over/Under in red when `Over/Under < 0`.
- Display the current PoP in red when its end date is within 30 calendar days, including the end date.
- Do not use color alone. Include text or an icon such as “Projected over funding.”

### 9.4 Financial chart

Show a monthly cumulative-spend line chart with:

- Actual spend through the latest closed month.
- Projected spend for future months.
- A visually distinct transition from actual to projected.
- Currency-formatted axes and accessible text equivalents.
- The current EAC endpoint.

Use the term **spend**, not revenue.

### 9.5 PoP funding

Tie every funding transaction and CLIN to a specific PoP. Do not merge expired base-period funding with option-period funding. Historical PoPs and their funding remain visible.

---

## 10. Invoice Requirements

Required fields:

- Call Order.
- Invoice Date.
- Amount.
- Billing Period.
- Payment Status.
- Payment Date, when paid.
- File Reference.

### Aging calculation

Until another business definition is approved, calculate age from `Invoice Date`.

```text
If status is Paid:
  Do not show an overdue warning.

If status is not Paid and age is 0–20 days:
  Normal status.

If status is not Paid and age is 21–29 days:
  Yellow warning.

If status is not Paid and age is 30 days or more:
  Red warning.
```

### Weekly-report behavior

- Show the most recent unpaid invoice for each call order.
- When an invoice is marked paid, include it in the first weekly report locked after payment.
- Do not include it in later current weekly reports unless the user drills into invoice history.
- Retain all invoices permanently in the call-order history.

---

## 11. Contract File Requirements

Show a table of the base award and all modifications.

Required fields:

- Name, linked to the file or URL.
- Associated BPA or Call Order.
- Associated PoP.
- Is Administrative Modification: Yes/No.
- Is Funding Modification: Yes/No.
- Funding Change, required when Is Funding Modification is Yes.
- Effective Date.
- Modification Number.

A modification may be both administrative and funding-related.

Group or filter the table by PoP. Do not overwrite prior-period modifications when a new option period begins.

---

## 12. Deliverable Requirements

Required fields:

- BPA or Call Order.
- Name.
- Deliverable Type.
- Due Date.
- Delivery Date.
- Acceptance Status.
- Acceptance Date, when applicable.
- File Reference or External URL.

Allow these acceptance states:

- Not Submitted.
- Submitted.
- Accepted.
- Rejected.
- Resubmission Required.

The Monthly Status Report is a BPA-level deliverable. Phase I must allow staff to upload or link the completed Word or PDF file each month. Do not build a Monthly Status Report authoring workflow in Phase I.

---

## 13. Staffing Requirements

### 13.1 Separate billets, people, and assignments

- A billet represents an authorized Call Order position and LCAT.
- A person represents an individual.
- An assignment connects a person to a billet for an effective date range.
- A movement records an approved future or completed change between Call Orders or LCATs.

Do not store the current person directly on the billet without assignment history.

### 13.2 Staffing summary

Show:

- Call Order.
- Billet.
- LCAT.
- Assigned Person.
- Contract Billing Rate.
- Staffing Status.

Allowed staffing states:

- Filled.
- Open — Sourcing.
- Open — On Hold.
- Resource Onboarding.
- Vacant.

“Rate” means the contract billing rate, never employee compensation.

### 13.3 Person detail

Show:

- Name.
- AO Email Address.
- Contact Phone Number.
- Start Date.
- End Date, when applicable.
- Current Call Order.
- Current LCAT.
- Assigned AO laptops.
- AO Laptop Make and Model.
- AO Property Tag Number.
- Property-return paperwork for former staff.

A person may have more than one laptop.

### 13.4 Onboarding milestones

Track these milestone dates independently:

1. Offer Accepted.
2. OF-306 Submitted.
3. Fingerprints Complete.
4. Laptop Received.
5. Start Date.
6. PIV Issued.

PIV issuance does not block the Start Date. Display it as a post-start compliance item when incomplete.

### 13.5 Personnel movement report

Provide a report with:

- Name.
- Current Call Order.
- Current LCAT.
- Future Call Order.
- Future LCAT.
- Effective Date.
- Notes.

Preserve completed movements for historical reporting.

---

## 14. Risk Requirements

Required fields:

- Call Order.
- Risk Description.
- Probability Level.
- Impact Level.
- Calculated Severity.
- Mitigation Description.
- Owner.
- Status.
- Identified Date.
- Closed Date, when applicable.

Allowed status values:

- Open.
- Monitoring.
- Mitigated.
- Closed.

Open risks appear first. Closed risks remain visible below active risks.

The probability/impact severity matrix must be configuration-driven. Do not hard-code a scoring matrix until the business owner approves it. Until then, build the configuration structure and clearly label any development seed values as provisional.

---

## 15. Issue Requirements

Required fields:

- Call Order.
- Issue Title.
- Description.
- Date Identified.
- Assigned To.
- Status.
- Updates Narrative.
- Closed Date, when applicable.

Allowed status values:

- Open.
- Closed.

Every issue update must have an author and timestamp. Open issues appear first. Closed issues remain visible below open issues.

---

## 16. Action Item Requirements

Required fields:

- Call Order.
- Owner Name.
- Description.
- Date Assigned.
- Status.
- Closed Date, when applicable.

Allowed status values:

- Open.
- In Progress.
- Blocked.
- Closed.

### Weekly display rule

- Show all non-closed action items.
- When an action item closes, show it in the first weekly report locked after closure.
- Do not show it in later current reports.
- Keep it searchable in action-item history and in the locked weekly report that contained it.

---

## 17. Weekly Status Brief

This is the most important Phase I capability.

### 17.1 Purpose

The Weekly Status Brief is both:

- The agenda for the Tuesday COR meeting; and
- The official weekly status record after Paul locks it.

### 17.2 Structure

Group the report by Call Order. For each Call Order, display:

1. Weekly Activity Details and Discussion Points.
2. Action Items.
3. Funding and Financial Summary.
4. Staffing Summary.
5. Risks Summary.
6. Issues Summary.
7. Invoice Status.

### 17.3 Weekly narrative

Weekly Activity Details is report-specific narrative maintained by Paul, Aidan, or Jessica.

Support:

- Plain-text or restrained rich-text entry.
- Author and last-updated timestamp.
- “Carry forward to next week” control.
- Optional carry-forward expiration date.

Do not delete narrative from prior locked reports. “Wiping” old narrative means it no longer appears in the new draft, not that it is deleted from history.

### 17.4 Automated composition

The draft weekly report must pull from current core records:

- Current PoP and 30-day warning.
- Funds Obligated.
- Funds Expended to Date.
- Funds Remaining.
- EAC and over/under warning.
- Current billet assignments, LCATs, and contract billing rates.
- Open billets and their sourcing/on-hold/onboarding state.
- All open risks and risks closed since the prior locked report.
- All open issues and issues closed since the prior locked report.
- All open action items and action items closed since the prior locked report.
- Most recent unpaid invoice or the invoice paid since the prior locked report.

### 17.5 Draft, preview, and lock states

Allowed report states:

- Draft.
- Ready for Review.
- Locked.
- Superseded.

Workflow:

```text
System creates or refreshes Draft
  → Paul/Aidan/Jessica update narrative and source records
  → Report passes validation
  → Paul previews COR view
  → Paul locks report
  → CORs can view report
  → Report is stored in archive
```

### 17.6 Validation before lock

Block locking when:

- A required narrative decision has not been resolved.
- A displayed record contains missing required fields.
- A financial calculation cannot be completed.
- A linked internal file does not exist.
- The reporting week duplicates an existing active locked version.

Warnings that do not block locking must be labeled separately.

### 17.7 Immutability and correction

A locked report is immutable.

If a correction is required:

1. Paul selects “Create Corrected Version.”
2. The system copies the locked snapshot into a new draft version.
3. Paul makes the correction.
4. Paul enters a correction reason.
5. Paul locks the corrected version.
6. The prior version remains available and is marked Superseded.

Never alter or delete the original locked version.

---

## 18. Report Archive

Allow users to search locked reports by:

- Week-ending date.
- Call Order.
- Report status.
- Version.

Display:

- Locked date and time.
- Locked by.
- Version number.
- Correction reason, when applicable.
- Superseded status, when applicable.

CORs may view locked and superseded reports but may not view drafts.

---

## 19. Authentication and Security

### 19.1 Approved-user flow

1. User enters a work email address.
2. System checks the approved-user list without revealing the result on screen.
3. If approved, send a unique, random, single-use magic link.
4. Store only a cryptographic hash of the token.
5. Make token lifetime configurable; use 15 minutes as the provisional development default.
6. Invalidate the token after successful use.
7. Establish a session with the approved role.
8. Log the authentication event.

### 19.2 User-facing response

Show the same message for approved and unapproved addresses:

> If this address is approved, a secure sign-in link will arrive shortly.

This prevents email-address enumeration.

### 19.3 Unapproved addresses

For Phase I:

- Do not send a marketing email automatically.
- Log the rejected attempt using privacy-minimizing data.
- Apply rate limiting and abuse protection.
- Do not reveal whether the address or domain is on the approved list.

Marketing outreach may be added later only through an approved, consent-aware workflow.

### 19.4 Required authentication logs

Log:

- Magic-link request.
- Approved or rejected result in restricted security logs.
- Link issued.
- Successful use.
- Reuse attempt.
- Expired-link attempt.
- Invalid-token attempt.
- SSO success or failure.
- Role assigned.
- Session start and termination.

Security logs must not be visible to COR users.

### 19.5 Security requirements

- Use secure, HTTP-only, same-site cookies.
- Require TLS in deployed environments.
- Protect state-changing requests from CSRF.
- Apply server-side input validation.
- Apply rate limiting to authentication and file operations.
- Scan uploaded files using available platform services.
- Enforce file-type and file-size restrictions through configuration.
- Do not expose secrets, tokens, internal paths, or stack traces to users.
- Never log plaintext authentication tokens.
- Apply least privilege to storage, database, and service accounts.

---

## 20. Auditability

For important create, update, status change, lock, correction, and access events, store:

- Actor.
- Timestamp in UTC.
- Action.
- Record type.
- Record identifier.
- Before value, when appropriate.
- After value, when appropriate.
- Source IP or security context when allowed.
- Reason, when required.

Provide human-readable timestamps in the user's timezone while preserving UTC in storage.

Do not allow ordinary users to edit or delete audit events.

---

## 21. Branding and UX

Use the name **TechSur Mission Control**. Do not use “Contract Transparency Portal.”

Align with TechSur's current website design language:

- Primary black: `#0A0A0A`.
- Accent gold: `#FBCA5C`.
- Bone background: `#FAFAF7`.
- Display typography: Montserrat.
- Body typography: Inter.
- Metadata typography: JetBrains Mono.

The experience should feel sleek, high-tech, disciplined, and trustworthy—not decorative or futuristic at the expense of usability.

UX rules:

- Optimize for quick scanning during a meeting.
- Use progressive disclosure and drill-downs.
- Show exceptions before normal conditions.
- Use plain language.
- Keep edit forms short and contextual.
- Prepopulate derived values.
- Do not ask users to enter calculated fields.
- Preserve the user's selected call order while navigating.
- Confirm destructive or irreversible actions.
- Use status text and icons in addition to color.
- Meet WCAG 2.1 AA and Section 508 expectations.
- Support desktop and tablet layouts; maintain basic mobile usability.

---

## 22. Maintainability and Architecture

Before coding:

1. Inspect the existing repository.
2. Identify the framework, database, authentication approach, storage approach, test framework, deployment configuration, and coding conventions.
3. Map existing components to this specification.
4. Identify components to retain, revise, migrate, or remove.
5. Present a concise implementation plan and schema proposal.

Do not replace the existing technology stack merely because another stack is preferred.

Architecture rules:

- Separate presentation, business rules, data access, and authentication concerns.
- Centralize financial formulas and warning thresholds.
- Make time thresholds, token lifetime, allowed statuses, and severity matrix configurable.
- Use database migrations for schema changes.
- Use transactions for multi-record operations.
- Make all important writes idempotent where practical.
- Use stable identifiers instead of names as foreign keys.
- Store timestamps consistently in UTC.
- Add database constraints for required relationships and valid date ranges.
- Keep sample or demo data separate from production data.
- Do not hard-code Paul, Aidan, Jessica, Joan, or Dean-Anne into application logic; seed them as configurable users and roles.

---

## 23. Implementation Sequence

Build complete vertical slices in this order:

### Slice 0 — Existing-system assessment

- Repository and architecture inventory.
- Gap analysis against this specification.
- Migration and rollback approach.
- Decision Log.

### Slice 1 — Access foundation

- Approved users.
- Staff SSO integration point.
- Customer magic-link authentication.
- Role-based authorization.
- Authentication and audit logging.

### Slice 2 — Contract foundation

- BPA.
- Call Orders.
- PoPs.
- CLINs.
- Awards and modifications.
- Files and external links.

### Slice 3 — Financials and invoices

- Funding transactions.
- Monthly actual and projected spend.
- Calculations and warnings.
- Financial chart.
- Invoice tracking and aging.

### Slice 4 — Staffing

- Billets.
- People and assignments.
- Onboarding.
- Government assets.
- Former staff.
- Personnel movements and report.

### Slice 5 — Program controls

- Deliverables.
- Action items.
- Risks.
- Issues and updates.

### Slice 6 — Weekly Status Brief

- Draft composition.
- Weekly narrative and carry-forward.
- Validation.
- COR preview.
- Locking and immutable snapshots.
- Corrected versions.
- Archive and search.

### Slice 7 — Hardening

- Accessibility.
- Security testing.
- Performance.
- Error handling.
- Backup and recovery validation.
- User-facing help.

Do not begin a later slice until the prior slice passes its acceptance tests unless the user explicitly authorizes parallel work.

---

## 24. Required Tests

At minimum, create automated tests for:

- Every role permission at the API and UI level.
- Approved and unapproved magic-link requests.
- Expired, reused, invalid, and successful magic-link attempts.
- Funds Remaining calculation.
- EAC calculation.
- Over/Under calculation and warning.
- PoP 30-day warning boundary.
- Invoice days 20, 21, 29, and 30.
- Paid invoice weekly retention.
- Action, risk, and issue closure retention.
- Multiple laptops assigned to one person.
- Assignment and LCAT movement history.
- Required onboarding milestones.
- PIV not blocking the Start Date.
- Weekly-report validation.
- Lock authorization.
- Locked-report immutability.
- Corrected-version and Superseded behavior.
- COR inability to access drafts or edit APIs.
- File and external-link access errors.
- Audit-event creation.

Do not consider a feature complete until its automated tests pass.

---

## 25. Acceptance Definition

A vertical slice is complete only when:

- The database migration is present and reversible.
- The API enforces validation and permissions.
- The UI supports the required user task.
- Loading, empty, error, and success states exist.
- Audit events are recorded where required.
- Automated tests pass.
- Accessibility checks pass for the affected screens.
- Sample data is clearly separated from production configuration.
- Documentation is updated.
- The requirement IDs implemented by the slice are listed in a traceability table.

---

## 26. Mandatory Decision Gate

Before writing production code, present these questions for business approval. Do not silently decide them:

1. Confirm that invoice aging begins on Invoice Date rather than submission, receipt, or due date.
2. Confirm that the 15-minute magic-link lifetime is acceptable.
3. Confirm the approved risk probability, impact, and severity matrix.
4. Confirm whether Aidan and Jessica may manage approved users or whether only Paul/system administration may do so.
5. Confirm that “Rate” shown to CORs is the contract billing rate.
6. Confirm the authoritative source for monthly actual spend and invoice payment status: manual entry, file import, or integration.
7. Confirm whether uploaded files are stored in the application, SharePoint, or both.
8. Confirm whether all CORs may view all call orders or whether access must be restricted by call order.
9. Confirm required retention periods for audit logs, authentication logs, personnel records, contract files, and weekly reports.
10. Confirm whether Paul alone can lock and correct weekly reports.

Continue with architecture assessment, UI wireframes, schema design, and noncontroversial scaffolding while these decisions are pending. Do not implement the affected production behavior until approved.

---

## 27. Prohibited LLM Behaviors

Do not:

- Invent requirements to make the interface look fuller.
- Add generic KPI cards without a user decision or task.
- Add AI features because the company is technology-forward.
- Recreate weekly-report data separately from core records.
- Implement Call Order PM submission in Phase I.
- Implement leave tracking in Phase I.
- Automatically market to rejected sign-in addresses.
- Allow locked reports to be modified in place.
- Rely on front-end role checks alone.
- Hard-code users, dates, thresholds, or environments.
- Hide errors or silently discard invalid records.
- Delete historical assignments, closed risks, closed issues, closed actions, paid invoices, modifications, PoPs, or superseded weekly reports.
- Introduce new frameworks, databases, or hosting services without approval.
- Refactor unrelated application areas.
- Claim completion without running tests and reporting results.

---

## 28. Required LLM Response Before Coding

Before changing code, respond with:

1. **Understanding:** A concise summary of the product and Phase I operating model.
2. **Existing-System Assessment:** Current architecture and relevant components.
3. **Gap Analysis:** What already exists, what conflicts, what is missing, and what must be migrated.
4. **Proposed Data Model:** Entities, relationships, history approach, and important constraints.
5. **UI Flow:** COR journey and TechSur administrator journey.
6. **Implementation Plan:** Vertical slices, migrations, testing, and rollback.
7. **Decision Log:** All unresolved matters, including the ten mandatory decisions above.
8. **Files Expected to Change:** Exact files or modules, when known.
9. **Risks:** Security, data migration, access, and schedule risks.

Wait for approval before implementing production-affecting changes.

---

## 29. Final Instruction

Build the smallest complete Phase I system that makes TechSur's Tuesday customer meeting accurate, transparent, fast to prepare, and easy to audit.

Favor clarity and maintainability over feature volume. Enter information once, derive all relevant views from it, preserve history, and never make the LLM responsible for an unapproved business decision.
