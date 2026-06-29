# Functional Design Document — TTB Label Verifier

**Version:** 1.0
**Date:** June 2026
**Status:** Draft

---

## 1. Purpose and Scope

The TTB Label Verifier is a prototype web application that assists TTB alcohol label reviewers in verifying that a submitted label image matches the corresponding COLA (Certificate of Label Approval) application on file.

The system automates the manual side-by-side comparison task by extracting fields from both documents and checking them programmatically, producing a structured pass/warn/fail compliance report for each label.

**In scope (v1):**
- Single label verification
- Batch (bulk) label verification
- Reviewer decision recording (Approve / Reject)
- Historical verification lookup

**Out of scope (v1):**
- Multi-user tenancy / access control
- Regulatory rule engine updates
- Integration with TTB's live COLA database

---

## 2. User Roles

| Role | Description |
|---|---|
| **Label Reviewer** | TTB staff member who uploads labels and reviews compliance results. All users share this role in v1. |

> In future versions a **Supervisor** role may be added to view team-level dashboards and override decisions.

---

## 3. Application Pages

### 3.1 Home Page

The entry point of the application. Displays three cards:

| Card | Description |
|---|---|
| **Single Upload** | Upload and verify one label at a time |
| **Bulk Upload** | Upload and verify a batch of labels together |
| **Recent Verifications** | Browse and revisit past verifications |

Clicking a card navigates to the corresponding page.

---

### 3.2 Single Upload Page

**Purpose:** Verify one COLA application against one label image.

**Layout:** Left panel (upload controls + history) | Resizable divider | Right panel (results)

**Left Panel:**
- Back button → returns to Home
- **Application PDF** drop zone — accepts one `.pdf` file
- **Label Image** drop zone — accepts one `.jpg`, `.jpeg`, or `.png` file
- **Verify Label** button — triggers verification
- Recent Verifications list — scrollable list of past verifications; clicking any row loads it in the right panel with a blue left-side indicator on the selected row

**Right Panel (Results):**
Displays after verification or when a history row is selected. Three columns:

| Column | Contents |
|---|---|
| Label Image | The uploaded label image (click to open full-screen lightbox) |
| Application ID | COLA ID chip + extracted application data table |
| Verification Results | Field-by-field results + overall status banner + Approve / Reject action bar |

**Workflow:**
1. Reviewer drops application PDF into the PDF drop zone
2. Reviewer drops label image into the image drop zone
3. Reviewer clicks **Verify Label**
4. Results appear in the right panel within seconds
5. Reviewer reviews field cards and clicks **Approve** or **Reject**
6. Decision is saved; the verification appears in the Recent Verifications list

---

### 3.3 Bulk Upload Page

**Purpose:** Verify a batch of labels in a single operation.

**Layout:** Left panel (upload + history) | Resizable divider | Right panel (drill-down results)

**Left Panel — Upload Phases:**

The left panel progresses through three phases:

**Phase 1 — Drop**
- Drop zone accepting any mix of PDF and image files
- **Match Files** button — triggers automatic pairing

**Phase 2 — Pairing Table**
- Shows each PDF matched to its label image
- Match column shows ✓ (matched) or ✗ (no match found) per pair
- Unmatched items are highlighted and will be skipped
- **Submit N verifications** button — starts processing

**Phase 3 — Processing**
- Live progress table; each row updates as its verification completes
- Status badges update in real time (⏳ → PASS / FAIL / WARN / MISMATCH)
- Clicking any completed row loads its full detail in the right panel
- **Export CSV** button available once all verifications complete
- **New Batch** button to start over

**Left Panel — Previous Verifications (shown in Phase 1 only):**
- Scrollable list of past verifications below the drop zone
- Shows Application ID, date/time, status badge, and delete button
- Clicking a row loads the full detail in the right panel

**Right Panel:**
- Empty state until a row is selected
- When a row is selected: same 3-column results view as Single Upload (image | app data | results + approve/reject)
- Selected row is highlighted with a blue left-side indicator

