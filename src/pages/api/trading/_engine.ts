export type TradingPayload = {
  idea?: string;
  market?: string;
  preset?: string;
  platform?: string;
  propMode?: boolean;
  currentRisk?: number;
  currentCompliance?: number;
  code?: string;
  errors?: string;
  content?: string;
  filename?: string;
};

export function normalizePlatform(value: unknown) {
  const text = String(value || "mt5").toLowerCase();
  if (text.includes("mt4") || text === "mq4") return "mt4";
  return "mt5";
}

export function scoreIdea(payload: TradingPayload) {
  const idea = String(payload.idea || payload.content || "").toLowerCase();
  let riskScore = 62;
  let compliance = 58;

  if (payload.propMode) {
    riskScore += 12;
    compliance += 16;
  }
  if (idea.includes("0.5%") || idea.includes("0.5")) {
    riskScore += 10;
    compliance += 8;
  } else if (idea.includes("1%") || idea.includes("1.0")) {
    riskScore += 5;
    compliance += 4;
  }
  if (idea.includes("stop") || idea.includes("sl") || idea.includes("fixed")) riskScore += 8;
  if (idea.includes("1:2") || idea.includes("2rr") || idea.includes("rr")) riskScore += 6;
  if (idea.includes("martingale") || idea.includes("grid")) {
    riskScore -= idea.includes("no martingale") ? 0 : 22;
    compliance -= idea.includes("no martingale") ? 0 : 18;
  }
  if (idea.includes("news")) compliance += 4;
  if (idea.includes("session") || idea.includes("london") || idea.includes("new york")) compliance += 5;

  riskScore = clamp(riskScore, 1, 98);
  compliance = clamp(compliance, 1, 98);
  const fundingReadiness = clamp(Math.round((riskScore + compliance) / 2), 1, 98);
  return { riskScore, compliance, fundingReadiness };
}

export function buildSummary(payload: TradingPayload) {
  const market = payload.market || "selected market";
  const preset = String(payload.preset || "100k").toUpperCase();
  const mode = payload.propMode ? "prop-firm protected" : "standard";
  return `Generated ${mode} EA plan for ${market} using ${preset} challenge assumptions.`;
}

export function buildRecommendation(payload: TradingPayload, score: { riskScore: number; compliance: number }) {
  if (score.riskScore < 65 || score.compliance < 65) {
    return "Tighten fixed stop-loss rules, reduce risk per trade, and add a session/spread filter before live testing.";
  }
  if (score.compliance >= 85) {
    return "Ready for demo compilation and walk-forward testing. Keep risk capped and verify broker spread behavior.";
  }
  return "Good draft. Improve it with explicit news handling, max trades per day, and daily loss lockout.";
}

export function generateMql(payload: TradingPayload, score: { riskScore: number; compliance: number }) {
  const platform = normalizePlatform(payload.platform);
  const idea = sanitizeForComment(payload.idea || "Moving average trend-following entry with fixed risk controls.");
  if (platform === "mt4") return generateMq4(payload, score, idea);
  return generateMq5(payload, score, idea);
}

