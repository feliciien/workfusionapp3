"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  phaseCount: number;
  scalingEnabled: boolean;
  profitSplitTraderPct: number;
  profitSplitFirmPct: number;
}

export default function PropFirmPage() {
  const [challenges, setChallenges] = useState<ChallengeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeConfig | null>(null);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const response = await fetch("/api/prop-firm/challenges");
      if (!response.ok) throw new Error("Failed to fetch challenges");
      const data = await response.json();
      setChallenges(data.challenges || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "STARTER": return "bg-blue-100 text-blue-800";
      case "STANDARD": return "bg-green-100 text-green-800";
      case "PRO": return "bg-purple-100 text-purple-800";
      case "ADVANCED": return "bg-orange-100 text-orange-800";
      case "ELITE": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <Button onClick={fetchChallenges} className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Prop Firm <span className="text-yellow-300">Challenges</span>
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Prove your trading skills, get funded, and scale to $500K+. 
              Transparent rules, instant MT5 integration, and AI-powered risk analytics.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/prop-firm/dashboard"
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-8 rounded-lg text-lg transition-colors"
              >
                Start Your Challenge
              </Link>
              <Link 
                href="/prop-firm/how-it-works"
                className="bg-transparent border-2 border-blue-300 hover:bg-blue-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors"
              >
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">5</div>
              <div className="text-sm text-gray-600 mt-1">Challenge Tiers</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">$10K–$200K</div>
              <div className="text-sm text-gray-600 mt-1">Account Sizes</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">80-90%</div>
              <div className="text-sm text-gray-600 mt-1">Profit Split</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">$500K+</div>
              <div className="text-sm text-gray-600 mt-1">Max Scaling</div>
            </div>
          </div>
        </div>
      </section>

      {/* Challenge Cards */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Challenge
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Select the challenge that matches your experience level and capital goals.
              All challenges include MT5 integration, real-time risk monitoring, and AI analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {challenges.map((challenge) => (
              <div 
                key={challenge.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow relative"
              >
                <div className="mb-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getTierColor(challenge.tier)}`}>
                    {challenge.tier}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {challenge.phaseCount}-Phase Evaluation
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">{challenge.name}</h3>
                <p className="text-gray-600 mb-4">{challenge.description}</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Account Size</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(challenge.accountSize)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Challenge Fee</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(challenge.price)}</span>
                  </div>
                  {challenge.resetPrice && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Reset Fee</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(challenge.resetPrice)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Profit Target</span>
                    <span className="font-semibold text-gray-900">{challenge.profitTargetPct}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Max Daily Loss</span>
                    <span className="font-semibold text-gray-900">{challenge.maxDailyLossPct}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Max Total Drawdown</span>
                    <span className="font-semibold text-gray-900">{challenge.maxTotalLossPct}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Min Trading Days</span>
                    <span className="font-semibold text-gray-900">{challenge.minTradingDays}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Profit Split</span>
                    <span className="font-semibold text-gray-900">
                      {challenge.profitSplitTraderPct}% / {challenge.profitSplitFirmPct}%
                    </span>
                  </div>
                  {challenge.scalingEnabled && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Scaling Available</span>
                      <span className="font-semibold">Up to $500K+</span>
                    </div>
                  )}
                </div>
                
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                  onClick={() => setSelectedChallenge(challenge)}
                >
                  Purchase Challenge
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Choose WorkFusion?
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🛡️"
              title="Real-Time Risk Engine"
              description="NORMAL → WARNING → AT_RISK → BREACHED state machine with deterministic, auditable calculations."
            />
            <FeatureCard
              icon="🤖"
              title="AI Trading Lab"
              description="Generate strategies, backtest, analyze risk, and optimize for prop firm rules with AI assistance."
            />
            <FeatureCard
              icon="📊"
              title="Quantitative Talent Pipeline"
              description="Top performers enter our talent pool for potential recruitment by BoltIQ Capital quant team."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to Get Funded?
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of traders proving their skills with WorkFusion. 
            Transparent rules, fair evaluations, and a path to professional capital.
          </p>
          <Link 
            href="/prop-firm/dashboard"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-8 rounded-lg text-lg transition-colors"
          >
            Start Your Challenge Today
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="text-center p-6 bg-gray-50 rounded-xl">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