**File Pairing Logic:**
1. Extract the COLA ID from each PDF's embedded fields
2. Find a label image whose filename contains that COLA ID
3. If no match found, fall back to filename prefix matching
4. Any PDF or image that cannot be matched is shown as unmatched and excluded from submission

**Workflow:**
1. Reviewer drops all PDFs and label images together (mixed)
2. System parses PDFs and displays the pairing table
3. Reviewer reviews matches and clicks Submit
4. Results stream in live as each pair is processed
5. Reviewer clicks individual rows to review details and record decisions

---

### 3.4 Recent Verifications Page

**Purpose:** Browse, review, and re-decide on past verifications.

**Layout:** Left panel (verifications table) | Resizable divider | Right panel (detail)

**Left Panel:**
- Back button → returns to Home
- Table of all past verifications (most recent first), up to 50 entries
- Columns: Application ID | Brand Name | Date & Time | Result badge | Delete button
- Clicking a row highlights it (blue left-side indicator) and loads the full detail in the right panel

**Right Panel:**
- Same 3-column results view (image | app data | results + approve/reject)
- Reviewers can update or record a new decision on any past verification

---

## 4. Verification Results

### 4.1 Field-Level Results

Each verified field produces one of these statuses:

| Status | Meaning |
|---|---|
| **Pass** | Field matches within acceptable tolerance |
| **Warn** | Field is close but outside tolerance — manual review recommended |
| **Fail** | Field clearly does not match |

### 4.2 Overall Status

The overall status for a verification is derived from its field results:

| Overall Status | Condition |
|---|---|
| **Pass** | All fields pass |
| **Warn** | At least one field is warn, none fail |
| **Fail** | At least one field fails |
| **Mismatch** | Brand name similarity is very low — the label image may belong to a different product entirely |

A **Mismatch** banner is shown prominently at the top of the results column when this is detected, advising the reviewer to confirm the correct label was submitted before interpreting field results.

### 4.3 Fields Checked

| Field | Comparison Method |
|---|---|
| Brand Name | Semantic similarity (sentence-transformers) |
| Class / Type | Normalized string match |
| Alcohol Content | Numeric match within regulatory tolerance |
| Net Contents | Unit-normalized numeric match |
| Bottler / Producer | Semantic fuzzy match |
| Country of Origin | Keyword match |
| Government Warning | Exact text match after whitespace normalization |

---

## 5. Reviewer Decisions

After reviewing results, the reviewer selects one of:

| Decision | Meaning |
|---|---|
| **Approve** | Label complies; application may proceed |
| **Reject** | Label does not comply; applicant must resubmit |

The decision is recorded with the reviewer's email address and the timestamp.

A decision can be updated by revisiting the verification in the Recent Verifications page.

---

## 6. Data Retained

For each verification the system stores:

- COLA application ID and all extracted application fields
- Uploaded label image (stored on disk / Docker volume)
- Field-by-field comparison results and overall status
- Processing time
- Reviewer decision and timestamp (when recorded)

Data is retained indefinitely in v1. Deletion is available per-record from the verification lists.

---

## 7. Business Rules

- A label must have both a PDF and an image to be verified. Neither alone produces a result.
- Bulk pairing is automatic. If a PDF and image cannot be matched, the pair is skipped; the reviewer is notified.
- A mismatch alert does not block the reviewer — they may still approve or reject after acknowledging it.
- Alcohol content tolerance follows TTB regulations: ±0.3% for wine, ±0.15% for spirits.
- The government warning must match the legally required text exactly (after whitespace normalization). Any deviation is a fail.

---

## 8. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Single verification response time | < 10 seconds |
| Bulk streaming | First result visible within 10 seconds of submission |
| Concurrent users | Single reviewer (v1 prototype) |
| Data sensitivity | All label data is treated as internal; no raw field values are logged to console or error messages |
| Offline operation | AI models run locally; no external API calls at verification time |
