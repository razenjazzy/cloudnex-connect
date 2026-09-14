# Business Requirements Document: MGT Odoo ERP Implementation

Internal Cloudnex working document. Prepared ahead of the 28 September 2026 MGT client meeting.

## Document Control

| Field | Detail |
|---|---|
| Client | MGT |
| Document type | Business Requirements Document (BRD), internal Cloudnex working document |
| Version | 1.0 |
| Date prepared | 12 September 2026 |
| Prepared by | Cloudnex Solutions |
| Source documents | Requirements of MGT.docx (Thai, submitted by MGT, 10 Sep 2026); MGT_AsIs_ToBe_Odoo_Study.md (12 Sep 2026); MGT_Statement_of_Work_v1.1.md (12 Sep 2026); First meeting with MGT Plantgrowth notes, 4 Sep 2026 |
| Related documents | Cloudnex Commercial Proposal for MGT (pricing, issued separately) |

## 1. Purpose and Background

This BRD converts MGT's raw requirements document into a numbered, testable list of business requirements, organized by functional area, with each requirement's confirmation status tracked explicitly. It sits between two other project documents and serves a different purpose than either:

- The As-Is/To-Be/Odoo Mapping Study (12 Sep 2026) is the narrative analysis: current process, target process, Odoo mapping reasoning, and gaps.
- The Statement of Work v1.1 is Cloudnex's proposed solution and phased delivery plan built on top of that analysis.
- This BRD is the atomic requirement catalog underneath both: it is what the Odoo demo should be built against, what the SOW's scope should trace back to, and what should get checked off (or revised) once MGT answers the open items at the 28 September meeting.

As an internal working document, this BRD keeps the same caveats as the study it is built from: where MGT's source document does not specify something, that is stated as "Pending Confirmation" rather than filled in with an assumption, and low-confidence signals from the first-meeting notes are flagged as such rather than treated as requirements.

## 2. Business Objectives

MGT's underlying goals, as stated or clearly implied in the requirements document:

1. Replace LINE-chat-based coordination between Sales, Supervisor, Manager, Accounting, Warehouse and Delivery with a single connected system.
2. Give Sales and the customer real-time, self-service visibility into order and delivery status, removing the need to ask around repeatedly.
3. Let customers order directly, without a sales rep re-entering the order.
4. Remove manual calculation in production: packaging components for OEM goods, raw materials for in-house repackaging.
5. Control procurement across multiple suppliers per raw material category, with proactive low-stock alerts.
6. Give Sales and Executives dashboard-level visibility into sales, receivables, customers, orders, deliveries, inventory and raw materials, without manual compilation.

## 3. Stakeholders

| Role | Side | Involvement |
|---|---|---|
| Sales rep | MGT | Verifies LINE-originated orders; first approval stage |
| Sales Supervisor | MGT | Second approval stage |
| Sales Manager | MGT | Final approval stage |
| Accounting | MGT | Issues Sales Order and Invoice on approval |
| Warehouse | MGT | Stock availability check (current process undocumented, see Section 6.4) |
| Delivery | MGT | Ships goods via company or hired vehicle |
| Purchasing | MGT | Manages suppliers, POs, stock replenishment |
| Executives | MGT | Consume the Executive dashboard; scope/budget decisions |
| Customers | MGT's customers | Place orders via LINE OA; track order/delivery status |
| Engagement/Project Manager, Solution Architect, Integration Developer, QA/Support Lead | Cloudnex | Delivery team, per SOW Section 9 |

## 4. Scope

### 4.1 In scope (functional areas)

1. Sales ordering and LINE Official Account intake
2. Multi-level sales approval workflow
3. Accounting hand-off
4. Warehouse and delivery visibility
5. OEM production (subcontracting)
6. In-house repackaging production (BOM)
7. Procurement
8. Sales and executive dashboards

### 4.2 Out of scope

Carried from SOW v1.1 Section 11:

1. Fees LINE charges directly for the Official Account.
2. Hardware procurement (label printers, tablets, vehicle tracking devices).
3. Historical transaction data migration beyond current open orders and balances.
4. Integrations with systems not named in this BRD or the SOW.
5. Thai e-Tax Invoice / withholding tax compliance, unless confirmed as required (see OI-11).
6. Live, API-based carrier tracking, unless a specific carrier is named and confirmed to have a connector (see OI-12).
7. Customization requests raised after a phase's scope is signed off; handled as a change request.

## 5. Business Requirements

