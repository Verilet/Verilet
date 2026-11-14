---
id: SCRUM-18-T-1
story: SCRUM-18
sprint: 3
assignee: Lars Voigt-Bui
estimate_hours: 6
---

# Implement Regex Payment Worker Scanner

## Description
This serves SCRUM-18 covers a student wanting to be alerted if the lister for a property requests payment through high risk payment methods, so they avoid sendind money through unsafe methods. This task only focuses implements a Regex Payment Worker Scanner, scanning a listing description for irreversible payment channels, and returning an array of violations: SCRUM-18-T-1: Flag untraceable payment terms (crypto, wire transfers, gift cards) in listing text. Out of scope: cash-app advance-fee detection and payment checkbox checks (SCRUM-18-T-2), the HTTP route, and the warning UI.

## Specs
- detectUntraceablePayment(description) in server/services/paymentFlags.js returns an array of violations.

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

- A description mentioning Bitcoin, BTC, Ethereum, or USDT returns an UNTRACEABLE_PAYMENT violation with severity critical.

- A description mentioning Western Union, MoneyGram, or a wire transfer returns a violation.

- A description mentioning Apple, Steam, or Vanilla Visa gift cards returns a violation.

- The violation's evidence contains the matched text, and matching works in any letter case.

- A description matching two categories returns two violations.

- Empty or null input returns [], and a clean post-lease payment description returns [].

- Tests include at least 4 scam samples and 2 clean samples.

