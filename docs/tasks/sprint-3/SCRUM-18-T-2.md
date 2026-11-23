---
id: SCRUM-18-T-2
story: SCRUM-18
sprint: 3
assignee: Lars Voigt-Bui
estimate_hours: 6
---

# Proximity Regex Detector and High-Risk Payment Detector

## Description

This task cover Scrum-18, which addresses flagging listers who demand cash-app money before a tour, and checks the payment methods the lister selected on the form. Out of scope: crypto, wire, and gift card text matching (SCRUM-18-T-1), the HTTP route, and the warning UI.

## Specs

- detectAdvanceFee(description) in server/services/paymentFlags.js returns [{ code: 'ADVANCE_FEE_DEPOSIT', severity: 'critical', title, explanation, evidence }] when a P2P app (Zelle, Venmo, CashApp, Chime) appears within 80 characters of a deposit term (deposit, holding fee, before tour, before viewing). Otherwise it returns [].

- The explanation says that legitimate landlords do not require non-refundable funds before a viewing.

- detectHighRiskSelections(paymentMethods) takes the "Payment Methods Requested" array from the form payload. It returns one { code: 'HIGH_RISK_PAYMENT_METHOD', severity: 'critical', ... } violation per high-risk value: crypto, wire_transfer, gift_card, zelle, venmo, cashapp.

- Safe values such as check, bank_transfer, and cash return []. An empty or missing array returns [].

- Matching is case-insensitive.

## Requirements

- Pure functions: no network and no database access.

- No new runtime dependencies. Tests use Vitest.

- The high-risk list and the 80-character window are constants at the top of the file, so the team can tune them.

- The violation object shape matches SCRUM-18-T-1 and SCRUM-19-T-2.

## Acceptance Criteria

- "Send the Zelle holding fee before tour" returns an ADVANCE_FEE_DEPOSIT violation.

- A P2P app and a deposit term more than 80 characters apart return [].

- "Rent can be paid by Zelle after the lease is signed" returns [].

- The explanation says legitimate landlords do not require non-refundable funds before viewing.

- A payment methods array containing crypto and gift_card returns two violations.

- ['check', 'bank_transfer'] and [] return [].

## Tests

- Criterion 1: SCRUM-18-T-2 returns an ADVANCE_FEE_DEPOSIT violation when given a listing description where a P2P app (Zelle, Venmo, CashApp, Cash App, or Chime) appears near a deposit term (deposit, holding fee, before tour, or before viewing), such as "Prior to touring the property, send the Zelle holding fee", asserts exactly one violation with fields: code "ADVANCE_FEE_DEPOSIT", severity "critical", and string title and explanation; asserts evidence is the matched span of text (e.g. "Zelle holding fee"); evaluates descriptions in either order ("DEPOSIT through Cash App") and in any letter case ("venmo the HOLDING FEE"), asserts one violation each.

- Criterion 2: SCRUM-18-T-2 returns [] when given a description where the P2P app and the deposit term are more than 80 characters apart, evaluates "Chime" and "deposit" separated by exactly 80 spaces, asserts one violation; evaluates the same terms separated by 81 spaces, asserts []; evaluates "Please pay by Zelle" followed by 81 spaces and "deposit", asserts [].

- Criterion 3: SCRUM-18-T-2 returns [] for clean descriptions that contain only one of the two terms — evaluates "Rent can be paid by Zelle after the lease is signed", a security deposit collected after the lease is signed by check, rent paid by Chime, Venmo, or Zelle after moving in, and a description of a tour with no payment required, asserts []; evaluates "", " ", 69, undefined, null, and {}, asserts [].

- Criterion 4: SCRUM-18-T-2 returns an explanation stating that legitimate landlords do not require non-refundable funds before a viewing when given "Please send deposit via Zelle prior to viewing the property.", asserts the explanation of the returned violation contains the explanation text.

- Criterion 5: SCRUM-18-T-2 returns one violation per high-risk payment method when given the payment methods array ["gift_card", "crypto"], asserts 2 violations, each with fields: code "HIGH_RISK_PAYMENT_METHOD", severity "critical", and string title and explanation, and evidence equal to the submitted values in order ("gift_card", "crypto"); evaluates each of cashapp, venmo, zelle, crypto, wire_transfer, and gift_card on its own, asserts 1 violation each; evaluates all 6 together, asserts 6 violations; evaluates ["Wire Transfer", "gift-card", "CRYPTO"], asserts 3 violations (case-insensitive, tolerates spaces and hyphens); evaluates ["Zelle"], asserts evidence preserves the original value "Zelle"; evaluates ["venmo", "Venmo"], asserts 1 violation (repeated values are reported once).

- Criterion 6: SCRUM-18-T-2 returns [] for safe and invalid payment method input — evaluates ["check", "bank_transfer"] and ["cash"], asserts []; evaluates [] , null, undefined, {}, the string "crypto", and an array of non-safe types [null, 88, "constructing"], asserts []; evaluates ["bank_transfer", "check", "venmo", "cash"], asserts 1 violation with evidence "venmo" (only the risky value is flagged).