function generateMq5(payload: TradingPayload, score: { riskScore: number; compliance: number }, idea: string) {
  return `// Workfusion Trading AI generated mq5 EA
// Strategy idea: ${idea}
// Review, compile, and forward-test before live use.
// Risk score: ${score.riskScore}/100 | Prop compliance: ${score.compliance}/100
// No martingale or grid logic is included.

#property strict
#property version   "1.00"
#property description "Workfusion compile-ready MT5 EA with prop-firm risk gates."

#include <Trade/Trade.mqh>

input double RiskPerTradePct = ${payload.propMode ? "0.50" : "1.00"};
input int StopLossPoints = 300;
input int TakeProfitPoints = 600;
input int MaxTradesPerDay = 3;
input double MaxDailyLossPct = ${payload.propMode ? "1.50" : "3.00"};
input int MaxSpreadPoints = 45;
input int MaxSlippagePoints = 20;
input int FastMAPeriod = 20;
input int SlowMAPeriod = 50;
input bool AllowBuy = true;
input bool AllowSell = true;
input bool UseSessionFilter = true;
input int SessionStartHour = 7;
input int SessionEndHour = 20;
input ulong MagicNumber = 20260519;
input ENUM_MA_METHOD MovingAverageMethod = MODE_EMA;
input ENUM_APPLIED_PRICE AppliedPrice = PRICE_CLOSE;

CTrade trade;
int fastMaHandle = INVALID_HANDLE;
int slowMaHandle = INVALID_HANDLE;
int dailyKey = 0;
double dailyStartEquity = 0.0;
int tradesToday = 0;
datetime lastBarTime = 0;

int OnInit()
{
   if(FastMAPeriod <= 1 || SlowMAPeriod <= FastMAPeriod)
   {
      Print("Invalid MA periods. SlowMAPeriod must be greater than FastMAPeriod.");
      return(INIT_PARAMETERS_INCORRECT);
   }

   fastMaHandle = iMA(_Symbol, PERIOD_CURRENT, FastMAPeriod, 0, MovingAverageMethod, AppliedPrice);
   slowMaHandle = iMA(_Symbol, PERIOD_CURRENT, SlowMAPeriod, 0, MovingAverageMethod, AppliedPrice);

   if(fastMaHandle == INVALID_HANDLE || slowMaHandle == INVALID_HANDLE)
   {
      Print("Failed to create moving-average handles.");
      return(INIT_FAILED);
   }

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(MaxSlippagePoints);
   ResetDailyStateIfNeeded();
   Print("Workfusion EA loaded on ", _Symbol, " / ", EnumToString((ENUM_TIMEFRAMES)Period()));
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(fastMaHandle != INVALID_HANDLE) IndicatorRelease(fastMaHandle);
   if(slowMaHandle != INVALID_HANDLE) IndicatorRelease(slowMaHandle);
}

void OnTick()
{
   ResetDailyStateIfNeeded();
   if(!HasNewBar()) return;
   if(!RiskGatePasses()) return;
   if(OpenPositionCount() > 0) return;

   double fastMa[3];
   double slowMa[3];
   ArraySetAsSeries(fastMa, true);
   ArraySetAsSeries(slowMa, true);

   if(CopyBuffer(fastMaHandle, 0, 0, 3, fastMa) < 3) return;
   if(CopyBuffer(slowMaHandle, 0, 0, 3, slowMa) < 3) return;

   bool buySignal = AllowBuy && fastMa[1] <= slowMa[1] && fastMa[0] > slowMa[0];
   bool sellSignal = AllowSell && fastMa[1] >= slowMa[1] && fastMa[0] < slowMa[0];

   if(buySignal) EnterBuy();
   else if(sellSignal) EnterSell();
}

bool RiskGatePasses()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("Terminal trading is disabled.");
      return(false);
   }
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("EA trading permission is disabled.");
      return(false);
   }
   if(SpreadPoints() > MaxSpreadPoints)
   {
      Print("Spread gate blocked trade. Spread points: ", DoubleToString(SpreadPoints(), 1));
      return(false);
   }
   if(!SessionAllowed())
   {
      Print("Session gate blocked trade.");
      return(false);
   }
   if(tradesToday >= MaxTradesPerDay)
   {
      Print("MaxTradesPerDay gate blocked trade.");
      return(false);
   }
   if(DailyLossPct() >= MaxDailyLossPct)
   {
      Print("Daily loss gate blocked trade. Loss pct: ", DoubleToString(DailyLossPct(), 2));
      return(false);
   }
   return(true);
}

void ResetDailyStateIfNeeded()
{
   MqlDateTime now;
   TimeToStruct(TimeCurrent(), now);
   int currentKey = now.year * 10000 + now.mon * 100 + now.day;
   if(currentKey != dailyKey)
   {
      dailyKey = currentKey;
      dailyStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      tradesToday = 0;
   }
}

bool HasNewBar()
{
   datetime currentBar = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(currentBar <= 0) return(false);
   if(currentBar == lastBarTime) return(false);
   lastBarTime = currentBar;
   return(true);
}

double SpreadPoints()
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(ask <= 0.0 || bid <= 0.0) return(999999.0);
   return((ask - bid) / _Point);
}

int MinimumStopDistancePoints()
{
   int stopLevel = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   int freezeLevel = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   int spreadLevel = (int)MathCeil(SpreadPoints());
   int minimum = stopLevel;
   if(freezeLevel > minimum) minimum = freezeLevel;
   if(spreadLevel > minimum) minimum = spreadLevel;
   if(minimum < 1) minimum = 1;
   return(minimum + 2);
}

bool ValidateBuyStops(const double bid, const double ask, const double stopLoss, const double takeProfit)
{
   int minimum = MinimumStopDistancePoints();
   double stopDistance = (bid - stopLoss) / _Point;
   double targetDistance = (takeProfit - ask) / _Point;
   if(stopDistance < minimum || targetDistance < minimum)
   {
      Print("Invalid buy stops blocked before send. Bid: ", DoubleToString(bid, _Digits),
            " Ask: ", DoubleToString(ask, _Digits),
            " SpreadPoints: ", DoubleToString(SpreadPoints(), 1),
            " MinDistancePoints: ", minimum,
            " SL: ", DoubleToString(stopLoss, _Digits),
            " TP: ", DoubleToString(takeProfit, _Digits),
            " StopDistance: ", DoubleToString(stopDistance, 1),
            " TargetDistance: ", DoubleToString(targetDistance, 1));
      return(false);
   }
   return(true);
}

bool ValidateSellStops(const double bid, const double ask, const double stopLoss, const double takeProfit)
{
   int minimum = MinimumStopDistancePoints();
   double stopDistance = (stopLoss - ask) / _Point;
   double targetDistance = (bid - takeProfit) / _Point;
   if(stopDistance < minimum || targetDistance < minimum)
   {
      Print("Invalid sell stops blocked before send. Bid: ", DoubleToString(bid, _Digits),
            " Ask: ", DoubleToString(ask, _Digits),
            " SpreadPoints: ", DoubleToString(SpreadPoints(), 1),
            " MinDistancePoints: ", minimum,
            " SL: ", DoubleToString(stopLoss, _Digits),
            " TP: ", DoubleToString(takeProfit, _Digits),
            " StopDistance: ", DoubleToString(stopDistance, 1),
            " TargetDistance: ", DoubleToString(targetDistance, 1));
      return(false);
   }
   return(true);
}

bool SessionAllowed()
{
   if(!UseSessionFilter) return(true);

   int startHour = SessionStartHour;
   int endHour = SessionEndHour;
   if(startHour < 0) startHour = 0;
   if(startHour > 23) startHour = 23;
   if(endHour < 0) endHour = 0;
   if(endHour > 23) endHour = 23;
   if(startHour == endHour) return(true);

   MqlDateTime now;
   TimeToStruct(TimeCurrent(), now);
   if(startHour < endHour) return(now.hour >= startHour && now.hour < endHour);
   return(now.hour >= startHour || now.hour < endHour);
}

double DailyLossPct()
{
   if(dailyStartEquity <= 0.0) return(0.0);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double loss = dailyStartEquity - equity;
   if(loss <= 0.0) return(0.0);
   return((loss / dailyStartEquity) * 100.0);
}

int OpenPositionCount()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol && (ulong)PositionGetInteger(POSITION_MAGIC) == MagicNumber)
      {
         count++;
      }
   }
   return(count);
}

double CalculateLotSize(const int stopLossPoints)
{
   int safeStop = stopLossPoints;
   if(safeStop < 1) safeStop = 1;

   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskMoney = equity * RiskPerTradePct / 100.0;
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);

   if(riskMoney <= 0.0 || tickValue <= 0.0 || tickSize <= 0.0) return(NormalizeVolume(minLot));

   double pointValuePerLot = tickValue * (_Point / tickSize);
   double riskPerLot = safeStop * pointValuePerLot;
   if(riskPerLot <= 0.0) return(NormalizeVolume(minLot));

   return(NormalizeVolume(riskMoney / riskPerLot));
}

double NormalizeVolume(double lots)
{
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(minLot <= 0.0) minLot = 0.01;
   if(maxLot <= 0.0) maxLot = minLot;
   if(lotStep <= 0.0) lotStep = minLot;

   if(lots < minLot) lots = minLot;
   if(lots > maxLot) lots = maxLot;

   lots = MathFloor(lots / lotStep) * lotStep;
   if(lots < minLot) lots = minLot;

   return(NormalizeDouble(lots, VolumeDigits(lotStep)));
}

int VolumeDigits(double lotStep)
{
   int digits = 0;
   double step = lotStep;
   while(step > 0.0 && step < 1.0 && digits < 8)
   {
      step *= 10.0;
      digits++;
   }
   return(digits);
}

bool EnterBuy()
{
   int safeStop = StopLossPoints;
   int safeTarget = TakeProfitPoints;
   int minimumStop = MinimumStopDistancePoints();
   if(safeStop < minimumStop) safeStop = minimumStop;
   if(safeTarget < minimumStop) safeTarget = minimumStop;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(ask <= 0.0 || bid <= 0.0) return(false);

   double stopLoss = NormalizeDouble(bid - safeStop * _Point, _Digits);
   double takeProfit = NormalizeDouble(ask + safeTarget * _Point, _Digits);
   if(!ValidateBuyStops(bid, ask, stopLoss, takeProfit)) return(false);

   int riskStopPoints = (int)MathCeil((ask - stopLoss) / _Point);
   double lots = CalculateLotSize(riskStopPoints);

   bool sent = trade.Buy(lots, _Symbol, ask, stopLoss, takeProfit, "Workfusion EA buy");
   if(sent)
   {
      tradesToday++;
      Print("Buy opened. Lots: ", DoubleToString(lots, 2));
   }
   else
   {
      Print("Buy failed. Retcode: ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription(),
            " Bid: ", DoubleToString(bid, _Digits),
            " Ask: ", DoubleToString(ask, _Digits),
            " SpreadPoints: ", DoubleToString(SpreadPoints(), 1),
            " MinDistancePoints: ", minimumStop,
            " SL: ", DoubleToString(stopLoss, _Digits),
            " TP: ", DoubleToString(takeProfit, _Digits));
   }
   return(sent);
}

bool EnterSell()
{
   int safeStop = StopLossPoints;
   int safeTarget = TakeProfitPoints;
   int minimumStop = MinimumStopDistancePoints();
   if(safeStop < minimumStop) safeStop = minimumStop;
   if(safeTarget < minimumStop) safeTarget = minimumStop;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(bid <= 0.0 || ask <= 0.0) return(false);

   double stopLoss = NormalizeDouble(ask + safeStop * _Point, _Digits);
   double takeProfit = NormalizeDouble(bid - safeTarget * _Point, _Digits);
   if(!ValidateSellStops(bid, ask, stopLoss, takeProfit)) return(false);

   int riskStopPoints = (int)MathCeil((stopLoss - bid) / _Point);
   double lots = CalculateLotSize(riskStopPoints);

   bool sent = trade.Sell(lots, _Symbol, bid, stopLoss, takeProfit, "Workfusion EA sell");
   if(sent)
   {
      tradesToday++;
      Print("Sell opened. Lots: ", DoubleToString(lots, 2));
   }
   else
   {
      Print("Sell failed. Retcode: ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription(),
            " Bid: ", DoubleToString(bid, _Digits),
            " Ask: ", DoubleToString(ask, _Digits),
            " SpreadPoints: ", DoubleToString(SpreadPoints(), 1),
            " MinDistancePoints: ", minimumStop,
            " SL: ", DoubleToString(stopLoss, _Digits),
            " TP: ", DoubleToString(takeProfit, _Digits));
   }
   return(sent);
}
`;
}

