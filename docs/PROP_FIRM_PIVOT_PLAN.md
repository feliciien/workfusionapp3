# WorkFusion Prop Firm Platform Pivot Plan
# WorkFusion Prop Firm Platform Pivot Plan

## Executive Summary

This document outlines the complete pivot of WorkFusion Trading AI from a general MT4/MT5 automation tool to a complete prop firm platform serving both traders and prop firm businesses. The transformation leverages WorkFusion's existing AI capabilities while adding comprehensive prop firm infrastructure for challenge management, evaluation, funding, and talent discovery.

## Strategic Objectives

1. Transform WorkFusionApp into a profitable proprietary trading evaluation and funding business
2. Build a quantitative talent discovery pipeline for BoltIQ Capital
3. Create multiple revenue streams: challenge fees, profit shares, subscriptions, and scaling economics
4. Develop a deterministic, auditable, risk-first platform that supports the complete trader lifecycle

## Core Architecture Components

### 1. Rule Engine (src/lib/workfusion/prop-firm/rule-engine.ts)
- Central source of truth for all trading rules
- Supports configurable rules without rewriting business logic
- Includes: drawdown limits, profit targets, trading days, position sizing, exposure limits, leverage restrictions, instrument/news/weekend/holding time restrictions, consistency rules, frequency limits
- Deterministic state machine: NORMAL WARNING AT_RISK BREACHED
- Fully auditable risk calculations

### 2. Risk Engine (src/lib/workfusion/prop-firm/risk-engine.ts)
- Real-time risk monitoring of equity, balance, floating P/L, realized P/L, daily P/L, drawdown, exposure, position size, margin, leverage, correlated exposure, concentration, trading frequency, abnormal behavior
- Processes MT5 trading events and updates account state
- Integrates with rule engine for compliance evaluation
- Generates risk snapshots and state transitions

### 3. Evaluation Engine (src/lib/workfusion/prop-firm/evaluation-engine.ts)
- Manages complete trader lifecycle: CREATED ACTIVE WARNING AT_RISK BREACHED PASSED EXPIRED SUSPENDED FUNDED
- Processes trading events and determines account status
- Handles challenge phase completion (1-phase vs 2-phase evaluations)
- Manages funded account scaling and payout requests
- Creates challenge and funded accounts from trader profiles

### 4. Account Engine (src/lib/workfusion/prop-firm/account-engine.ts)
- Manages trader profiles, challenge accounts, funded accounts, and financial ledger
- Handles KYC/AML verification, AI subscriptions, and account lifecycle
- Processes MT5 events for both challenge and funded accounts
- Records all financial transactions in immutable ledger
- Provides financial summaries and reporting

### 5. Performance Engine (src/lib/workfusion/prop-firm/performance-engine.ts)
- Calculates comprehensive trading analytics: return, profit factor, max drawdown, Sharpe/Sortino/Calmar ratios, win rate, expectancy, recovery factor
- Measures consistency, trading frequency, exposure, timing, and strategy characteristics
- Calculates Quantitative Talent Score (0-100) for BoltIQ pipeline identification
- Provides performance metrics for both challenge and funded accounts

## Data Models

### Trader Lifecycle States
- VISITOR REGISTERED CHALLENGE_PURCHASED CHALLENGE_ACTIVE/EVALUATION_ACTIVE ... FUNDED_ACTIVE ELITE_TRADER QUANT_TALENT_POOL BOLTIQ_ASSESSMENT

### Challenge Configuration Tiers
- STARTER ($10K account, $99 fee)
- STANDARD ($25K account, $199 fee) 
- PRO ($50K account, $349 fee)
- ADVANCED ($100K account, $599 fee)
- ELITE ($200K account, $999 fee)

### Scaling Plans
- Level 1: $10K Level 2: $25K Level 3: $50K Level 4: $100K Level 5: $250K Level 6: $500K+
- Based on profit percentage, consistency months, and drawdown limits

