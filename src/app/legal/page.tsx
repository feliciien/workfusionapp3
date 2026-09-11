export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#101112] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-sm text-emerald-300">Back to Workfusion</a>
        <h1 className="mt-8 text-4xl font-semibold">Risk disclosure and product terms</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-zinc-300">
          <p>
            Workfusionapp, Inc. provides software tools for generating, reviewing, debugging, and organizing
            MetaTrader Expert Advisor code. Workfusion does not manage trading accounts, execute trades on behalf of
            customers, custody funds, or guarantee trading outcomes.
          </p>
          <p>
            Automated trading involves substantial risk. Backtests and simulations can be inaccurate, overfit, or
            affected by broker spreads, execution quality, data quality, and platform settings. Past performance and
            generated risk scores do not guarantee future results.
          </p>
          <p>
            Customers are responsible for reviewing generated code, compiling it, testing it in a demo environment,
            confirming broker and prop-firm rule compliance, and deciding whether any trading system is suitable for
            their own risk tolerance.
          </p>
          <p>
            Workfusion outputs are educational and technical assistance only. They are not investment advice,
            financial advice, legal advice, or an instruction to buy or sell any financial instrument.
          </p>
        </div>
      </div>
    </main>
  );
}