function generateMq4(payload: TradingPayload, score: { riskScore: number; compliance: number }, idea: string) {
  return `// Workfusion Trading AI generated mq4 EA
// Strategy idea: ${idea}
// Review, compile, and forward-test before live use.
// Risk score: ${score.riskScore}/100 | Prop compliance: ${score.compliance}/100
// No martingale or grid logic is included.

#property strict

input double RiskPerTradePct = ${payload.propMode ? "0.50" : "1.00"};
input int StopLossPoints = 300;
input int TakeProfitPoints = 600;
input int MaxTradesPerDay = 3;
input double MaxDailyLossPct = ${payload.propMode ? "1.50" : "3.00"};
input int MaxSpreadPoints = 45;
input int MaxSlippagePoints = 20;
input int FastMAPeriod = 20;
input int SlowMAPeriod = 50;
input bool AllowBuy = true;
input bool AllowSell = true;
input bool UseSessionFilter = true;
input int SessionStartHour = 7;
input int SessionEndHour = 20;
input int MagicNumber = 20260519;

int dailyKey = 0;
double dailyStartEquity = 0.0;
int tradesToday = 0;
datetime lastBarTime = 0;

int OnInit()
{
   if(FastMAPeriod <= 1 || SlowMAPeriod <= FastMAPeriod)
   {
      Print("Invalid MA periods. SlowMAPeriod must be greater than FastMAPeriod.");
      return(INIT_PARAMETERS_INCORRECT);
   }
   ResetDailyStateIfNeeded();
   Print("Workfusion EA loaded on ", Symbol(), " / period ", Period());
   return(INIT_SUCCEEDED);
}

void OnTick()
{
   ResetDailyStateIfNeeded();
   if(!HasNewBar()) return;
   if(!RiskGatePasses()) return;
   if(OpenPositionCount() > 0) return;

   double fast0 = iMA(NULL, 0, FastMAPeriod, 0, MODE_EMA, PRICE_CLOSE, 0);
   double fast1 = iMA(NULL, 0, FastMAPeriod, 0, MODE_EMA, PRICE_CLOSE, 1);
   double slow0 = iMA(NULL, 0, SlowMAPeriod, 0, MODE_EMA, PRICE_CLOSE, 0);
   double slow1 = iMA(NULL, 0, SlowMAPeriod, 0, MODE_EMA, PRICE_CLOSE, 1);

   bool buySignal = AllowBuy && fast1 <= slow1 && fast0 > slow0;
   bool sellSignal = AllowSell && fast1 >= slow1 && fast0 < slow0;

   if(buySignal) EnterBuy();
   else if(sellSignal) EnterSell();
}

bool RiskGatePasses()
{
   if(!IsTradeAllowed())
   {
      Print("Trading is disabled.");
      return(false);
   }
   if(SpreadPoints() > MaxSpreadPoints)
   {
      Print("Spread gate blocked trade. Spread points: ", DoubleToString(SpreadPoints(), 1));
      return(false);
   }
   if(!SessionAllowed())
   {
      Print("Session gate blocked trade.");
      return(false);
   }
   if(tradesToday >= MaxTradesPerDay)
   {
      Print("MaxTradesPerDay gate blocked trade.");
      return(false);
   }
   if(DailyLossPct() >= MaxDailyLossPct)
   {
      Print("Daily loss gate blocked trade. Loss pct: ", DoubleToString(DailyLossPct(), 2));
      return(false);
   }
   return(true);
}

void ResetDailyStateIfNeeded()
{
   int currentKey = CurrentDayKey();
   if(currentKey != dailyKey)
   {
      dailyKey = currentKey;
      dailyStartEquity = AccountEquity();
      tradesToday = 0;
   }
}

int CurrentDayKey()
{
   datetime now = TimeCurrent();
   return(TimeYear(now) * 10000 + TimeMonth(now) * 100 + TimeDay(now));
}

bool HasNewBar()
{
   datetime currentBar = iTime(Symbol(), Period(), 0);
   if(currentBar <= 0) return(false);
   if(currentBar == lastBarTime) return(false);
   lastBarTime = currentBar;
   return(true);
}

double SpreadPoints()
{
   RefreshRates();
   return((Ask - Bid) / Point);
}

bool SessionAllowed()
{
   if(!UseSessionFilter) return(true);

   int startHour = SessionStartHour;
   int endHour = SessionEndHour;
   if(startHour < 0) startHour = 0;
   if(startHour > 23) startHour = 23;
   if(endHour < 0) endHour = 0;
   if(endHour > 23) endHour = 23;
   if(startHour == endHour) return(true);

   int hour = TimeHour(TimeCurrent());
   if(startHour < endHour) return(hour >= startHour && hour < endHour);
   return(hour >= startHour || hour < endHour);
}

double DailyLossPct()
{
   if(dailyStartEquity <= 0.0) return(0.0);
   double loss = dailyStartEquity - AccountEquity();
   if(loss <= 0.0) return(0.0);
   return((loss / dailyStartEquity) * 100.0);
}

int OpenPositionCount()
{
   int count = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderSymbol() == Symbol() && OrderMagicNumber() == MagicNumber) count++;
   }
   return(count);
}

double CalculateLotSize(const int stopLossPoints)
{
   int safeStop = stopLossPoints;
   if(safeStop < 1) safeStop = 1;

   double minLot = MarketInfo(Symbol(), MODE_MINLOT);
   double riskMoney = AccountEquity() * RiskPerTradePct / 100.0;
   double tickValue = MarketInfo(Symbol(), MODE_TICKVALUE);
   double tickSize = MarketInfo(Symbol(), MODE_TICKSIZE);

   if(riskMoney <= 0.0 || tickValue <= 0.0 || tickSize <= 0.0) return(NormalizeVolume(minLot));

   double pointValuePerLot = tickValue * (Point / tickSize);
   double riskPerLot = safeStop * pointValuePerLot;
   if(riskPerLot <= 0.0) return(NormalizeVolume(minLot));

   return(NormalizeVolume(riskMoney / riskPerLot));
}

double NormalizeVolume(double lots)
{
   double minLot = MarketInfo(Symbol(), MODE_MINLOT);
   double maxLot = MarketInfo(Symbol(), MODE_MAXLOT);
   double lotStep = MarketInfo(Symbol(), MODE_LOTSTEP);

   if(minLot <= 0.0) minLot = 0.01;
   if(maxLot <= 0.0) maxLot = minLot;
   if(lotStep <= 0.0) lotStep = minLot;

   if(lots < minLot) lots = minLot;
   if(lots > maxLot) lots = maxLot;

   lots = MathFloor(lots / lotStep) * lotStep;
   if(lots < minLot) lots = minLot;

   return(NormalizeDouble(lots, VolumeDigits(lotStep)));
}

int VolumeDigits(double lotStep)
{
   int digits = 0;
   double step = lotStep;
   while(step > 0.0 && step < 1.0 && digits < 8)
   {
      step *= 10.0;
      digits++;
   }
   return(digits);
}

bool EnterBuy()
{
   int safeStop = StopLossPoints;
   if(safeStop < 1) safeStop = 1;
   int safeTarget = TakeProfitPoints;
   if(safeTarget < 1) safeTarget = 1;

   RefreshRates();
   double lots = CalculateLotSize(safeStop);
   double stopLoss = NormalizeDouble(Ask - safeStop * Point, Digits);
   double takeProfit = NormalizeDouble(Ask + safeTarget * Point, Digits);
   int ticket = OrderSend(Symbol(), OP_BUY, lots, Ask, MaxSlippagePoints, stopLoss, takeProfit, "Workfusion EA buy", MagicNumber, 0, clrGreen);
   if(ticket > 0)
   {
      tradesToday++;
      Print("Buy opened. Ticket: ", ticket, " Lots: ", DoubleToString(lots, 2));
      return(true);
   }
   Print("Buy failed. Error: ", GetLastError());
   return(false);
}

bool EnterSell()
{
   int safeStop = StopLossPoints;
   if(safeStop < 1) safeStop = 1;
   int safeTarget = TakeProfitPoints;
   if(safeTarget < 1) safeTarget = 1;

   RefreshRates();
   double lots = CalculateLotSize(safeStop);
   double stopLoss = NormalizeDouble(Bid + safeStop * Point, Digits);
   double takeProfit = NormalizeDouble(Bid - safeTarget * Point, Digits);
   int ticket = OrderSend(Symbol(), OP_SELL, lots, Bid, MaxSlippagePoints, stopLoss, takeProfit, "Workfusion EA sell", MagicNumber, 0, clrRed);
   if(ticket > 0)
   {
      tradesToday++;
      Print("Sell opened. Ticket: ", ticket, " Lots: ", DoubleToString(lots, 2));
      return(true);
   }
   Print("Sell failed. Error: ", GetLastError());
   return(false);
}
`;
}

