# Functional Design Document — TTB Label Verifier

**Version:** 1.0
**Date:** June 2026
**Status:** Draft

---

## 1. Purpose and Scope

The TTB Label Verifier is a prototype web application that assists TTB alcohol label reviewers in verifying that a submitted label image matches the corresponding COLA (Certificate of Label Approval) application on file.

The system automates the manual side-by-side comparison task by extracting fields from both documents and checking them programmatically, producing a structured pass/review/fail compliance report for each label.

**In scope (v1):**
- Single label verification
- Batch (bulk) label verification
- Reviewer decision recording (Approve / Reject)
- Historical verification lookup

**Out of scope (v1):**
- Multi-user tenancy / access control
- Integration with TTB's live COLA database

---

## 2. Design Principles

These principles reflect the requirements gathered from TTB stakeholders.

| Principle | Detail |
|---|---|
| **No internet required** | The application runs entirely on its own — no data is sent to external services. |
| **Results in seconds** | A single label is verified in under 10 seconds. For bulk submissions, results appear on screen as each label finishes — reviewers do not have to wait for the whole batch to complete. |
| **Simple, accessible interface** | The application has clearly labelled entry points and no complex menus. Any reviewer, regardless of technical background, can upload a label and read the results. |
| **Understands natural language variation** | The system recognises that the same name can appear differently on a label — for example "STONE'S THROW" on the bottle versus "Stone's Throw" in the application. These are treated as a match rather than a failure. |
| **Reads imperfect label photos** | Labels photographed in the field are often wrinkled, angled, or poorly lit. The system is built to handle these conditions and still extract the text accurately. |
| **Batch processing** | Reviewers can drop a large folder of PDFs and label images in one go. |
| **Standalone and self-contained** | The application has no dependency on existing TTB systems. |

---

## 3. User Roles

| Role | Description |
|---|---|
| **Label Reviewer** | TTB staff member who uploads labels and reviews compliance results. All users share this role in v1. |

> In future versions a **Supervisor** role may be added to view team-level dashboards and override decisions.

---

## 4. Application Pages

### 4.1 Home Page

The entry point of the application. Displays three cards:

| Card | Description |
|---|---|
| **Single Upload** | Upload and verify one label at a time |
| **Bulk Upload** | Upload and verify a batch of labels together |
| **Recent Verifications** | Browse and revisit past verifications |

Clicking a card navigates to the corresponding page.

---

### 4.2 Single Upload Page

**Purpose:** Verify one Label application against one label image.

**Workflow:**
1. Reviewer drops application PDF into the PDF drop zone
2. Reviewer drops label image into the image drop zone
3. Reviewer clicks **Verify Label**
4. Results appear in the right panel within seconds
5. Reviewer reviews field cards and clicks **Approve** or **Reject**
6. Decision is saved; the verification appears in the Recent Verifications list

---

### 4.3 Bulk Upload Page

**Purpose:** Verify a batch of labels in a single operation.

**File Pairing Logic:**
1. Extract the Application ID from each PDF's embedded fields
2. Find a label image whose filename contains that Application ID
3. If no match found, fall back to filename prefix matching
4. Any PDF or image that cannot be matched is shown as unmatched and excluded from submission

**Workflow:**
1. Reviewer drops all PDFs and label images together (mixed)
2. System parses PDFs and displays the pairing table
3. Reviewer reviews matches and clicks Submit
4. Results stream in live as each pair is processed
5. Reviewer clicks individual rows to review details and record decisions

---

### 4.4 Recent Verifications Page

**Purpose:** Browse, review, and re-decide on past verifications.

**Layout:** Left panel (verifications table) | Resizable divider | Right panel (detail)

## 5. Verification Results

### 5.1 Field-Level Results

Each verified field produces one of these statuses:

| Status | Meaning |
|---|---|
| **Pass** | Field matches within acceptable tolerance |
| **Review** | Field is close but outside tolerance — manual review recommended |
| **Fail** | Field clearly does not match |

### 5.2 Overall Status

The overall status for a verification is derived from its field results:

| Overall Status | Condition |
|---|---|
| **Pass** | All fields pass |
| **Review** | At least one field is review, none fail |
| **Fail** | At least one field fails |
| **Mismatch** | Brand name similarity is very low — the label image may belong to a different product entirely |

A **Mismatch** banner is shown prominently at the top of the results column when this is detected, advising the reviewer to confirm the correct label was submitted before interpreting field results.

### 5.3 Fields Checked

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

## 6. Reviewer Decisions

After reviewing results, the reviewer selects one of:

| Decision | Meaning |
|---|---|
| **Approve** | Label complies; application may proceed |
| **Reject** | Label does not comply; applicant must resubmit |

The decision is recorded with the reviewer's email address and the timestamp.

A decision can be updated by revisiting the verification in the Recent Verifications page.

---

## 7. Data Retained

For each verification the system stores:

- Application ID and all extracted application fields
- Uploaded label image (stored on disk / Docker volume)
- Field-by-field comparison results and overall status
- Processing time
- Reviewer decision and timestamp (when recorded)

Data is retained indefinitely in v1. Deletion is available per-record from the verification lists.

---

## 8. Business Rules

- A label must have both a PDF and an image to be verified. Neither alone produces a result.
- Bulk pairing is automatic. If a PDF and image cannot be matched, the pair is skipped; the reviewer is notified.
- A mismatch alert does not block the reviewer — they may still approve or reject after acknowledging it.
- Alcohol content tolerance follows TTB regulations: ±0.3% for wine, ±0.15% for spirits.
- The government warning must match the legally required text exactly (after whitespace normalization). Any deviation is a fail.

