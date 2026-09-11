"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <>
      {/* Hero Section */} 
      <section className="relative bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Trade. Prove your edge. Get funded.
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto">
              WorkFusion is an AI-powered trading evaluation platform built to identify disciplined traders, fund proven performance, and develop the next generation of quantitative trading talent.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/prop-firm"
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-8 rounded-lg text-lg transition-colors"
              >
                Start a Challenge
              </Link>
              <Link 
                href="/prop-firm/how-it-works"
                className="bg-transparent border-2 border-blue-300 hover:bg-blue-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors"
              >
                Explore How It Works
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
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">$10K-$200K</div>
              <div className="text-sm text-gray-600 mt-1">Account Sizes</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">80/20</div>
              <div className="text-sm text-gray-600 mt-1">Profit Split</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">AI-Powered</div>
              <div className="text-sm text-gray-600 mt-1">Talent Discovery</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How WorkFusion Works
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our prop-firm model evaluates traders through structured challenges, funds proven performers, and identifies elite talent for quantitative opportunities.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            <div className="text-center p-6 bg-white rounded-xl shadow">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Challenge</h3>
              <p className="text-gray-600">Purchase an evaluation, prove your skills in a simulated environment</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl shadow">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Evaluation</h3>
              <p className="text-gray-600">Real-time risk monitoring, rule enforcement, performance tracking</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl shadow">
              <div className="text-5xl mb-4">🏦</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Funded</h3>
              <p className="text-gray-600">Earn profit shares, withdraw earnings, scale your capital</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl shadow">
              <div className="text-5xl mb-4">📈</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Scale</h3>
              <p className="text-gray-600">Grow your account based on consistent performance</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl shadow">
              <div className="text-5xl mb-4">⭐</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Elite Trader</h3>
              <p className="text-gray-600">Top performers recognized for exceptional skill and discipline</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl shadow">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Quant Talent</h3>
              <p className="text-gray-600">Elite traders considered for BoltIQ Capital opportunities</p>
            </div>
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
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Risk-First Approach</h3>
              <p className="text-gray-600">
                Our NORMAL → WARNING → AT_RISK → BREACHED system protects both traders and capital.
                No hidden rules, no surprise violations.
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI Trading Lab</h3>
              <p className="text-gray-600">
                Generate, backtest, and validate strategies before risking your evaluation.
                Build with confidence, trade with discipline.
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="text-4xl mb-4">🔬</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Talent Discovery</h3>
              <p className="text-gray-600">
                Our Quantitative Talent Score identifies exceptional performers for 
                consideration in BoltIQ Capital's quantitative research programs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to Prove Your Trading Skills?
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Join traders worldwide using WorkFusion to validate their edge, earn funding, 
            and develop their quantitative trading careers.
          </p>
          <Link 
            href="/prop-firm"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-8 rounded-lg text-lg transition-colors"
          >
            Start Your Challenge Today
          </Link>
        </div>
      </section>
    </>
  );
}
