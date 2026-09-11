"use client";
import { ChallengeAccount, ChallengeConfiguration, ChallengeAccountStatus } from "@/lib/workfusion/prop-firm/types";
interface ChallengeProgressProps { account: ChallengeAccount; config: ChallengeConfiguration; }
export function ChallengeProgress({ account, config }: ChallengeProgressProps) { return <div className="p-4 bg-white rounded-xl border"><h3 className="font-semibold text-gray-900 mb-4">{config.name} Challenge</h3><p className="text-gray-600">Progress component - implementation in progress</p></div>; }
