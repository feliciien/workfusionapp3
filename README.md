# Workfusion Trading AI

Workfusion Trading AI is a SaaS MVP for MT4/MT5 Expert Advisor builders.

It helps traders:

- Generate EA drafts from plain-English strategy ideas.
- Debug MQL4/MQL5 code and compiler errors.
- Analyze trading reports and identify risk issues.
- Optimize prop-firm settings before demo or live testing.
- Download generated code artifacts.
- Save projects through a local storage adapter.
- Pre-check generated code and estimate backtest readiness.
- Prepare Stripe/PayPal billing with explicit live-mode guardrails.

## Product Positioning

Workfusion is a software tool. It does not manage accounts, execute trades, custody funds, or guarantee profits.

Core offer:

> Generate, debug, and risk-check MT4/MT5 Expert Advisors for prop-firm traders.

## Local Development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification

```bash
npm run lint
npm run build
```

## API Routes

- `POST /api/trading/generate`
- `POST /api/trading/debug`
- `POST /api/trading/debrief`
- `POST /api/trading/optimize`
- `POST /api/trading/download`
- `POST /api/subscription/status`
- `GET|POST /api/auth/session`
- `GET|POST /api/projects`
- `POST /api/workers/compile`
- `POST /api/workers/backtest`
- `POST /api/billing/checkout`

## Billing Safety

`/api/billing/checkout` only creates provider checkout/approval sessions when:

```text
WORKFUSION_BILLING_MODE=live
NEXT_PUBLIC_APP_URL=https://www.workfusionapp.com
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID=...
NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID=...
```

Stripe also requires:

```text
STRIPE_SECRET_KEY=...
STRIPE_PRICE_STARTER=...
STRIPE_PRICE_PRO=...
STRIPE_PRICE_STUDIO=...
```

## Launch Checklist

- Connect Stripe price IDs or PayPal order capture before public paid launch.
- Add Terms of Service and Privacy Policy.
- Add production logging and rate limits.
- Add user accounts and persistent project storage.
- Add a real MQL compile/test worker before marketing outputs as production-ready.
