"use client";
import { FundedAccount, ScalingLevel } from "@/lib/workfusion/prop-firm/types";
interface FundedAccountCardProps { account: FundedAccount; scalingPlan?: ScalingLevel[]; }
export function FundedAccountCard({ account, scalingPlan }: FundedAccountCardProps) { return <div className="p-4 bg-white rounded-xl border"><h3 className="font-semibold text-gray-900 mb-4">Funded Account: ${account.allocatedCapital.toLocaleString()}</h3><p className="text-gray-600">Component implementation in progress</p></div>; }