### Financial Ledger Entry Types
- Revenue: CHALLENGE_PURCHASE, CHALLENGE_RESET, SUBSCRIPTION_PRO, SUBSCRIPTION_QUANT, PROFIT_SHARE_FIRM
- Expenses: TRADER_PAYOUT, REFUND, CHARGEBACK, PAYMENT_FEE, KYC_COST, INFRASTRUCTURE_COST, SUPPORT_COST, OPERATIONAL_ADJUSTMENT

## API Endpoints

### Challenge Management (/api/prop-firm/challenges)
- GET: List challenges or get specific challenge configuration
- POST: Purchase challenge or reset challenge account
- PUT: Process MT5 trading events, start/complete challenges
- DELETE: Not applicable

### Funded Account Management (/api/prop-firm/funded)
- GET: List funded accounts or get specific account details
- POST: Request payout or process MT5 trading events
- PUT: Submit scaling requests
- DELETE: Not applicable

### Trader Management (/api/prop-firm/trader)
- GET: Get trader profile or specific data
- POST: Update profile, subscription, or upload KYC documents
- PUT: Refresh lifecycle state or perform advanced actions
- DELETE: Not applicable

### Admin Management (/api/prop-firm/admin/*)
- GET: Dashboard data, challenges, funded accounts, traders, ledger, financials, payouts, scaling, risk
- POST: Approve/reject scaling, approve/reject payouts, create/update challenge configurations
- PUT: Admin updates
- DELETE: Admin cleanup

## Frontend Pages

### Public Pages
- /prop-firm: Main landing page with challenge overview and tier comparison
- /prop-firm/how-it-works: Educational content about the prop firm model

### Authenticated Dashboard (/prop-firm/dashboard/*)
- /prop-firm/dashboard: Overview tab with welcome, stats, quick actions, recent activity
- /prop-firm/dashboard/challenges: My challenges and available challenges tabs
- /prop-firm/dashboard/funded: My funded accounts tabs
- /prop-firm/dashboard/analytics: Performance analytics and quantitative talent score
- /prop-firm/dashboard/settings: Profile settings, AI subscription, KYC verification

## Revenue Model

### Primary Revenue Streams
1. Challenge/Evaluation Fees: One-time payments for challenge attempts ($99-$999)
2. Funded Trader Profit Share: Percentage of trader profits (typically 15-20% to firm)
3. Challenge Reset/Retry Revenue: Optional paid resets ($49-$399)
4. Premium AI Subscription: Tiered subscriptions (Free, Pro, Quant)
5. Scaling Economics: Increased profit share percentages at higher capital levels

### Pricing Tiers for Traders
- Starter: $99/challenge, 80% profit split, basic tools
- Standard: $199/challenge, 80% profit split, standard tools
- Pro: $349/challenge, 85% profit split, advanced tools
- Advanced: $599/challenge, 85% profit split, professional tools
- Elite: $999/challenge, 90% profit split, elite tools + priority support

### Pricing for AI Subscriptions
- Free: Basic analytics, limited AI functionality
- Pro: $29/month - AI strategy generation, backtesting, risk scanner
- Quant: $69/month - Advanced analytics, Monte Carlo, walk-forward analysis

## Go-to-Market Strategy

### Phase 1: Trader Acquisition (Months 1-3)
- Content marketing around prop firm evaluation success stories
- Partnerships with trading educators and influencers
- Free trial challenges with limited features
- SEO targeting prop firm challenge keywords
- Social media advertising targeting trading communities

### Phase 2: Platform Launch (Months 4-6)
- Public launch of prop firm platform
- Beta testing with partner prop firms
- Referral programs for successful trader networks
- Email marketing campaigns to trading lists
- Trading challenge competitions with prizes

### Phase 3: Network Effects (Months 7-12)
- Trader success stories driving organic growth
- Quantitative talent pipeline activation for BoltIQ Capital
- Data network improving AI strategy generation
- Community features for trader collaboration and mentorship
- Enterprise sales to prop firms for white-label solutions

## Technical Implementation Timeline

### Month 1: Foundation
- Week 1-2: Rule engine implementation and testing
- Week 3-4: Risk engine and evaluation engine core
- Week 5-6: Account engine and financial ledger