Status legend: Confirmed (stated directly in MGT's requirements document), Pending Confirmation (implied but not fully specified; tied to an open item, "OI-#", from SOW v1.1 Section 13), Low Confidence (sourced only from the garbled first-meeting transcript, not the requirements document).

### 5.1 Sales Ordering & LINE OA Intake

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-1.1 | The system shall allow customers to place orders directly through MGT's LINE Official Account, without a sales rep re-entering the order. | Must | Confirmed | |
| BR-1.2 | The system shall create the order in Odoo immediately on receipt from LINE. | Must | Confirmed | Requirements document does not state whether this lands as a draft/pending order or another state; assumed to be a pre-approval draft given BR-2.1 exists |
| BR-1.3 | The system shall match each inbound LINE order to an existing Odoo customer contact using the customer's LINE User ID. | Must | Pending Confirmation | OI-2, OI-3: matching method and new-contact handling not specified |
| BR-1.4 | The system shall push order and delivery status updates back to the customer via the LINE Official Account (received, approved, shipped). | Must | Confirmed | Implied by the To-Be narrative's "customer can track status"; mechanism detailed in the As-Is/To-Be study |
| BR-1.5 | The LINE ordering interface shall present a product catalog or menu for the customer to order from. | TBC | Pending Confirmation | OI-4: not stated whether ordering is catalog-based or free-text/chat |

### 5.2 Multi-Level Approval Workflow

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-2.1 | The system shall route every order through a three-stage approval sequence: Sales rep (verification), then Supervisor, then Sales Manager. | Must | Confirmed | |
| BR-2.2 | The system shall timestamp and retain a visible audit trail of each approval action. | Must | Confirmed | Directly addresses MGT's stated pain point that LINE-based approval is hard to track |
| BR-2.3 | The system shall notify the relevant approver automatically when an order reaches their stage. | Must | Confirmed | |
| BR-2.4 | On final (Sales Manager) approval, the system shall automatically create the Sales Order and notify Accounting, Warehouse and Delivery. | Must | Confirmed | |
| BR-2.5 | The system shall enforce an SLA or timeout at each approval stage. | TBC | Pending Confirmation | OI-5: no SLA stated |
| BR-2.6 | The system shall define and execute a rejection path (return to sales rep, cancel, notify customer, etc.) at any approval stage. | TBC | Pending Confirmation | OI-6: rejection handling not specified |
| BR-2.7 | Approvers shall be able to act on an order from [Odoo backend/portal / LINE], per MGT's confirmed preference. | TBC | Pending Confirmation | OI-7: channel not specified; materially changes scope if LINE-based approval is required |
| BR-2.8 | All orders shall pass through all three approval levels regardless of value or quantity. | Should | Pending Confirmation | OI-8: current wording implies this but is not confirmed as deliberate policy |

### 5.3 Accounting Hand-off

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-3.1 | The system shall notify Accounting automatically once an order receives final approval. | Must | Confirmed | |
| BR-3.2 | The system shall support issuing a customer invoice once stock is confirmed ready. | Must | Confirmed | |
| BR-3.3 | Invoice creation shall be [fully automatic on stock/delivery confirmation / gated on a manual Accounting action]. | TBC | Pending Confirmation | OI-9: requirements document commits only to "notify Accounting," not automatic invoicing; SOW v1.0 had overstated this |
| BR-3.4 | The system shall define behavior when stock is not available at the point of invoicing (hold, backorder, partial invoice). | TBC | Pending Confirmation | OI-10: neither As-Is nor To-Be addresses this |
| BR-3.5 | The system shall support Thai e-Tax Invoice / withholding tax compliance. | TBC | Pending Confirmation | OI-11: not mentioned in MGT's requirements document at all; flagged as a likely gap |

### 5.4 Warehouse & Delivery Visibility

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-4.1 | Sales shall be able to view delivery status directly, without contacting Delivery separately. | Must | Confirmed | |
| BR-4.2 | The system shall record and display: delivery status, delivery date, customer's expected receipt date, delivery method (company vehicle or hired vehicle), tracking reference where one exists, and the person responsible for delivery. | Must | Confirmed | MGT's own wording flags the tracking reference as not always existing ("if any") |
| BR-4.3 | Both the customer and the sales rep shall be able to track delivery status. | Must | Confirmed | Likely surfaces via the same LINE OA channel as BR-1.4; not stated explicitly |
| BR-4.4 | The system shall integrate with named hired-carrier tracking systems for live status updates, where such an API exists. | TBC | Pending Confirmation | OI-12: no carrier named; until confirmed, tracking reference is free text only |
| BR-4.5 | "Person responsible for delivery" shall be defined as [driver / delivery coordinator / sales rep]. | TBC | Pending Confirmation | OI-13 |
| BR-4.6 | The current warehouse process (picking, packing, stock check) shall be documented as part of this requirement. | Should | Pending Confirmation | OI-14: requirements document never describes a warehouse-side process, only Sales' visibility need |

### 5.5 OEM Production (Subcontracting)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-5.1 | The system shall calculate, from a Bill of Materials, the packaging components required per unit of OEM production for goods sent to an external factory. | Must | Confirmed | Example: 1 case of Abamectin (1L x 12 bottles) = 12 bottles, 12 caps, 12 labels, 1 case, 2 stickers |
| BR-5.2 | The system shall scale packaging component quantities linearly and automatically as the production quantity changes. | Must | Confirmed | Example: 100 cases = 1,200 bottles, 1,200 caps, 1,200 labels, 100 cases, 200 stickers |
| BR-5.3 | The OEM relationship direction shall be confirmed as [MGT supplies packaging to an external factory / MGT fills a partner's product under contract]. | Must | Pending Confirmation | OI-15: this BRD assumes the former, matching the source document's wording; the correct Odoo flow depends on the answer |
| BR-5.4 | A quality-control step shall be defined for finished OEM goods before they are received into sellable stock. | TBC | Low Confidence | OI-16: only source is the garbled first-meeting transcript ("priority alerts QC"); not in the requirements document |
| BR-5.5 | Other OEM SKUs beyond Abamectin, and their BOM ratios, shall be documented. | Should | Pending Confirmation | OI-17 |

### 5.6 In-House Repackaging Production (BOM)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-6.1 | The system shall calculate raw material requirements automatically from a Bill of Materials when a production quantity is entered. | Must | Confirmed | Example: Nutripak 60K, 5 output sacks require 8 sacks of 0-0-60 fertilizer, 200 pouches, 5 outer sacks |
| BR-6.2 | The system shall deduct raw material stock based on the actual quantity produced. | Must | Confirmed | |
| BR-6.3 | The BOM's unit-of-measure conversion shall be configured using the actual kg weight of the raw fertilizer sack and the finished outer sack. | Must | Pending Confirmation | OI-18: the 8:5 ratio in MGT's example implies different sack sizes; exact weights not given |
| BR-6.4 | Other in-house repackaged SKUs, and any wastage/loss allowance, shall be documented. | Should | Pending Confirmation | OI-19 |

### 5.7 Procurement

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-7.1 | The system shall allow each raw material type (bottles, caps, labels, cases, stickers, pouches, sacks) to be assigned its own supplier(s). | Must | Confirmed | |
| BR-7.2 | The system shall record purchase prices per supplier. | Must | Confirmed | |
| BR-7.3 | The system shall support issuing Purchase Orders and tracking goods receipt against them. | Must | Confirmed | |
| BR-7.4 | The system shall define minimum stock levels per raw material and alert when a material is running low. | Must | Confirmed | |
| BR-7.5 | Low-stock alerts shall [generate a draft PO/RFQ automatically / notify a buyer only]. | TBC | Pending Confirmation | OI-20: requirements wording reads as notification-only |
| BR-7.6 | Purchase prices shall support volume-based tiers per supplier, if required. | TBC | Pending Confirmation | OI-21 |

### 5.8 Sales & Executive Dashboards

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| BR-8.1 | The system shall provide a Sales dashboard showing: sales by rep, by customer, by product; outstanding balance; overdue customers; new customer count; per-customer purchase history; order status; delivery status. | Must | Confirmed | |
| BR-8.2 | The system shall provide a real-time Executive dashboard showing: total and monthly sales; sales by product/rep/customer; new and repeat customers; outstanding balance; overdue customers; order and delivery status; inventory value; raw materials running low. | Must | Confirmed | "Real-time" is stated explicitly for this dashboard in the source document |
| BR-8.3 | The Sales dashboard shall refresh at [the same real-time cadence as the Executive dashboard / a different, confirmed cadence]. | TBC | Pending Confirmation | OI-22: source document does not state "real-time" for the Sales dashboard specifically |
| BR-8.4 | "New customer" and "repeat customer" shall be defined with a specific time window and rule. | Must | Pending Confirmation | OI-23: needed to build the underlying custom KPI logic (see BRD Section 6, NFR-4) |
| BR-8.5 | Dashboard access shall be restricted by role, per a confirmed access matrix. | Should | Pending Confirmation | OI-24 |

## 6. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-1 | Approval actions must be auditable (who acted, when, on what order), replacing the untraceable LINE-based approval today. | Confirmed, derives from MGT's stated pain point |
| NFR-2 | Order and delivery status must be visible without a phone call or chat message to another department. | Confirmed, derives from MGT's stated pain point |
| NFR-3 | The Executive dashboard must reflect data in real time. | Confirmed |
| NFR-4 | "New customer" and "repeat customer" measures require custom computed logic; not a native Odoo report. | Confirmed technical constraint (see As-Is/To-Be study, Section 8) |
| NFR-5 | Post-go-live system uptime target: 99.5%, per Cloudnex's standard AMC support tiers. | Carried from SOW v1.1 Section 14; not an MGT-stated requirement |
| NFR-6 | User interface language (Thai, English, or both) for Odoo end users. | Pending Confirmation, not addressed in any source document |

## 7. Assumptions

Carried from SOW v1.1 Section 10, restated as BRD assumptions pending MGT confirmation:

1. MGT will provide master data (products including OEM and repackaging BOM components, customer list, supplier list, price lists) in an agreed template and timeframe.
2. MGT will provide API/developer access to its LINE Official Account.
3. MGT will designate a Thai-speaking project coordinator as single point of contact.
4. MGT's department heads (Sales, Accounting, Warehouse, Purchasing) will be available for process walkthroughs and UAT.
5. No current-state process exists in writing for OEM production, in-house repackaging, or procurement; these will need to be documented directly with MGT's process owners (see As-Is/To-Be study, Areas 5-7).

## 8. Glossary

| Term (Thai / shorthand) | Meaning |
|---|---|
| LINE OA | LINE Official Account, MGT's customer-facing messaging channel |
| OEM | Here, packaging materials MGT supplies to an external factory for filling/finishing (direction to be confirmed, see BR-5.3) |
| BOM | Bill of Materials, the formula defining components/raw materials per unit produced |
| ลัง (case) | Cardboard case; outer packaging unit for OEM goods |
| กระสอบ (sack) | Sack; both a raw material unit (fertilizer) and a finished-goods outer packaging unit, with different sizes (see BR-6.3) |
| ซอง (pouch) | Pouch/sachet; inner packaging for repackaged goods (e.g., Nutripak) |
| ฉลาก (label) | Label affixed to a bottle or container |
| รถบริษัท / รถรับจ้าง | Company-owned vehicle / hired (third-party) vehicle, the two delivery methods MGT uses today |

## 9. Open Items Register

Full detail for each item is in SOW v1.1 Section 13 and the As-Is/To-Be/Odoo Mapping Study. Cross-referenced here by the requirement(s) each affects.

| OI # | Open Item | Affects |
|---|---|---|
| OI-1 | Customer's ordering channel today, before LINE OA exists | BR-1.1 |
| OI-2 | How a LINE user is first linked to an Odoo contact | BR-1.3 |
| OI-3 | Handling of a LINE order with no matching contact | BR-1.3 |
| OI-4 | Whether LINE ordering needs a catalog/menu | BR-1.5 |
| OI-5 | Approval SLA/timeout per stage | BR-2.5 |
| OI-6 | Rejection handling and notification | BR-2.6 |
| OI-7 | Approval channel: Odoo vs. LINE | BR-2.7 |
| OI-8 | Whether all orders need all 3 approval levels | BR-2.8 |
| OI-9 | Automatic vs. manual invoicing trigger | BR-3.3 |
| OI-10 | Behavior when stock is unavailable at invoicing | BR-3.4 |
| OI-11 | Thai e-Tax Invoice requirement | BR-3.5 |
| OI-12 | Named hired carriers and their tracking APIs | BR-4.4 |
| OI-13 | Definition of "delivery responsible person" | BR-4.5 |
| OI-14 | Current warehouse process documentation | BR-4.6 |
| OI-15 | Direction of the OEM relationship | BR-5.3 |
| OI-16 | QC step before OEM goods received into stock | BR-5.4 |
| OI-17 | Other OEM SKUs and ratios | BR-5.5 |
| OI-18 | Raw/finished sack kg weights for BOM UoM | BR-6.3 |
| OI-19 | Other repackaged SKUs, wastage allowance | BR-6.4 |
| OI-20 | Auto-PO generation vs. alert-only | BR-7.5 |
| OI-21 | Volume-based purchase pricing | BR-7.6 |
| OI-22 | Sales dashboard real-time expectation | BR-8.3 |
| OI-23 | Definitions of "new" and "repeat" customer | BR-8.4, NFR-4 |
| OI-24 | Dashboard access levels per role | BR-8.5 |

## 10. Traceability Note

This BRD's requirement IDs (BR-x.x) should be referenced when:
- Reviewing whether the SOW's scope and pricing cover every stated MGT requirement.
- Building or validating the Odoo demo ahead of 28 September, so each demoed capability can be checked against a specific BR.
- Updating the SOW to v2.0 after the meeting: each OI resolved should update the corresponding BR's status from Pending Confirmation to Confirmed, and any resulting scope change should be reflected in both documents.
