# 21 — Privacy, Compliance, and Legal Hygiene

You are not a lawyer, and the product's legal text is a hard stop. But engineering
choices decide whether compliance is later easy or impossible. Build the mechanisms;
leave the legal judgement to humans.

## Contents
1. Data inventory
2. Privacy-by-design mechanisms
3. Cookies and tracking
4. Regulated domains
5. Legal pages
6. Open-source licenses
7. Checklist

---

## 1. Data inventory

Add a section to ARCHITECTURE.md:

| Data | Where stored | Why needed | Sensitivity | Retention | Who can access |
|---|---|---|---|---|---|
| Email | users.email | Login, notifications | PII | Until account deletion | User, admins |
| Password hash | users.password_hash | Login | Secret | Until deletion/change | Nobody (service only) |
| IP address | audit_events.ip | Security | PII | 90 days | Admins |

If a column is not justified by a "why", don't collect it.

## 2. Privacy-by-design mechanisms

- **Export:** user can download all their data (JSON or CSV) — supports access/portability rights (e.g. GDPR Art. 15/20).
- **Delete:** user can delete their account; cascade or anonymize their data; document what is kept and why (e.g. invoices for tax law) — supports erasure requests.
- **Correction:** user can edit profile data.
- **Minimization:** no PII in logs, analytics events, URLs, or error trackers; mask in admin views where not needed.
- **Retention jobs:** scheduled cleanup for expired sessions, old logs, soft-deleted rows past their window.
- **Encryption:** TLS in transit (platform); encryption at rest via managed DB; application-level encryption for especially sensitive fields (tokens to third parties, government IDs).
- **Processors:** list every third-party service that receives user data (email provider, analytics, LLM provider) in ARCHITECTURE.md — the human needs this for a privacy policy and DPAs.
- **LLM data:** never send PII/confidential data to a model provider unless the human approves that provider for that data (ref 11).

## 3. Cookies and tracking

- Strictly necessary cookies (session, CSRF) need no consent banner in most regimes; analytics/marketing cookies often do (EU/UK).
- Default: no third-party tracking. Analytics adapter off or privacy-friendly (cookieless) by default; a consent mechanism stub if marketing tracking is requested.

## 4. Regulated domains (flag in ASSUMPTIONS and the delivery report)

| Domain | Signals | Engineering implication | Human action |
|---|---|---|---|
| Health | diagnoses, symptoms, prescriptions, patient | Audit everything, strict access, encryption, BAA-capable hosting | Legal review (e.g. HIPAA) before real data |
| Payments | card numbers | **Never** touch raw card data — use the provider's hosted fields/checkout so you stay out of most PCI scope | Provider account, PCI SAQ |
| Children | users under 13/16 | Age gate, parental consent flows, minimal data | Legal review (COPPA/GDPR-K) |
| Finance | balances, transfers, KYC | Double-entry ledger, idempotency, immutable history | Licensing review |
| Employment/education | grades, HR data | Strong access control, audit | Policy review |

Do not claim the product "is HIPAA/PCI/GDPR compliant". Say which mechanisms exist and what review remains.

## 5. Legal pages

Create `/terms` and `/privacy` pages containing a clearly visible notice:
"Placeholder — this text must be written or reviewed by a qualified professional before launch."
Include the data inventory facts (what is collected, processors, retention) to make the human's job easy.
Never present generated legal text as final.

## 6. Open-source licenses

- Prefer permissive licenses (MIT, Apache-2.0, BSD, ISC) for dependencies.
- Flag copyleft (GPL/AGPL) dependencies in DECISIONS.md — AGPL in a SaaS backend has obligations the human must accept.
- Do not copy code from sources with unknown licenses. Keep third-party notices if required.

## 7. Checklist
- [ ] Data inventory table complete
- [ ] Export and delete-account flows implemented and tested
- [ ] No PII/secrets in logs, URLs, analytics
- [ ] Third-party processors listed
- [ ] Legal pages marked as placeholders
- [ ] Regulated-domain flags raised in the delivery report
- [ ] Dependency licenses reviewed
