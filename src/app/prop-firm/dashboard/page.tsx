"use client";
export default function PropFirmDashboard() {
  return (<div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="p-8 bg-white rounded-xl shadow-lg max-w-4xl w-full">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Trader Dashboard</h1>
      <p className="text-gray-600 mb-4">Welcome to your WorkFusion trading dashboard</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-6 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-4">Account Overview</h3>
          <p className="text-sm text-gray-500">Challenge Account: $25,000</p>
          <p className="text-sm text-gray-500">Current Equity: $27,200</p>
          <p className="text-sm text-gray-500">P/L: +$2,200 (+8.8%)</p>
        </div>
        <div className="bg-green-50 p-6 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-4">Risk Status</h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🟢</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">NORMAL</p>
              <p className="text-sm text-gray-500">Healthy risk levels</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-4">Performance</h3>
          <p className="text-sm text-gray-500">Win Rate: 68%</p>
          <p className="text-sm text-gray-500">Profit Factor: 1.42</p>
          <p className="text-sm text-gray-500">Sharpe Ratio: 1.24</p>
        </div>
      </div>
      <div className="mt-8">
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
          View Full Dashboard
        </button>
      </div>
    </div>
  </div>
);
}
