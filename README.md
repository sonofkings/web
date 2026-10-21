# Son of Kings

Custom storefront for the $198 Crest Tracksuit, with $10 flat shipping per order.
Frontend: static HTML/CSS/JavaScript. Backend: Cloudflare Worker and PayPal Orders API.
No Shopify services are used.

## Development and deployment

Use Wrangler to run the Worker and assets together. A plain static server cannot run payment APIs.
Cloudflare's existing Git integration builds branch previews and production from the configured branch.
The Wrangler build command runs `node tests/paypal.test.cjs` before deployment.
The test uses mocked PayPal responses and native Node crypto; it does not move money.

- `index.html`, `assets/js/site.js`: storefront, product options, bag.
- `checkout/index.html`, `assets/js/checkout.js`, `assets/css/checkout.css`: on-site checkout.
- `api/paypal.js`: server pricing, U.S. address validation, create and capture.
- `worker.mjs`: API routing and static assets.
- `tests/paypal.test.cjs`: regression tests and frontend syntax checks.

## Payment configuration

Store credentials only in Cloudflare Worker settings. Never commit them or paste secrets into chat.

- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: matching REST app credentials.
- `PAYPAL_ENV=sandbox`: testing. Omit for live mode with live credentials.
- `PAYPAL_EMBEDDED_ENABLED=true`: enable order creation after account approval and testing.
- `CHECKOUT_TAX_BPS`: explicitly confirmed fixed tax rate in basis points, including explicit zero where appropriate.

Shipping is fixed in server code at **1000 cents per order**, independent of quantity or size count.
The server computes $198 per set, $96 per pair of pants, or $126 per hoodie plus $10 shipping plus configured tax and rejects a checkout
if its displayed total no longer matches server pricing. There is no shipping override in the browser.
Tax is currently a fixed configured rate applied to subtotal plus shipping. This is not a destination-based
tax engine. Confirm the actual business tax requirements before enabling; add destination-based
calculation if required. Supported delivery addresses are the 50 U.S. states and DC.

## Customer experience

Card fields are embedded in the checkout and securely hosted by PayPal. Son of Kings never receives raw
card numbers. PayPal wallet payment may open a popup; card authentication may require a bank challenge.
Account eligibility determines whether embedded card fields are available.

All selected sizes and quantities enter one order with shipping details. Customers see the final total
before payment. Shipping form values survive bag edits in page memory. Completed orders show a receipt
reference that survives refresh in the same tab. The bag clears only after confirmed payment, and only
if it still matches the paid order. Pending captures can be retried using the same order ID.

Capture checks merchant signatures, USD totals, U.S. shipping, approval status and completed capture.
Completed orders are rechecked without another capture. Capture recovery remains available when new
order creation is disabled, provided credentials remain configured. The checkout fails closed if required
settings are missing. The former hosted payment-link fallback is removed because its shipping settings
cannot be guaranteed to match the $10 policy.

PayPal merchant transaction records are the fulfillment record. A durable inventory coordinator shares stock between sets, hoodies and pants. Stock is checked at order creation and atomically reserved immediately before capture; completed payments consume the reservation once. Failed or uncertain captures retain their reservation for merchant reconciliation, preventing another customer from buying pieces that may have been charged. No automatic merchant notification system or destination-based tax calculation is included.
The legacy Stripe endpoint remains dormant and is not offered by this checkout.

## Validation and launch

Regression coverage: explicit configuration, invalid/duplicate carts, quantity limits, payment methods,
U.S. states, changed totals, $10 shipping once per multi-size order, configured tax, card/PayPal payloads,
capture idempotency, disabled-create recovery, pending/unapproved/tampered payments, completed orders,
and frontend syntax.

Still required for production activation: verify the deployed settings and live merchant account eligibility;
test sandbox card success, decline, 3DS, PayPal wallet, cancel, refresh and interrupted capture;
verify desktop/mobile browser rendering and real endpoint behavior; confirm the tax policy.
A passing build is not proof that live payments are enabled or end-to-end tested.

## Inventory

Inventory v1 begins with 39 matched sets, 2 extra hoodies and 1 extra pair of pants (41 hoodies / 40 pants). The authoritative stock is initialized once in the Inventory Durable Object, never reset by a redeploy. `/api/inventory` exposes current availability with no caching. Client quantities are advisory; checkout enforces combined component demand on the server. An unapproved or abandoned PayPal order does not hold stock. A checkout that loses a race for stock is rejected before capture. Reserved payments with ambiguous results remain held and can be retried by order ID without deducting twice. Reconcile these holds against PayPal before restoring stock; there is no automated restock or inventory admin UI yet. Future quantity updates must modify durable state rather than the initial seed.

## Stripe migration (activation pending)

Stripe Checkout can be embedded on `/checkout/`. It remains disabled until the hosting settings below are configured. PayPal remains the current payment provider until Stripe is enabled. Existing PayPal pending payments can still be confirmed after activation. `/api/checkout` aliases the current Stripe handler; the obsolete $99 hosted-checkout implementation is removed.

Use a restricted Stripe API key where possible, with the permissions needed to create, retrieve and expire Checkout Sessions and any resources required by Checkout inline pricing. Store these in Cloudflare secrets/settings, never Git:

- `STRIPE_RESTRICTED_KEY` (preferred; `STRIPE_SECRET_KEY` also supported)
- `STRIPE_PUBLISHABLE_KEY` from the same account and mode
- `STRIPE_WEBHOOK_SECRET` for `/api/stripe/webhook`
- `STRIPE_ENABLED=true` only after the integration and webhook are tested
- `CHECKOUT_TAX_BPS=0` preserves the owner's explicit no-tax setting

Register webhook events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. The handler verifies Stripe's signature against the raw request body and re-reads the Checkout Session before updating inventory. It rejects mismatched environment, currency, unknown sessions and unexpected paid totals. Duplicate events do not consume or restore stock twice. Failure returns a retryable non-success response.

For a sandbox deployment only, add `STRIPE_SANDBOX_ENABLED=true` with matching test keys. Sandbox checkout prominently says TEST CHECKOUT and uses a separate `stripe-sandbox` inventory namespace. Never enable sandbox mode on the customer-facing production site. Sandbox reservations cannot change `store` inventory.

Checkout reserves shared components before exposing a session to a buyer. Unpaid sessions expire after 30 minutes; verified expiration releases their inventory. Paid and delayed-payment sessions retain stock. Editing the bag first expires the open Stripe session, then releases stock. Reconcile missed expiration events through Stripe event retries before manually changing quantities. The webhook must be operational before enabling checkout. There is no paid-order refund/restock workflow in this change.

Automated validation uses mocked Stripe API responses plus the real SDK and inventory coordinator; it does not charge a card. Remaining activation checks: real sandbox card success/decline/authentication, wallet and redirect flows, delayed payments, webhook delivery/retries, refresh and bag editing, desktop/mobile rendering, and live merchant eligibility. This branch is preparation, not evidence of a completed live payment.
