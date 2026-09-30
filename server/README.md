# Escrit — server

The API behind Escrit, a multi-category marketplace for products,
courses, and services. Buyers pay once through the configured processor; Paystack is the default and each listing
in the cart gets its own escrow order. Sellers handle shipping or service
appointments, buyers confirm completion, and the platform handles disputes.
Node, Express and MongoDB, deployed on Render.

The web client is in the companion `client` repository.

## How money moves

1. A seller verifies a Nigerian bank account. The selected provider resolves the
   account number to its registered holder — that name, never the raw
   number, is what buyers see.
2. Publishing a listing automatically creates an external share link.
   Marketplace purchases use the buyer's cart instead.
3. Checkout creates one provider charge for the basket and a separate
   **Transaction** (escrow record) for each listing in the basket.
4. Provider webhooks are authenticated with the configured secret. The API
   verifies the provider transaction ID, status, currency, and total
   before moving every order to **held**.
5. Sellers update shipment tracking or service completion. Buyers confirm
   completion or raise a dispute; there is no timer starting at payment.
   Admin dispute resolutions record a written reason.

Payouts and refunds use the selected provider. Seller payouts use the saved verified
bank details, minus the configurable platform commission. Buyer-facing listing
prices include the provider-quoted processing fee, which is not itemized at checkout.

## Live vs. test payments

Every provider ships two full key pairs (`..._TEST` and `..._LIVE` in
`.env.example`). Which pair is actually used is a runtime setting — the
**owner** flips it from `/admin/settings` in the app, no redeploy
needed. The platform always starts in `test` mode on a fresh deploy, and the
UI requires an explicit confirmation before switching to `live`, since that's
the one change that moves real money. Checkout, webhooks, bank verification,
and payouts all read whichever pair is currently active.

## Running locally

```bash
npm install
cp .env.example .env      # fill in Mongo, JWT secrets and Paystack keys
npm run dev
```

## Environment variables

See `.env.example` for the full list and what each one does. At minimum
you need `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`PAYSTACK_SECRET_KEY`, and `PAYSTACK_WEBHOOK_SECRET`. Set `OWNER_EMAILS` to bootstrap the
platform owner account. `ADMIN_EMAILS` remains available for migration-compatible
admin access. Cloudinary, Google Sign-In, and Brevo email are optional integrations.

## Media uploads (Cloudinary)

The server never touches image bytes. `POST /api/links/upload-signature`
returns a short-lived signed request that lets the browser upload photos,
dispute evidence, and short course videos directly to Cloudinary. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`
and `CLOUDINARY_API_SECRET` to enable it; without them, sellers can still
paste an image link.

## Webhooks

Point the Paystack webhook at `POST /api/webhooks/paystack` and set
`PAYSTACK_WEBHOOK_SECRET`. The endpoint verifies the HMAC signature and
re-verifies payment details before holding funds. If the owner selects
Flutterwave in platform settings, configure `/api/webhooks/flutterwave` and
`FLW_SECRET_HASH` instead.

## Production deployment

Deploy the `server` directory as a Render web service with build command
`npm ci`, start command `npm start`, and health check path `/api/health`. Set
`CLIENT_ORIGIN` to the exact Vercel origin(s), including any deliberate preview
origin. Configure `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, MongoDB, JWT secrets,
`OWNER_EMAILS`, and the optional Cloudinary, Google, and Brevo variables in Render.

Deploy the `client` directory to Vercel with `npm run build` and output directory
`dist`. Set `VITE_API_URL` to the public Render URL with no trailing slash and
`VITE_GOOGLE_CLIENT_ID` when Google sign-in is enabled. Configure the payment
webhook only after the Render URL is live, then verify `/api/health`, login,
checkout initialization, webhook delivery, and Socket.IO from the deployed
Vercel origin.

## Realtime service chat

Socket.IO shares the Express HTTP server and authenticates each connection with
the short-lived access token. Configure `CLIENT_ORIGIN` for every deployed client
origin; service offer messages are persisted in MongoDB and sockets deliver live
updates, presence, typing, and read state.

## Admin review

Admins review KYC, approve listings, resolve disputes, and inspect post-delivery
complaints. Accounts listed in `OWNER_EMAILS` can grant or revoke persisted admin
roles and update the platform commission percentage.

## Fulfillment

Payment does not start an auto-release countdown. Sellers record shipment
and tracking updates or service meeting/completion status. Buyers confirm
delivery/completion or open a dispute before escrow payout.
