"use client";
interface PnLChartProps { data: Array<{ date: string; equity: number; balance: number }>; className?: string; height?: number; }
export function PnLChart({ data, className, height }: PnLChartProps) { return <div className="p-4 bg-white rounded-xl border"><h3 className="font-semibold text-gray-900 mb-4">PnL Chart</h3><p className="text-gray-600">Chart component - implementation in progress</p></div>; }
