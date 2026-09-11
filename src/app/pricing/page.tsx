"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ChallengeConfig {
  id: string;
  name: string;
  tier: string;
  description: string;
  accountSize: number;
  price: number;
  resetPrice?: number;
  profitTargetPct: number;
  maxDailyLossPct: number;
  maxTotalLossPct: number;
  minTradingDays: number;
  maxPositionSizePct?: number;
  maxExposurePct?: number;
  maxLeverage?: number;
  phaseCount: number;
  scalingEnabled: boolean;
  profitSplitTraderPct: number;
  profitSplitFirmPct: number;
}

const challenges: ChallengeConfig[] = [
  {
    id: "starter_10k",
    name: "Starter",
    tier: "STARTER",
    description: "Entry-level challenge for new traders",
    accountSize: 10000,
    price: 99,
    resetPrice: 49,
    profitTargetPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 3,
    maxPositionSizePct: 5,
    maxExposurePct: 20,
    maxLeverage: 30,
    phaseCount: 1,
    scalingEnabled: true,
    profitSplitTraderPct: 80,
    profitSplitFirmPct: 20,
  },
  {
    id: "standard_25k",
    name: "Standard",
    tier: "STANDARD",
    description: "Standard challenge for developing traders",
    accountSize: 25000,
    price: 199,
    resetPrice: 99,
    profitTargetPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 4,
    maxPositionSizePct: 5,
    maxExposurePct: 20,
    maxLeverage: 30,
    phaseCount: 2,
    scalingEnabled: true,
    profitSplitTraderPct: 80,
    profitSplitFirmPct: 20,
  },
  {
    id: "pro_50k",
    name: "Pro",
    tier: "PRO",
    description: "Professional challenge for experienced traders",
    accountSize: 50000,
    price: 349,
    resetPrice: 149,
    profitTargetPct: 10,
    maxDailyLossPct: 4,
    maxTotalLossPct: 8,
    minTradingDays: 5,
    maxPositionSizePct: 4,
    maxExposurePct: 15,
    maxLeverage: 20,
    phaseCount: 2,
    scalingEnabled: true,
    profitSplitTraderPct: 85,
    profitSplitFirmPct: 15,
  },
  {
    id: "advanced_100k",
    name: "Advanced",
    tier: "ADVANCED",
    description: "Advanced challenge for skilled traders",
    accountSize: 100000,
    price: 599,
    resetPrice: 249,
    profitTargetPct: 8,
    maxDailyLossPct: 3,
    maxTotalLossPct: 6,
    minTradingDays: 7,
    maxPositionSizePct: 3,
    maxExposurePct: 10,
    maxLeverage: 15,
    phaseCount: 2,
    scalingEnabled: true,
    profitSplitTraderPct: 85,
    profitSplitFirmPct: 15,
  },
  {
    id: "elite_200k",
    name: "Elite",
    tier: "ELITE",
    description: "Elite challenge for expert traders",
    accountSize: 200000,
    price: 999,
    resetPrice: 399,
    profitTargetPct: 6,
    maxDailyLossPct: 2.5,
    maxTotalLossPct: 5,
    minTradingDays: 10,
    maxPositionSizePct: 2,
    maxExposurePct: 8,
    maxLeverage: 10,
    phaseCount: 2,
    scalingEnabled: true,
    profitSplitTraderPct: 90,
    profitSplitFirmPct: 10,
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTierColor(tier: string) {
  switch (tier) {
    case "STARTER": return "bg-blue-100 text-blue-800";
    case "STANDARD": return "bg-green-100 text-green-800";
    case "PRO": return "bg-purple-100 text-purple-800";
    case "ADVANCED": return "bg-orange-100 text-orange-800";
    case "ELITE": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export default function PricingPage() {
  const [checkout, setCheckout] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({
    status: "idle",
    message: "Choose your challenge and start the evaluation process.",
  });

  async function startCheckout(challengeId: string) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    setCheckout({ status: "loading", message: "Creating checkout session..." });

    try {
      const response = await fetch("/api/prop-firm/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          challengeId,
          // In production, email would come from auth session
          email: "trader@example.com",
          mt5Login: 12345,
          mt5Server: "DemoServer",
          provider: "stripe"
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create checkout");

      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckout({ status: "success", message: "Challenge created successfully!" });
      }
    } catch (error) {
      setCheckout({ 
        status: "error", 
        message: error instanceof Error ? error.message : "Checkout failed" 
      });
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white overflow-hidden py-16">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Choose Your Challenge
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Select the evaluation that matches your experience level and trading goals. 
            All challenges include real-time risk monitoring, AI-powered analytics, and a clear path to funded capital.
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">5</div>
              <div className="text-sm text-gray-600 mt-1">Challenge Tiers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">$10K–$200K</div>
              <div className="text-sm text-gray-600 mt-1">Account Sizes</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">Up to 90/10</div>
              <div className="text-sm text-gray-600 mt-1">Profit Split</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">AI-Powered</div>
              <div className="text-sm text-gray-600 mt-1">Talent Discovery</div>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {challenges.map((challenge) => (
              <article
                key={challenge.id}
                className="flex flex-col h-full rounded-xl border bg-white shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getTierColor(challenge.tier)}`}>
                      {challenge.tier}
                    </span>
                    {challenge.tier === "PRO" && (
                      <span className="inline-flex px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{challenge.name}</h2>
                  <p className="mt-2 text-gray-600">{challenge.description}</p>
                  
                  <div className="mt-6 flex items-end gap-2">
                    <span className="text-4xl font-bold text-gray-900">{formatCurrency(challenge.price)}</span>
                    <span className="text-gray-500 pb-1">one-time</span>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span>${formatCurrency(challenge.accountSize)} account</span>
                    {challenge.resetPrice && (
                      <span className="text-orange-600">Reset: {formatCurrency(challenge.resetPrice)}</span>
                    )}
                  </div>
                </div>

                <div className="px-6 pb-4 border-t border-gray-100">
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Profit Target</dt>
                      <dd className="font-semibold text-gray-900">{challenge.profitTargetPct}%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Max Daily Loss</dt>
                      <dd className="font-semibold text-gray-900">{challenge.maxDailyLossPct}%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Max Drawdown</dt>
                      <dd className="font-semibold text-gray-900">{challenge.maxTotalLossPct}%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Min Trading Days</dt>
                      <dd className="font-semibold text-gray-900">{challenge.minTradingDays}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Profit Split</dt>
                      <dd className="font-semibold text-gray-900">
                        {challenge.profitSplitTraderPct}% / {challenge.profitSplitFirmPct}%
                      </dd>
                    </div>
                    {challenge.phaseCount > 1 && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Phases</dt>
                        <dd className="font-semibold text-gray-900">{challenge.phaseCount}-Phase</dd>
                      </div>
                    )}
                    {challenge.scalingEnabled && (
                      <div className="flex justify-between text-green-600">
                        <dt className="text-green-500">Scaling</dt>
                        <dd className="font-semibold">Up to $500K+</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="p-6 pt-0">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                    onClick={() => startCheckout(challenge.id)}
                    disabled={checkout.status === "loading"}
                  >
                    {checkout.status === "loading" ? "Creating Session..." : "Start Challenge"}
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {/* Checkout Status */}
          <div className="mt-8 max-w-xl mx-auto">
            {checkout.status !== "idle" && (
              <div className={`rounded-lg p-4 ${
                checkout.status === "error" ? "bg-red-50 border border-red-200 text-red-800" :
                checkout.status === "success" ? "bg-green-50 border border-green-200 text-green-800" :
                "bg-blue-50 border border-blue-200 text-blue-800"
              }`}>
                {checkout.message}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              From Challenge to Funded Capital
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-white rounded-xl">
              <div className="text-5xl mb-4">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Purchase Challenge</h3>
              <p className="text-gray-600">Select your tier, provide MT5 credentials, and get instant access</p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl">
              <div className="text-5xl mb-4">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Trade Evaluation</h3>
              <p className="text-gray-600">Meet profit targets while respecting daily and total drawdown limits</p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl">
              <div className="text-5xl mb-4">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Get Funded</h3>
              <p className="text-gray-600">Receive a funded account with profit share (up to 90/10)</p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl">
              <div className="text-5xl mb-4">4</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Scale & Grow</h3>
              <p className="text-gray-600">Progress from $10K to $500K+ based on consistent performance</p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Subscription Tiers */}
      <section className="py-16 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              AI Trading Lab Subscription
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Enhance your trading with AI-powered strategy generation, backtesting, and quantitative research tools.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-xl font-bold text-gray-900">Free</h3>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-500 pb-1">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li className="flex gap-2"><span>✓</span> Basic analytics</li>
                <li className="flex gap-2"><span>✓</span> Basic risk information</li>
                <li className="flex gap-2"><span>✓</span> Limited AI functionality</li>
                <li className="flex gap-2"><span>✓</span> Challenge simulator (basic)</li>
              </ul>
            </div>
            
            <div className="p-6 bg-purple-900 text-white rounded-xl relative">
              <h3 className="text-xl font-bold">Pro</h3>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-purple-200 pb-1">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-purple-100">
                <li className="flex gap-2"><span>✓</span> All Free features</li>
                <li className="flex gap-2"><span>✓</span> AI strategy generation</li>
                <li className="flex gap-2"><span>✓</span> Backtesting engine</li>
                <li className="flex gap-2"><span>✓</span> Strategy analysis</li>
                <li className="flex gap-2"><span>✓</span> Risk scanner</li>
                <li className="flex gap-2"><span>✓</span> Prop-rule compatibility check</li>
                <li className="flex gap-2"><span>✓</span> Challenge simulator (advanced)</li>
              </ul>
            </div>
            
            <div className="p-6 bg-gray-900 text-white rounded-xl">
              <h3 className="text-xl font-bold">Quant</h3>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold">$69</span>
                <span className="text-gray-300 pb-1">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-gray-300">
                <li className="flex gap-2"><span>✓</span> All Pro features</li>
                <li className="flex gap-2"><span>✓</span> Monte Carlo simulation</li>
                <li className="flex gap-2"><span>✓</span> Walk-forward analysis</li>
                <li className="flex gap-2"><span>✓</span> Robustness testing</li>
                <li className="flex gap-2"><span>✓</span> Regime analysis</li>
                <li className="flex gap-2"><span>✓</span> Advanced quant analytics</li>
                <li className="flex gap-2"><span>✓</span> EA/MT5 research tools</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to Start Your Evaluation?
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of traders proving their skills with WorkFusion. 
            Transparent rules, fair evaluations, and a path to professional capital.
          </p>
          <Link 
            href="/prop-firm"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-8 rounded-lg text-lg transition-colors"
          >
            View All Challenges
          </Link>
        </div>
      </section>
    </main>
  );
}