export function fixedMql(payload: TradingPayload) {
  const source = String(payload.code || "");
  const errorText = String(payload.errors || "No compiler errors provided.");
  const debugPayload: TradingPayload = {
    ...payload,
    idea: `Compiler repair fallback. Original code length ${source.length}. Compiler notes: ${errorText}`,
    platform: normalizePlatform(payload.platform),
    propMode: payload.propMode ?? true,
  };
  return generateMql(debugPayload, scoreIdea(debugPayload));
}

export function debrief(payload: TradingPayload) {
  const text = String(payload.content || payload.idea || "").toLowerCase();
  const issues = [
    text.includes("martingale") ? "Martingale/grid language increases tail risk" : "Risk model needs explicit daily stop logic",
    text.includes("spread") ? "Spread handled, but should be tested per session" : "No explicit spread filter found",
    text.includes("news") ? "News rule mentioned, needs exact blackout window" : "No news or event-risk guard found",
  ];
  const fixes = [
    "Add max spread, max trades per day, and daily loss lockout inputs",
    "Run demo forward test before funded account use",
    "Compare PF and drawdown across at least three market regimes",
  ];
  return { issues, fixes };
}

export function optimize(payload: TradingPayload) {
  const baseRisk = Number(payload.currentRisk || 70);
  const baseCompliance = Number(payload.currentCompliance || 72);
  return {
    riskScore: clamp(baseRisk + 8, 1, 98),
    compliance: clamp(baseCompliance + 12, 1, 98),
    fundingReadiness: clamp(Math.round((baseRisk + baseCompliance) / 2) + 10, 1, 98),
    params: {
      lotSizing: payload.propMode ? "0.50% fixed fractional" : "1.00% fixed fractional",
      stopLossPoints: "300",
      takeProfitPoints: "600",
      sessionFilter: "London/New York only",
      spreadFilter: "45 points max",
      dailyLockout: payload.propMode ? "1.50% max daily loss" : "manual",
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeForComment(value: string) {
  return value.replace(/\*\//g, "").replace(/\n/g, " ").trim();
}
