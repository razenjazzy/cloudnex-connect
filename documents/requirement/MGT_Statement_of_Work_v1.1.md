# Statement of Work: MGT Odoo ERP Implementation

Cloudnex Solutions | Statement of Work: MGT Odoo ERP Implementation

CLOUDNEX SOLUTIONS
Odoo Ready Partner | Bangkok, Thailand

STATEMENT OF WORK
Odoo ERP Implementation for MGT
Sales, Approval Workflow, Warehouse & Delivery, Production, Procurement and Dashboard Modernization

Prepared for: MGT
Prepared by: Cloudnex Solutions
Document status: Draft for Discussion, v1.1
Prepared on: 12 September 2026
Presented at client meeting: 28 September 2026

## Document Control

| Field | Detail |
|---|---|
| Client | MGT |
| Engagement | Odoo ERP Implementation: Sales, Approval Workflow, Warehouse & Delivery, Production (OEM & In-House), Procurement, Dashboards |
| Prepared by | Cloudnex Solutions (Odoo Ready Partner) |
| Version | 1.1 (Draft for Discussion) |
| Date prepared | 12 September 2026 |
| For discussion at | Client meeting, 28 September 2026 |
| Related documents | Cloudnex Commercial Proposal for MGT (pricing & commercial terms), issued separately. MGT As-Is/To-Be/Odoo Mapping Study (12 Sep 2026), internal reference for this revision. |

## Version History

| Version | Date | Author | Notes |
|---|---|---|---|
| 1.0 | 11 Sep 2026 | Cloudnex Solutions | Initial draft, based on MGT requirements document, for discussion on 28 Sep 2026 |
| 1.1 | 12 Sep 2026 | Cloudnex Solutions | Corrected the accounting hand-off, delivery tracking, and dashboard KPI costing against what the requirements document actually states; added Thai e-Tax Invoice to Out of Scope; added an Open Items section for the 28 Sep meeting |

## 1. Purpose of This Document

This Statement of Work (SOW) describes the scope, approach, phasing and responsibilities for the proposed Odoo ERP implementation for MGT. It is based on the requirements MGT shared with Cloudnex ahead of the 28 September 2026 meeting, covering sales ordering, approval workflow, accounting hand-off, warehouse and delivery, production (both OEM and in-house repackaging), procurement, and sales/executive dashboards.

This document is the scope reference. Pricing, licensing and payment terms are presented separately in the Cloudnex Commercial Proposal for MGT, so the two documents can be reviewed side by side without duplicating figures that may change independently of scope.

How to use this document: Sections 3 to 4 restate MGT's current process and pain points in Cloudnex's words, to confirm we understood the brief correctly. Sections 5 to 6 define what will be built and how it maps to Odoo. Sections 7 to 8 set out the phased plan and indicative timeline. Sections 9 to 12 cover responsibilities, assumptions, exclusions and sign-off criteria. Section 13 is new in this revision: it lists the items the requirements document leaves open, so they can be resolved at the 28 September meeting before scope and price are finalized.

## 2. Executive Summary

MGT's sales, approval, warehouse, production and purchasing activities currently run through separate manual steps, coordinated mainly over LINE chat. This makes approvals hard to trace, leaves order and delivery status unclear in real time, and forces staff to follow up repeatedly across departments to get a straight answer.

Cloudnex proposes an Odoo 19 implementation that puts sales, accounting, warehouse and delivery on one connected system, automates the sales rep to supervisor to manager approval chain, accepts customer orders directly from a LINE Official Account, and gives both the sales team and management real-time dashboards. On the production side, the system will calculate OEM packaging requirements and in-house repackaging material consumption automatically from a Bill of Materials (BOM), removing manual calculation and reducing stock errors.

The proposed engagement is structured in two phases: Phase 1 establishes the core ERP foundation (sales, inventory, purchasing, accounting, production/BOM), and Phase 2 layers in the automation that depends on it: LINE OA ordering, the multi-level approval workflow, OEM subcontracting calculations, and the real-time dashboards. This phasing lets MGT start operating on Odoo quickly while the more custom integration work is built and tested.

## 3. Current State (As-Is)

Based on MGT's requirements document, the current sales-to-delivery process runs as follows:

