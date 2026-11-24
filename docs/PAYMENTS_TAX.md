# Payments and tax baseline

## Payment architecture

Razorpay remains feature-flagged and test-mode only until the product is ready for merchant review. The client never supplies an authoritative price. The server creates orders/subscriptions from the versioned price book; signed webhooks are authoritative for payment state.

Every webhook stores provider event ID, type, received time, raw-body integrity reference, processing attempts, normalized state, and terminal result. Handlers are idempotent and tolerate duplicates and out-of-order delivery. Entitlement changes and usage are represented by immutable ledgers.

## Launch catalog proposal

- Free
- Premium monthly: ₹499
- Premium quarterly: ₹1,299
- Premium annual: ₹3,999
- One-time professional resume-writing project: ₹10,000
- One-time resume, cover-letter, and LinkedIn writing project: ₹15,000

The writing services are project-scoped add-ons and never renew. Orders are created server-side from product IDs and the controlled price book. The browser cannot supply an amount. The international 1.30 business uplift and versioned FX reference apply to these add-ons in the same way as the broader catalog.

International prices derive from INR list price × controlled FX reference × 1.30 business uplift, rounded into a versioned price book. The uplift must not be described as a processor fee. Existing subscriptions retain their signup amount/currency.

## Customer protections

- Auto-renewal can be disabled without a dark pattern; access continues through the paid-through date.
- Renewal date, cancellation state, retry/grace status, invoice, and downgrade outcome remain visible.
- Payment failure cannot create duplicate subscriptions and does not delete user content.
- Refund rules are configuration with reason and audit trail, not hardcoded legal conclusions.

## Launch gates

An Indian accountant/legal adviser must approve GST classification/invoice requirements, export-of-service/LUT treatment, retention, marketplace TDS/payout obligations, and each enabled foreign paid market. Razorpay approval, current supported currencies, recurring-plan mechanics, cross-border/FIRC handling, and fees must be re-verified from official sources before implementation or publication.
