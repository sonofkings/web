# Son of Kings

Custom storefront for the $99 Crest Tracksuit, with $10 flat shipping per order.
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
The server computes $99 per set plus $10 shipping plus configured tax and rejects a checkout
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

PayPal merchant transaction records are the fulfillment record. No separate order database, automatic
merchant notification system, stock reservation or destination-based tax calculation is included.
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