1. A sales rep receives the customer's order.
2. The sales rep prepares the order.
3. The order is sent to the Sales Supervisor for review.
4. The Supervisor forwards it to the Sales Manager for approval.
5. Once the Sales Manager approves the order, it is sent to Accounting to issue the Sales Order.
6. If stock is available, Accounting issues the Invoice.
7. The Delivery team ships the product, using either a company-owned vehicle or a hired (third-party) vehicle.

Coordination across these steps runs mainly through LINE chat rather than a shared system.

Pain points MGT identified:
- Approvals routed through LINE chat are difficult to track.
- No real-time visibility into order status.
- Information is scattered across multiple people rather than held centrally.
- Staff must ask around and follow up repeatedly to get a status update.

## 4. Proposed Future State (To-Be)

The target process MGT described, which this SOW is scoped to deliver:

1. Customers place orders directly through MGT's LINE Official Account.
2. Orders enter Odoo immediately, with no manual re-entry by a sales rep.
3. The system routes the order through an approval workflow: Sales rep (verification) then Supervisor then Sales Manager.
4. Once approved, the system automatically creates the Sales Order, and notifies Accounting, the Warehouse and the Delivery team.
5. Both the customer and the sales rep can track delivery status in real time, without chasing updates over chat.

## 5. Scope of Work

Scope is organized by functional area, in the order MGT presented its requirements. Each area notes the Odoo capability it will be built on and whether the work is standard configuration or custom development.

### 5.1 Sales Ordering & LINE Official Account Integration

Odoo Sales is the order backbone. Because Odoo has no native LINE connector, order intake from MGT's LINE Official Account is a custom integration: a webhook links the LINE Messaging API to Odoo so that an order placed on LINE is captured and created as a draft Sales Order automatically, with the customer identified against their Odoo contact record.

The same channel is used to push status updates back to the customer (order received, approved, shipped) so delivery and approval status are visible without a phone call.

How a LINE user is first linked to an existing MGT customer, and what happens for a first-time LINE customer with no matching contact yet, is not specified in the requirements document. See Section 13.

### 5.2 Multi-Level Approval Workflow

The Sales rep to Supervisor to Sales Manager approval chain is configured using Odoo's approval and automation tools, replacing the current LINE-based hand-offs with a workflow that is tracked, timestamped and visible to all three roles. Automatic notifications fire at each stage so an order is never waiting silently in someone's chat history.

The requirements document does not specify a per-stage SLA or timeout, what happens on rejection, or whether approvers act inside Odoo or need to approve from LINE directly. See Section 13; the answer materially affects whether this stays light customization or grows into a larger build.

### 5.3 Accounting Hand-off

Odoo Accounting is connected directly to Sales: once an order is approved, the Sales Order confirms automatically, and Accounting is notified so invoicing can proceed once stock is confirmed ready.

Note on this revision: v1.0 stated that invoicing itself becomes automatic at this point. The requirements document only commits to "notify Accounting" after approval; it does not state that invoice creation is automated. Whether Accounting keeps a manual trigger (for example, for credit terms or collections review) or invoicing should be fully automatic is an open item for the 28 September meeting (Section 13). Either behavior is standard Odoo configuration once confirmed.

### 5.4 Warehouse & Delivery Visibility

Odoo Inventory manages stock and delivery orders. The Sales team gains direct, real-time visibility (without asking Delivery separately) into: delivery status, planned and actual delivery date, the customer's expected receipt date, delivery method (company vehicle vs. hired carrier), tracking reference where one exists, and the staff member responsible for the delivery.

Note on this revision: delivery status, dates, method and responsible party are standard Odoo fields. The tracking reference is standard only as a manually entered free-text field. Live, auto-updating tracking status requires naming the specific hired carrier(s) MGT uses and confirming whether any expose an API or webhook Odoo can connect to; the requirements document itself flags the tracking number as something that does not always exist ("if any"). See Section 13.

### 5.5 Production: OEM Products (Subcontracting)

