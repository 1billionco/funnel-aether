# Privacy notes

<!-- DRAFT: needs review -->

Working notes for the privacy notice, DPA and records of processing. Not legal advice; Joshua's legal reviewer signs off.

## Roles

- **Controller** for account data (owners, team members, billing contacts, product analytics).
- **Processor** for the leads each business collects through forms, imports and manual entry. The terms need a DPA section.

## Lawful basis per data type

| Data                                                | Purpose                                           | Lawful basis (UK GDPR / NDPA)                                              |
| --------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Account (email, name, auth provider)                | Provide the service, sign-in                      | Contract                                                                   |
| Business profile (name, country, timezone, address) | Provide the service, currency, legal email footer | Contract                                                                   |
| Brand questionnaire                                 | Generate content in the brand's voice             | Contract                                                                   |
| First-party product events                          | Run and improve the beta, validation metrics      | Legitimate interests (no third-party tracking; PostHog only after consent) |
| Feedback messages                                   | Improve the product                               | Legitimate interests                                                       |
| Hashed IP for rate limiting                         | Security, abuse prevention                        | Legitimate interests (salted hash, raw IP not stored)                      |

_Leads (M4), email sends (M5) and billing (M7) are added as they ship._

## Sub-processors and transfers

| Sub-processor     | Purpose                                  | Location                                  | Transfer basis |
| ----------------- | ---------------------------------------- | ----------------------------------------- | -------------- |
| Supabase          | database, auth, storage                  | London (eu-west-2)                        | —              |
| Netlify           | hosting, functions                       | US by default (London if the plan allows) | _to confirm_   |
| Anthropic         | content generation                       | US                                        | _to confirm_   |
| Voyage AI         | embeddings                               | US                                        | _to confirm_   |
| Resend            | email delivery                           | US                                        | _to confirm_   |
| PostHog           | product analytics (after consent)        | EU                                        | —              |
| Sentry            | error monitoring                         | _to confirm_                              | _to confirm_   |
| Stripe / Paystack | payments (they hold card data, we don't) | —                                         | —              |

## Known gaps

- **Nigeria residency:** data is stored in the UK region for the validation build. In-country residency is a later milestone.
- **Gemini fallback** stays off for real customer data until Google's data-use terms for the key tier are checked.
