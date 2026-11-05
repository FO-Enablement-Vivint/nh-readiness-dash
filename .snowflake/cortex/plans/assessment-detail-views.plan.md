# Plan: click-in views for the New Hire and FSM assessments

## Decisions (confirmed)
1. **Most recent round only.** No round picker and no round input on the endpoint.
2. **When FSM results become visible: TBD.** Build everything else first. The rule lives in one function, `fsmResultsVisible()`, so it can be settled later without touching the endpoint or UI. Until decided it defaults to "visible once the FSM assessment has a Submitted Date" so the view can be previewed. This default is a placeholder, not the final rule.
3. **Withheld, confirmed:** Confidence Gap, Eligibility Exception, Intervention Link, RM Audit and every Calibration field.
4. **Viewer** is the new hire; they see their own self-assessment and their own FSM's assessment. This widens README §9 for the FSM assessment, which is flagged for Austi's confirmation.

## What exists today
- Both assessments live in tables the app has never read: **NH Self-Assessment** (`tblKJhxmuPMdC5V0o`) and **FSM Final Assessment** (`tbl0GE6CmmfDOYPSy`). Neither is in `scripts/generate-airtable-schema.ts`.
- Each Readiness Event links to its assessments. The app already picks the pro's current event, so assessment ids come from the pro's own event and never from the browser.
- Answers are single-selects per item, grouped by category:
  - **Self-assessment** (confidence): Not Confident / Somewhat Confident / Confident / N/A. Categories SEC, LS, HVAC, CAM, NET, INV, HA, TS, IND, each with category notes, plus Readiness Statement and Readiness Concerns.
  - **FSM assessment** (demonstration): Did Not Meet Expectations / Minor Coaching Needed / Consistently Demonstrated. Categories SAF (four items marked Critical), SEC, LS, HVAC, CAM, NET, INV, HA, TS, IND, each with FSM notes, plus Unsafe Work Practices, Avoidable Home Damage, Coaching / Reassessment Plan, Training Plan, Reassessment Date.
  - **Results** are Airtable formulas the app reads and does not recompute: per-category scores, Overall Score, FSM Readiness Result, Safety-Critical Non-Starter, Categories Less than 85%, Remediation Reasons.
- Single page (`app/page.tsx`), RPC-style endpoint per file in `server/api`, typed client in `src/lib/api.ts`.

## Implementation steps

### 1. Schema
Add `NH Self-Assessment` and `FSM Final Assessment` to `TABLES` in `scripts/generate-airtable-schema.ts`, run `npm run schema:generate`, export the two clients from `server/airtable/index.ts`. Regeneration also picks up any other drift in the base, so the typecheck may flag unrelated references.

### 2. Endpoint `getMyAssessments`
- No input. Reads the current event's linked self-assessment and FSM assessment with an explicit field projection, the same pattern as `getMyReadiness`. Assessment ids come only from the pro's own event.
- Returns `{ self, fsm }`, each either null or `{ submittedDate, categories: [{ code, name, score, items: [{ label, answer, critical }], notes }], overallScore, ... }`. FSM also carries readiness result, safety flags, coaching and training plan. Self also carries readiness statement and concerns.
- Item labels come from Airtable field names with the category prefix stripped; answers from the single-select names, so the UI stays generic.
- `fsmResultsVisible()` gates the FSM half. When it is false, `fsm` is null and the row stays status-only.
- Reuses `requireNewHire`; previewed pros take the same path.

### 3. Access and docs
Update the README access table and the `getMyReadiness.ts` header comment so they describe the new behaviour: own self-assessment and own FSM assessment contents are visible, and the withheld list above stays hidden.

### 4. UI
- Make both Assessments rows tappable when data exists; a row with no data stays plain text.
- Tapping opens a full-screen sheet over the page (no routing change): back control, summary at top (overall score and readiness result), then one collapsible section per category with answers, score and notes.
- New `AssessmentDetail` component in `src/components`, using existing `Card` styles, mapping the single-select colours (red / yellow / green) to chips.
- FSM view adds the coaching and training plan at the bottom.

### 5. Verification
- Typecheck, then extend the smoke script to call the endpoint for Ben Barker (FSM submitted, 100 overall), Daniel Loan (self-assessment submitted, 88.9), a pro with only a self-assessment, and a pro with neither, which must return a clean empty state.
- Confirm no withheld field appears in any response, and that no input exists that could name another pro's record.
- Flip `fsmResultsVisible()` both ways to confirm the FSM half disappears cleanly.

## Critical files
- [scripts/generate-airtable-schema.ts](scripts/generate-airtable-schema.ts) - add the two tables
- [server/airtable/index.ts](server/airtable/index.ts) - export the new table clients
- [server/api/getMyReadiness.ts](server/api/getMyReadiness.ts) - pattern to follow for field projection and event selection; header comment to update
- [server/api/index.ts](server/api/index.ts) - register the new endpoint
- [src/MyReadiness.tsx](src/MyReadiness.tsx) - make the Assessments rows tappable

## Risks
- Item labels derive from Airtable field names, so renaming a field in the base changes the label.
- Ben Barker's EML record has no `FSM Assessment Sent Date`, so the detail view must key off the linked assessment record, not the sent date.
- `fsmResultsVisible()` defaults to on-submission until you decide; do not deploy before settling it.