For OEM items produced at an external factory (MGT's example: Abamectin, one case = 1 litre x 12 bottles), a Bill of Materials defines the packaging components per finished case; in the example given: 12 plastic bottles, 12 caps, 12 labels, 1 cardboard case and 2 case stickers. Odoo's Manufacturing subcontracting workflow is configured so that confirming a production quantity (e.g. 100 cases) automatically calculates and stages the exact packaging components to send to the factory, and receives the finished goods back into stock on completion.

This scope assumes MGT supplies packaging materials to an external factory that fills and finishes the product (the direction implied by the requirements document's wording). This should be explicitly confirmed with MGT, since the reverse relationship (MGT filling or packing under contract for someone else's brand) would call for a different Odoo flow. See Section 13.

### 5.6 Production: In-House Repackaging (BOM)

For products MGT repackages in-house (example given: Nutripak 60K, 1 kg x 40 bags), a Bill of Materials captures the raw material formula; in the example, 0-0-60 fertilizer plus Nutripak bags and outer sacks. Entering a production quantity (e.g. 5 sacks) automatically calculates the exact raw materials required and deducts them from stock on confirmation, replacing manual calculation.

The example ratio given (8 raw fertilizer sacks producing 5 finished sacks) implies the raw and finished sack sizes differ. The actual kg weights of each are not stated and are needed to configure the BOM's unit-of-measure conversion correctly. See Section 13.

### 5.7 Procurement

Odoo Purchase manages MGT's multi-supplier raw material base (bottles, caps, labels, cases, stickers, pouches, sacks each typically sourced from a different supplier): suppliers are linked by material category, purchase prices are recorded per supplier, Purchase Orders are issued and receipts tracked against them, and minimum stock (reordering) rules trigger automatic alerts when a raw material is running low.

### 5.8 Dashboards & Reporting

Two real-time views are built on Odoo's native reporting and dashboard tools:

Sales dashboard: sales by rep, by customer and by product; outstanding balance; overdue customers; new customer count; per-customer purchase history; order status; delivery status.

Executive dashboard: total and monthly sales, sales by product/rep/customer, new vs. repeat customers, outstanding balance, overdue customers, order and delivery status, inventory value, and raw materials running low.

Note on this revision: "new customer count" appears on both dashboards and is not a native Odoo measure; it requires the same custom KPI logic either place. v1.0 priced this custom work in for the Executive dashboard only. It is corrected in Section 6 to apply to both. The requirements document also states "real-time" explicitly only for the Executive dashboard; the refresh expectation for the Sales dashboard should be confirmed. See Section 13.

## 6. Odoo Module Mapping

A summary view of how each requirement area maps to Odoo, and the nature of the work involved.

| Requirement Area | Primary Odoo App(s) | Nature of Work |
|---|---|---|
| Order intake via LINE Official Account | Sales, custom LINE Messaging API integration | Custom development |
| Multi-level approval workflow | Sales, Approvals / automation rules | Configuration + light customization (may extend if SLA/rejection/LINE-based approval is required, see Section 13) |
| Accounting hand-off | Accounting / Invoicing | Standard configuration (automatic vs. manual invoicing trigger to be confirmed, see Section 13) |
| Warehouse & delivery visibility | Inventory, Delivery | Standard configuration (tracking reference is free-text only unless a named carrier connector is confirmed, see Section 13) |
| OEM packaging auto-calculation | Manufacturing (Subcontracting), BOM | Standard configuration (assumes MGT supplies packaging to an external factory, to be confirmed, see Section 13) |
| In-house repackaging BOM | Manufacturing, Inventory | Standard configuration (raw/finished sack weights needed for BOM unit-of-measure setup, see Section 13) |
| Multi-supplier procurement & low-stock alerts | Purchase, Inventory (reordering rules) | Standard configuration |
| Sales dashboard | Odoo Reporting / Spreadsheet Dashboard | Standard configuration + custom KPIs (new customer count; corrected in this revision to match the Executive dashboard) |
| Executive dashboard | Odoo Reporting / Spreadsheet Dashboard | Standard configuration + custom KPIs |

## 7. Implementation Approach & Phasing

In line with how Cloudnex scopes Odoo engagements, the project is phased so MGT is live on the core system quickly, with automation and integration layered on once the foundation is proven in daily use.

Phase 1: Core ERP Foundation

Establishes the connected backbone across Sales, Inventory, Purchase, Accounting and Manufacturing/BOM.

1. Master data setup: products (incl. OEM and repackaged SKUs), BOMs, customers, suppliers, price lists.
2. Standard sales-to-delivery-to-invoice flow live in Odoo.
3. Production BOMs configured for both OEM packaging and in-house repackaging.
4. Procurement configured: supplier records by material category, PO flow, reordering rules.
5. Sales dashboard (v1) on standard Odoo reporting.
6. User Acceptance Testing (UAT) and go-live for core operations.

Phase 2: Automation & Integration

Builds the layer that depends on Phase 1 being stable and adopted.

1. LINE Official Account order intake integration.
2. Multi-level approval workflow automation (Sales rep to Supervisor to Manager).
3. OEM subcontracting packaging auto-calculation, end to end with the external factory hand-off.
4. Delivery tracking enhancements: tracking number, responsible party, customer-visible ETA.
5. Executive real-time dashboard and automated low-stock alerting.
6. UAT, user training and go-live for the automation layer.

## 8. Indicative Timeline

Timeline is expressed relative to project kickoff, since the exact start date depends on contract signature following the 28 September meeting. An illustrative calendar mapping is included for reference.

| Milestone | Relative Timing | Illustrative Date |
|---|---|---|
| Solution walkthrough & demo, proposal review | N/A | 28 Sep 2026 |
| Contract signature & kickoff | Week 0 | Mid-Oct 2026 |
| Phase 1 build & configuration | Weeks 1-6 | Mid-Oct - Late Nov 2026 |
| Phase 1 UAT & go-live | Week 7 | Early Dec 2026 |
| Phase 2 build & integration | Weeks 8-13 | Dec 2026 - Feb 2027 |
| Phase 2 UAT & go-live | Week 14 | Late Feb 2027 |
| Hypercare & transition to support | Weeks 15-16 | Early - Mid Mar 2027 |

Illustrative only, assuming kickoff shortly after the 28 September meeting; to be finalized once the contract is signed and MGT's master data is available.

## 9. Roles & Responsibilities

Cloudnex Solutions

| Role | Responsibility |
|---|---|
| Engagement / Project Manager | Overall delivery, schedule, phase sign-off, single point of contact for MGT |
| Solution Architect / Functional Consultant | Odoo configuration across Sales, Inventory, Purchase, Accounting, Manufacturing |
| Integration Developer | LINE Official Account integration, approval workflow automation, dashboard build |
| QA / Support Lead | Testing, UAT support, training delivery, handover to post-go-live support |

MGT

| Role | Responsibility |
|---|---|
| Executive Sponsor | Scope and budget decisions, escalation point |
| Sales Process Owner | Confirms sales, approval and LINE OA ordering requirements; leads UAT for Sales |
| Accounting Process Owner | Confirms invoicing and hand-off requirements; leads UAT for Accounting |
| Warehouse / Delivery Process Owner | Confirms delivery tracking requirements; leads UAT for Warehouse & Delivery |
| Purchasing Process Owner | Confirms supplier and procurement requirements; leads UAT for Purchasing |
| Project Coordinator | Day-to-day point of contact for Cloudnex; Thai-speaking, to bridge business and technical discussions |

## 10. Assumptions & Client Responsibilities

1. MGT provides master data (products including OEM and repackaging BOM components, customer list, supplier list, price lists) in the agreed template within an agreed window after kickoff.
2. MGT provides API/developer access to its LINE Official Account for the integration work in Phase 2.
3. MGT designates one project coordinator, ideally Thai-speaking, as the single point of contact for both business and technical clarifications.
4. MGT's department heads (Sales, Accounting, Warehouse, Purchasing) are available for process walkthroughs and UAT sign-off within each phase window.
5. Existing hardware (PCs, network, any label/receipt printers) is provided by MGT; additional hardware, if required, is quoted separately.
6. Historical transaction data migration beyond current master data and open balances is out of scope unless separately agreed.

## 11. Out of Scope

1. Fees charged directly by LINE for the Official Account (messaging costs, account billing); these remain MGT's account.
2. Hardware procurement (label printers, tablets, vehicle tracking devices).
3. Migration of historical transaction data beyond current open orders and balances.
4. Integrations with systems not named in this SOW (e.g. accounting software other than Odoo Accounting, external transport management systems).
5. Thai e-Tax Invoice / withholding tax compliance integration with the Revenue Department, unless confirmed as required and added via change request. (Added in v1.1; not mentioned in MGT's requirements document, but common enough for Thai companies that it should be explicitly ruled in or out rather than assumed.)
6. Live, API-based tracking integration with third-party hired carriers, unless a specific carrier is named and confirmed to have an available connector. Until then, the tracking reference is a manually entered free-text field only. (Added in v1.1.)
7. Customization requests raised after a phase's scope has been signed off; handled through a change request.

## 12. Acceptance Criteria

Each phase is considered complete, and eligible for sign-off, when:

1. The configured environment matches the scope documented for that phase in this SOW.
2. MGT's designated process owners have completed User Acceptance Testing without unresolved critical defects.
3. Agreed end-user training for that phase has been delivered.

## 13. Open Items for 28 September Discussion

New in this revision. These are points where MGT's requirements document does not give enough detail to finalize scope or price with confidence. Full rationale for each is in the MGT As-Is/To-Be/Odoo Mapping Study (12 Sep 2026); this section lists them for direct discussion at the meeting.

Sales ordering & LINE OA intake:
1. What channel does the customer use to order today, before LINE OA self-service exists?
2. How is a LINE user's identity first linked to an existing MGT customer record?
3. What happens when a LINE order arrives with no matching Odoo contact: auto-create, or hold for manual review?
4. Does the LINE OA need a product catalog/menu, or is ordering free-text/chat-based?

Multi-level approval workflow:
5. What is the SLA/timeout, if any, at each approval stage?
6. What happens on rejection at any stage, and who is told?
7. Do approvers act inside Odoo, or do they need to approve/reject from LINE directly?
8. Does every order require all three approval levels regardless of size?

Accounting hand-off:
9. Should invoice creation be fully automatic once stock/delivery is confirmed, or does Accounting keep a manual trigger?
10. What happens when stock is not available at the point of invoicing?
11. Does MGT need Thai e-Tax Invoice / withholding tax compliance handled through Odoo?

Warehouse & delivery:
12. Which hired carriers does MGT use, and do any offer an API or webhook for tracking status?
13. Does "person responsible for delivery" mean the driver, a delivery coordinator, or the sales rep?
14. Is there a formal warehouse process today beyond "if stock is ready" that should be documented?

OEM production:
15. Confirm the direction of the OEM relationship: does MGT supply packaging to an external factory, or the reverse?
16. Is a quality-control step needed before finished goods are received back into stock?
17. Are there OEM SKUs beyond Abamectin, and do they all follow the same linear per-case ratio?

In-house repackaging:
18. What is the actual kg weight of one raw 0-0-60 fertilizer sack, and of the finished Nutripak outer sack?
19. Are there other repackaged SKUs, and is a wastage/loss allowance needed in the BOM?

Procurement:
20. Should a low-stock alert generate a draft PO/RFQ automatically, or just notify a buyer?
21. Do purchase prices vary by order volume, or are they flat per supplier?

Dashboards:
22. Confirm real-time refresh expectations for the Sales dashboard specifically (the requirements document states "real-time" explicitly only for the Executive dashboard).
23. Confirm MGT's definition of "new customer" and "repeat customer."
24. Who should have access to each dashboard?

## 14. Commercial Terms & Post-Go-Live Support

Pricing, licensing and payment terms for this engagement are presented in the accompanying Cloudnex Commercial Proposal for MGT, issued alongside this SOW.

Following go-live, Cloudnex offers three After-Sales / AMC support tiers (Starter, Standard and Plus), differentiated by support channel, SLA response class, health-check frequency and development retainer hours, each carrying the same 99.5% system uptime baseline. The recommended tier and its pricing are covered in the Commercial Proposal.

## 15. Next Steps

1. Walk through this SOW and the live Odoo demo together at the 28 September 2026 meeting, using Section 13 as the discussion checklist for anything not yet confirmed.
2. Confirm any scope adjustments arising from that session, including answers to the Section 13 open items.
3. Cloudnex issues the finalized Commercial Proposal and SOW v2.0 reflecting the agreed answers.
4. Contract signature and kickoff scheduling.

Draft for Discussion, v1.1 | Page of
