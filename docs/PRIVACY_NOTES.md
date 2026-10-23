# Privacy notes

<!-- DRAFT: needs review -->

Working notes for the privacy notice, DPA and records of processing. Not legal advice; Joshua's legal reviewer signs off.

## Roles

- **Controller** for account data (owners, team members, billing contacts, product analytics).
- **Processor** for the leads each business collects through forms, imports and manual entry. The terms need a DPA section.

## Lawful basis per data type

_To be completed as features ship (M1 auth, M4 leads, M5 email, M7 billing)._

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
