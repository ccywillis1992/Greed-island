import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  DollarSign, 
  Calendar, 
  History, 
  ShoppingBag, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  Scale 
} from "lucide-react";

export interface CashRecord {
  id: string;
  type: "IN" | "OUT";
  amount: number;
  broker: "FUTU" | "IB" | "HSBC" | "BINANCE";
  date: string;
  note: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  broker: "FUTU" | "IB" | "HSBC" | "BINANCE";
  quantity: number;
  price: number;
  amount: number;
  realizedPnL: number; // For BUY this is normally 0, for SELL it is compiled realized G/L
  timestamp: string;
  note: string;
}

interface PortfolioItem {
  symbol: string;
  qty: number;
  cost: number;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number;
  broker: string;
}

interface TradeHistoryViewProps {
  portfolioData: PortfolioItem[];
  cashRecords: CashRecord[];
  setCashRecords: React.Dispatch<React.SetStateAction<CashRecord[]>>;
  tradeRecords: TradeRecord[];
  setTradeRecords: React.Dispatch<React.SetStateAction<TradeRecord[]>>;
}

export default function TradeHistoryView({ 
  portfolioData, 
  cashRecords, 
  setCashRecords,
  tradeRecords,
  setTradeRecords
}: TradeHistoryViewProps) {
  // Form states
  const [symbol, setSymbol] = useState<string>("NVDA");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [broker, setBroker] = useState<"FUTU" | "IB" | "HSBC" | "BINANCE">("FUTU");
  const [quantity, setQuantity] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [timestamp, setTimestamp] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [note, setNote] = useState<string>("");
  const [customPnL, setCustomPnL] = useState<string>("");
  const [isPnLModified, setIsPnLModified] = useState<boolean>(false);
  const [tickerFilter, setTickerFilter] = useState<string>("");

  // Auto-calculated fields
  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(price) || 0;
  const totalAmount = qtyNum * priceNum;

  // Find portfolio cost basis for estimation
  const existingHolding = portfolioData.find(
    (h) => h.symbol.toUpperCase() === symbol.trim().toUpperCase()
  );
  
  // Suggested average cost
  const calculatedCostBasis = existingHolding ? existingHolding.cost : 0;
  const estimatedPnL = tradeType === "SELL" && calculatedCostBasis > 0
    ? (priceNum - calculatedCostBasis) * qtyNum
    : 0;

  // Sync estimate to state when type/inputs change if not manually ridden
  useEffect(() => {
    if (!isPnLModified && tradeType === "SELL") {
      setCustomPnL(estimatedPnL === 0 ? "" : estimatedPnL.toFixed(2));
    } else if (tradeType === "BUY") {
      setCustomPnL("0.00");
    }
  }, [symbol, tradeType, quantity, price, estimatedPnL, isPnLModified]);

  const handleAddTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || qtyNum <= 0 || priceNum <= 0) {
      alert("Please provide a valid asset ticker, positive quantity, and price.");
      return;
    }

    const tradeId = `trade-${Date.now()}`;
    const finalPnL = tradeType === "SELL" ? (parseFloat(customPnL) || estimatedPnL) : 0;

    const newTrade: TradeRecord = {
      id: tradeId,
      symbol: symbol.trim().toUpperCase(),
      type: tradeType,
      broker,
      quantity: qtyNum,
      price: priceNum,
      amount: totalAmount,
      realizedPnL: finalPnL,
      timestamp,
      note: note.trim() || `${tradeType} ${qtyNum} ${symbol.trim().toUpperCase()} at $${priceNum.toFixed(2)}`
    };

    // Auto-create corresponding Cash Record to add/remove cash from bank/broker
    const newCashFlow: CashRecord = {
      id: tradeId, // Share the same ID so we can cleanly delete them together!
      type: tradeType === "BUY" ? "OUT" : "IN", // BUY is spending cash (OUT), SELL is receipt (IN)
      amount: totalAmount,
      broker,
      date: timestamp,
      note: `[Trade Auto-Sync] ${tradeType} ${qtyNum} ${symbol.trim().toUpperCase()} @ $${priceNum.toFixed(2)}`
    };

    // Update state & persist
    const updatedTrades = [newTrade, ...tradeRecords];
    setTradeRecords(updatedTrades);
    localStorage.setItem("wealth_trade_records_v1", JSON.stringify(updatedTrades));

    // Update Cash Records
    const updatedCash = [newCashFlow, ...cashRecords];
    setCashRecords(updatedCash);
    localStorage.setItem("wealth_cash_records_v1", JSON.stringify(updatedCash));

    // Reset inputs but preserve broker/symbol for comfort
    setQuantity("");
    setPrice("");
    setNote("");
    setCustomPnL("");
    setIsPnLModified(false);
  };

  const handleDeleteTrade = (id: string) => {
    // Delete the trade
    const updatedTrades = tradeRecords.filter((t) => t.id !== id);
    setTradeRecords(updatedTrades);
    localStorage.setItem("wealth_trade_records_v1", JSON.stringify(updatedTrades));

    // Automatically remove the corresponding auto-synced cash flow
    const updatedCash = cashRecords.filter((c) => c.id !== id);
    setCashRecords(updatedCash);
    localStorage.setItem("wealth_cash_records_v1", JSON.stringify(updatedCash));
  };

  // Filtered list
  const filteredTrades = tradeRecords.filter((t) => {
    if (!tickerFilter) return true;
    return t.symbol.includes(tickerFilter.toUpperCase());
  });

  // Analytics Metrics
  const summaryTradesCount = filteredTrades.length;
  const totalBuyVolume = filteredTrades
    .filter((t) => t.type === "BUY")
    .reduce((acc, t) => acc + t.amount, 0);
  const totalSellVolume = filteredTrades
    .filter((t) => t.type === "SELL")
    .reduce((acc, t) => acc + t.amount, 0);
  const totalRealizedPnL = filteredTrades
    .filter((t) => t.type === "SELL")
    .reduce((acc, t) => acc + t.realizedPnL, 0);

  return (
    <div className="w-full max-w-4xl flex flex-col gap-8 z-10 transition-all duration-300">
      
      {/* SECTION 1: TRADE LEDGER STAT BANNER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Metric A: Total Orders Recorded */}
        <div className="bg-[#090909] border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-widest text-[#76b900] font-mono font-bold flex items-center gap-1.5">
            <History className="w-3.5 h-3.5"/> Executed Orders
          </span>
          <div className="mt-2">
            <p className="text-2xl font-bold font-mono text-white leading-tight">
              {summaryTradesCount}
            </p>
            <p className="text-[10px] text-white/40 font-mono mt-0.5">Logged Ledger Audits</p>
          </div>
        </div>

        {/* Metric B: Total Realized Gain / Loss */}
        <div className="bg-[#090909] border border-[#76b900]/20 p-5 rounded-2xl flex flex-col justify-between shadow-lg shadow-[#76b900]/2">
          <span className="text-[9px] uppercase tracking-widest text-white/50 font-mono font-semibold flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[#76b900]"/> Realized P&L
          </span>
          <div className="mt-2">
            <p className={`text-2xl font-bold font-mono leading-tight ${
              totalRealizedPnL >= 0 ? "text-[#76b900]" : "text-rose-500"
            }`}>
              {totalRealizedPnL >= 0 ? "+" : ""}${totalRealizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </p>
            <p className="text-[10px] text-white/40 font-mono mt-0.5">Sum of Sell Gains/Loss</p>
          </div>
        </div>

        {/* Metric C: Buy Volume (Capital Expended) */}
        <div className="bg-[#090909] border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-widest text-rose-400 font-mono flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5"/> Buy Volume
          </span>
          <div className="mt-2">
            <p className="text-2xl font-bold font-mono text-rose-400/90 leading-tight">
              ${totalBuyVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </p>
            <p className="text-[10px] text-white/40 font-mono mt-0.5">Total Assets Acquired</p>
          </div>
        </div>

        {/* Metric D: Sell Volume (Capital Proceeds) */}
        <div className="bg-[#090909] border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-widest text-cyan-400 font-mono flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5"/> Sell Volume
          </span>
          <div className="mt-2">
            <p className="text-2xl font-bold font-mono text-cyan-400/90 leading-tight">
              ${totalSellVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </p>
            <p className="text-[10px] text-white/40 font-mono mt-0.5">Total Assets Disposed</p>
          </div>
        </div>

      </div>

      {/* SECTION 2: TRANS-REGULATOR & LEDGER TABLE BLOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Hand: Trade Order Executer Form */}
        <form 
          onSubmit={handleAddTrade} 
          className="lg:col-span-5 bg-[#090909] border border-white/10 p-6 rounded-2xl sm:rounded-3xl space-y-4"
        >
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#76b900]"/>
              Log Executed Trade Order
            </h3>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider mt-0.5">
              Directly deducts or adds cash to account
            </p>
          </div>

          {/* Quick symbol selector chips */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase tracking-wider text-white/40 block">
              Quick Select Ticker
            </label>
            <div className="flex flex-wrap gap-1">
              {["NVDA", "TSLA", "AMD", "GOOGL"].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setSymbol(sym)}
                  className={`px-2 py-1 text-[9px] font-mono tracking-wider font-bold rounded transition-all cursor-pointer ${
                    symbol.toUpperCase() === sym 
                      ? "bg-[#76b900] text-black" 
                      : "bg-white/5 text-white/60 hover:text-white border border-white/5"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Symbol Ticker */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 block">Stock Symbol</label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL, MSFT etc"
                className="w-full bg-[#121212] border border-white/10 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-[#76b900] focus:outline-none focus:ring-1 focus:ring-[#76b900]"
              />
            </div>

            {/* Broker Account */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 block">Account / Broker</label>
              <select
                value={broker}
                onChange={(e) => setBroker(e.target.value as any)}
                className="w-full bg-[#121212] border border-white/10 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-[#76b900] focus:outline-none cursor-pointer"
              >
                <option value="FUTU">FUTU</option>
                <option value="IB">IB</option>
                <option value="HSBC">HSBC</option>
                <option value="BINANCE">Binance</option>
              </select>
            </div>
          </div>

          {/* Type Selector Toggle: BUY / SELL */}
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 block">Order Direction</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 select-none">
              <button
                type="button"
                onClick={() => setTradeType("BUY")}
                className={`py-2 text-[10px] font-mono tracking-wider uppercase font-bold text-center rounded-lg cursor-pointer transition-all ${
                  tradeType === "BUY"
                    ? "bg-[#76b900] text-black shadow-sm"
                    : "text-white/50 hover:text-white hover:bg-white/5 bg-transparent"
                }`}
              >
                BUY / Acquisition
              </button>
              <button
                type="button"
                onClick={() => setTradeType("SELL")}
                className={`py-2 text-[10px] font-mono tracking-wider uppercase font-bold text-center rounded-lg cursor-pointer transition-all ${
                  tradeType === "SELL"
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-white/50 hover:text-white hover:bg-white/5 bg-transparent"
                }`}
              >
                SELL / Liquidation
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 block">Quantity</label>
              <input
                type="number"
                required
                step="any"
                min="0.00001"
                placeholder="Qty (e.g. 10)"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-[#76b900] focus:outline-none focus:ring-1 focus:ring-[#76b900]"
              />
            </div>

            {/* Price */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 block">Price per Share</label>
              <input
                type="number"
                required
                step="any"
                min="0.01"
                placeholder="Price $"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-[#76b900] focus:outline-none focus:ring-1 focus:ring-[#76b900]"
              />
            </div>
          </div>

          {/* Autocalculated Cost and Auto-PNL Estimates */}
          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-white/40 text-[9px]">TOTAL AMOUNT:</span>
              <strong className="text-white text-[11px]">
                ${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </strong>
            </div>
            
            {/* Cash Impact Advice */}
            <div className="flex justify-between items-center text-[8px] border-t border-white/5 pt-2">
              <span className="text-white/30 uppercase">Cash Impact:</span>
              <span className={tradeType === "BUY" ? "text-rose-400" : "text-[#76b900]"}>
                {tradeType === "BUY" ? "-" : "+"}${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} in {broker}
              </span>
            </div>
          </div>

          {/* Realized P/L estimation/custom fields (Only meaningful for SELL orders) */}
          {tradeType === "SELL" && (
            <div className="space-y-1 bg-amber-950/10 border border-amber-500/20 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                  Realized Gain / Loss
                </label>
                {calculatedCostBasis > 0 && (
                  <span className="text-[8px] text-white/40 font-mono">
                    Holding Cost basis: ${calculatedCostBasis}/sh
                  </span>
                )}
              </div>
              
              <input
                type="number"
                step="any"
                placeholder={estimatedPnL ? `Estimated: ${estimatedPnL.toFixed(2)}` : "e.g. 150.00"}
                value={customPnL}
                onChange={(e) => {
                  setCustomPnL(e.target.value);
                  setIsPnLModified(true);
                }}
                className="w-full bg-[#121212] border border-amber-500/30 text-amber-400 font-mono text-xs px-3 py-2.5 rounded-xl focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              
              <p className="text-[7.5px] text-white/40 leading-relaxed font-mono mt-1">
                We estimate realized gain/loss based on your portfolio cost of <strong className="text-white">${calculatedCostBasis}</strong>. Override this field value if you track a custom cost basis method (FIFO, specID, etc.).
              </p>
            </div>
          )}

          {/* Date Picker */}
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 block">Trade Date</label>
            <input
              type="date"
              required
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-[#76b900] focus:outline-none cursor-pointer"
            />
          </div>

          {/* Memo / Notes */}
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 block">Memo Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. NVDA breakout, hedge trimming"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-[#76b900] focus:outline-none focus:ring-1 focus:ring-[#76b900]"
            />
          </div>

          {/* Form Action Button */}
          <button
            type="submit"
            className="w-full py-3 bg-white text-black hover:bg-[#76b900] font-mono text-[10px] uppercase tracking-wider font-extrabold transition-all duration-150 rounded-xl cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            <Plus className="w-3.5 h-3.5 text-black" />
            Append Trade Record
          </button>

        </form>

        {/* Right Hand: Interactive Order Book / History Ledger */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-md font-semibold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#76b900]"/>
                Executed Order Ledger
              </h3>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
                Full historical log of equities actions
              </p>
            </div>

            {/* Filter */}
            <input
              type="text"
              placeholder="Search Ticker..."
              value={tickerFilter}
              onChange={(e) => setTickerFilter(e.target.value)}
              className="w-full sm:w-48 bg-[#090909] border border-white/15 text-white font-mono text-[9px] px-3 py-1.5 focus:border-[#76b900] focus:outline-none tracking-wider rounded-lg"
            />
          </div>

          {/* Table list */}
          <div className="bg-[#090909] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[9px] font-mono uppercase tracking-widest text-white/50">
                    <th className="py-3 px-4">Instrument</th>
                    <th className="py-3 px-3">Broker</th>
                    <th className="py-3 px-3 text-right">Qty & Price</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-right">Realized P/L</th>
                    <th className="py-3 px-4 text-center">Date</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-white/30 font-mono text-xs">
                        No transactions cataloged matching criteria.
                        <p className="text-[9px] text-white/20 mt-1 max-w-sm mx-auto">
                          Acquire assets using the Acquisition form, or sell assets to log P/L. This automatically alters cash balances.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTrades.map((t) => {
                      const isBuy = t.type === "BUY";
                      return (
                        <tr key={t.id} className="hover:bg-white/[0.01] transition-colors group">
                          {/* Symbol & Direction */}
                          <td className="py-3.5 px-4 font-mono font-bold">
                            <div className="flex flex-col">
                              <span className="text-white text-xs tracking-tight">{t.symbol}</span>
                              <span className={`text-[8px] uppercase tracking-wider font-extrabold mt-0.5 px-1 py-0.2 rounded w-max ${
                                isBuy 
                                  ? "bg-[#76b900]/10 text-[#76b900]" 
                                  : "bg-amber-500/10 text-amber-400"
                              }`}>
                                {t.type}
                              </span>
                            </div>
                          </td>

                          {/* Broker */}
                          <td className="py-3.5 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono border ${
                              t.broker === "FUTU" 
                                ? "bg-cyan-950/20 text-cyan-400 border-cyan-500/20" 
                                : t.broker === "IB" 
                                ? "bg-yellow-950/20 text-yellow-400 border-yellow-500/20"
                                : t.broker === "HSBC"
                                ? "bg-rose-950/20 text-rose-400 border-rose-500/20"
                                : "bg-emerald-950/20 text-emerald-400 border-emerald-500/20"
                            }`}>
                              {t.broker}
                            </span>
                          </td>

                          {/* Qty & Price */}
                          <td className="py-3.5 px-3 text-right font-mono text-[11px] text-white/80">
                            <div>{t.quantity.toLocaleString(undefined, {maximumFractionDigits: 4})} sh</div>
                            <div className="text-[9px] text-white/30">${t.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-3 text-right font-mono font-semibold text-white text-xs">
                            ${t.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </td>

                          {/* Realized G/L */}
                          <td className="py-3.5 px-3 text-right font-mono text-xs">
                            {isBuy ? (
                              <span className="text-white/20">—</span>
                            ) : (
                              <span className={t.realizedPnL >= 0 ? "text-[#76b900] font-semibold" : "text-rose-400"}>
                                {t.realizedPnL >= 0 ? "+" : ""}${t.realizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-center font-mono text-[10px] text-white/40">
                            {t.timestamp}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteTrade(t.id)}
                              title="Delete Transaction and undo cash impact"
                              className="p-1 px-1.5 hover:bg-rose-500/10 hover:text-rose-400 text-white/20 border border-transparent hover:border-rose-500/25 rounded-md transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Micro details notice of synchronized operations */}
            <div className="p-3 bg-white/[0.01] border-t border-white/5 text-[7.5px] font-mono text-white/25 text-center">
              SYSTEM INTEGRITY AUDITOR: MODIFICATIONS AUTO-CORRECT RELEVANT CASH LEDGERS AND BACKUPS INSTANTLY
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
