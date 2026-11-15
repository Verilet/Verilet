---
id: SCRUM-18-T-1
story: SCRUM-18
sprint: 3
assignee: Lars Voigt-Bui
estimate_hours: 6
---

# Implement Regex Payment Worker Scanner

## Description

This serves SCRUM-18 which covers a student wanting to be alerted if the lister for a property requests payment through high-risk payment methods, so they avoid sending money through unsafe methods. This task only focuses on implementing a Regex Payment Worker Scanner, scanning a listing description for irreversible payment channels, and returning an array of violations: SCRUM-18-T-1: Flag untraceable payment terms (crypto, wire transfers, gift cards) in listing text. Out of scope: cash-app advance-fee detection and payment checkbox checks (SCRUM-18-T-2), the HTTP route, and the warning UI.

## Specs

- detectUntraceablePayment(description) in server/services/paymentFlags.service.js returns an array of violations.

- Each violation is { code: 'UNTRACEABLE_PAYMENT', severity: 'critical', title, explanation, evidence }, where evidence is the exact matched text.

- Matching is case-insensitive and uses word boundaries. Three categories: Cryptocurrency: Bitcoin, BTC, Ethereum, USDT. Wire transfers: Western Union, MoneyGram, "wire transfer". Gift cards: Apple, Steam, or Vanilla Visa gift cards.

- A description that matches several categories returns one violation per category.

- An empty, null, or undefined description returns [].

- Normal post-lease payment wording, such as "rent is paid by check after the lease is signed", returns [].

## Requirements

- Pure function: no network and no database access.

- No new runtime dependencies. Tests use Vitest.

- The violation object shape matches the one used by the price check in SCRUM-19-T-2 (code, severity, title, explanation, evidence).

- Keep the term lists in one constant at the top of the file so the team can tune them.

## Acceptance Criteria

1. A description mentioning Bitcoin, BTC, Ethereum, or USDT returns an UNTRACEABLE_PAYMENT violation with severity critical.

2. A description mentioning Western Union, MoneyGram, or a wire transfer returns a violation.

3. A description mentioning Apple, Steam, or Vanilla Visa gift cards returns a violation.

4. The violation's evidence contains the matched text, and matching works in any letter case.

5. A description matching two categories returns two violations.

6. Empty or null input returns [], and a clean post-lease payment description returns [].

## Tests

File: `server/tests/SCRUM-18-T-1_paymentFlags.test.ts`

Setup for all: Offline unit tests via Vitest, directly calling the exported `detectUntraceablePayment` function with listing description strings. No other dependencies needed.

- Criterion 1: SCRUM-18-T-1 returns a critical UNTRACEABLE_PAYMENT violation for cryptocurrency terms when given a listing description mentioning one of the terms being BTC, USDT, Bitcoin, and Ethereum, asserts exactly one violation with fields: code "UNTRACEABLE_PAYMENT", severity "critical", string title and explanation, and evidence that is equal to the matched term.

- Criterion 2: SCRUM-18-T-1 returns a violation for wire transfer terms when given a listing description each mentioning one of terms being MoneyGram, wire transfer, and Western Union, asserts exactly one violation with fields: code "UNTRACEABLE_PAYMENT", severity "critical", string title and explanation, and evidence that is equal to the matched term.

- Criterion 3: SCRUM-18-T-1 returns a violation for gift card terms when given a listing description each mentioning one of the terms Vanilla Visa gift card, Apple gift-cards, and Steam gift cards, asserts exactly one violation with fields: code "UNTRACEABLE_PAYMENT", severity "critical", string title and explanation, and evidence that is equal to the full matched phrase.

- Criterion 4: SCRUM-18-T-1 returns the matched text as evidence in any letter case when given mixed-case ("wIrE tRAnSFer"), upper-case ("PAY WITH WESTERN UNION"), and lower-case ("bitcoin only") descriptions in listings, asserts evidence preserves the original casing from the description.

- Criterion 5: SCRUM-18-T-1 returns one violation per matched category when given a description matching two categories (USDT and wire transfer), asserts 2 violations with evidence "USDT" and "wire transfer"; evaluates a description matching all three categories, asserts 3 violations; evaluates a description with several terms from one category (Bitcoin, Ethereum, BTC), asserts 1 violation with evidence "Bitcoin".

- Criterion 6: SCRUM-18-T-1 returns [] for clean, empty, and non-string input — evaluates clean post-lease payment descriptions (check, ACH, online portal), a description with "steam shower", and a description with "Bitcoiner Avenue" and "BTCXABC" (terms inside longer words), asserts []; evaluates "" and " ", asserts []; evaluates 67, undefined, null, and {}, asserts [].