### Month 2: Core Features
- Week 1-2: Performance engine and quantitative talent scoring
- Week 3-4: API endpoints for challenges and funded accounts
- Week 5-6: Trader management APIs and authentication

### Month 3: Integration & UI
- Week 1-2: Frontend dashboard components
- Week 3-4: API admin endpoints and management interfaces
- Week 5-6: Integration testing and bug fixes

### Month 4: Launch Preparation
- Week 1-2: Performance optimization and security review
- Week 3-4: Documentation and deployment preparation
- Week 5-6: Beta testing with select trader groups

### Month 5: Public Launch
- Week 1-2: Platform launch and initial marketing
- Week 3-4: User onboarding and support scaling
- Week 5-6: Feedback collection and rapid iteration

## Success Metrics & KPIs

### Trader Success Metrics
- Evaluation pass rate (target: 45%+ improvement over industry average)
- Average time to funding (target: <25 days)
- Trader retention rate (target: 50%+ after 3 months)
- Average profit per funded trader (target: $2,500+ monthly)

### Platform Performance Metrics
- Challenge conversion rate (visitors to paid challenges: target 8%+)
- Customer acquisition cost (CAC) vs lifetime value (LTV) ratio (target 1:3+)
- Platform uptime and reliability (target: 99.9%)
- Net promoter score (NPS target: 40+)

### Financial Metrics
- Monthly recurring revenue (MRR) growth (target: 25%+ MoM)
- Gross margin (target: 75%+)
- Contribution margin per trader (target: positive after 2 months)
- Payback period on CAC (target: <4 months)

### Talent Pipeline Metrics
- Number of traders entering Quant Talent Pool (target: 5% of funded traders)
- BoltIQ assessment conversion rate (target: 15% of talent pool)
- Long-term performance of recruited talent (target: 20%+ above market)

## Risk Management & Compliance

### Trader Protection
- Clear disclosure that software does not guarantee profits
- Risk education resources integrated throughout platform
- Mandatory risk acknowledgment before challenge participation
- Daily loss limits enforced at platform level
- Maximum position and exposure controls

### Firm Compliance
- KYC/AML integration for trader onboarding
- Transaction monitoring for suspicious activity
- GDPR/CCPA compliance for trader data
- SOC 2 Type II readiness for enterprise clients
- Regular security audits and penetration testing
- DDoS protection and rate limiting
- Backup and disaster recovery procedures

## Resource Requirements

### Development Team
- 2 Full-stack developers (Next.js, TypeScript)
- 1 AI/ML specialist (for strategy generation enhancement)
- 1 DevOps engineer (AWS/Vercel scaling)
- 1 UI/UX designer (trader and firm interfaces)
- 1 Product manager (prop fintech domain expertise)

### Third-Party Integrations
- Payment processors (Stripe, PayPal for challenge fees)
- Identity verification (Jumio, Onfido for KYC)
- Market data providers (for realistic backtesting)
- Cloud infrastructure (AWS/Azure for scaling)
- Email service providers (for communications and notifications)

## Immediate Next Steps

1. Technical Validation: Run comprehensive tests on all new modules
2. Market Validation: Interview 20+ prop firms and 100+ traders about needs
3. Competitive Analysis: Detail differentiation from FTMO, MyForexFunds, etc.
4. Resource Planning: Finalize team structure, budget, and hiring plan
5. Legal Consultation: Review regulatory requirements for prop firm operations
6. Pilot Program: Launch beta with 50 traders to validate core flows
7. Launch Preparation: Prepare marketing materials, support documentation, and SLA

## Conclusion

This pivot transforms WorkFusion from a generic trading tool into a complete prop firm platform with multiple revenue streams and a quantitative talent discovery pipeline. By leveraging existing AI capabilities and adding comprehensive prop firm infrastructure, WorkFusion can capture significant value in the growing prop trader market while building a sustainable competitive advantage through talent discovery for BoltIQ Capital.

The evolutionary approach minimizes risk while maximizing market opportunity, building on WorkFusion's proven strengths in AI-generated strategies and risk governance.
