import React, { useState, useEffect, FormEvent } from "react";
import { 
  RefreshCw, 
  Layers, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertCircle,
  TrendingUp,
  Clock,
  Database,
  Briefcase,
  DollarSign,
  Plus,
  Trash2,
  History,
  Eye,
  EyeOff
} from "lucide-react";
import TradeHistoryView, { TradeRecord } from "./components/TradeHistoryView";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  currency: string;
  updatedAt: string;
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

export default function App() {
  const [tab, setTab] = useState<"nvda" | "portfolio" | "mutual" | "summary" | "trades">("nvda");
  const [isMasked, setIsMasked] = useState<boolean>(() => {
    return localStorage.getItem("wealth_is_masked") === "true";
  });

  const toggleMask = () => {
    const nextVal = !isMasked;
    setIsMasked(nextVal);
    localStorage.setItem("wealth_is_masked", String(nextVal));
  };

  const maskVal = (val: string | number) => {
    if (isMasked) return "******";
    return val;
  };

  const [selectedBroker, setSelectedBroker] = useState<string>("All");
  const [selectedDuration, setSelectedDuration] = useState<"1M" | "6M" | "YTD" | "1Y" | "ALL">("ALL");
  const [nvdaData, setNvdaData] = useState<StockData | null>(null);
  const [spotlightSymbol, setSpotlightSymbol] = useState<string>("NVDA");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [portfolioRawInfo, setPortfolioRawInfo] = useState<any[]>([]);
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>(() => {
    const saved = localStorage.getItem("wealth_trade_records_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading trade records", e);
      }
    }
    return [];
  });
  const [perfData, setPerfData] = useState<Record<string, Record<string, number | null>> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Constants as of today
  const BASE_CASH_FUTU = 8561.8;
  const BASE_CASH_IB = 26.4;
  const BASE_CASH_HSBC = 0.0;
  const BASE_CASH_BINANCE = 0.0;

  interface CashRecord {
    id: string;
    type: "IN" | "OUT";
    amount: number;
    broker: "FUTU" | "IB" | "HSBC" | "BINANCE";
    date: string;
    note: string;
  }

  const [cashRecords, setCashRecords] = useState<CashRecord[]>(() => {
    const saved = localStorage.getItem("wealth_cash_records_v1");
    return saved ? JSON.parse(saved) : [];
  });

  interface MutualFundTransaction {
    id: string;
    type: "BUY" | "SELL";
    amount: number;
    realizedPnL: number; // relevant for SELL
    date: string;
    broker?: "FUTU" | "IB" | "HSBC" | "BINANCE";
    note: string;
  }

  const [mfTransactions, setMfTransactions] = useState<MutualFundTransaction[]>(() => {
    const saved = localStorage.getItem("wealth_mf_transactions_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading mutual fund transactions", e);
      }
    }
    return [];
  });

  const { mfTotalAmount, mfUnrealizedPnL, mfTotalRealizedPnL } = React.useMemo(() => {
    const BASE_MF_AMOUNT = 11906.35;
    const BASE_MF_UNREALIZED_PNL = 7261.62;

    let totalAmount = BASE_MF_AMOUNT;
    let totalUnrealizedPnL = BASE_MF_UNREALIZED_PNL;
    let totalRealizedPnL = 0;

    mfTransactions.forEach((tx) => {
      if (tx.type === "BUY") {
        totalAmount += tx.amount;
      } else if (tx.type === "SELL") {
        totalAmount -= tx.amount;
        totalUnrealizedPnL -= tx.realizedPnL;
        totalRealizedPnL += tx.realizedPnL;
      }
    });

    return {
      mfTotalAmount: Math.max(0, totalAmount),
      mfUnrealizedPnL: totalUnrealizedPnL,
      mfTotalRealizedPnL: totalRealizedPnL,
    };
  }, [mfTransactions]);

  // Calculate adjusted cash
  const getMfCashImpact = (b: "FUTU" | "IB" | "HSBC" | "BINANCE") => {
    return mfTransactions.reduce((acc, tx) => {
      const txBroker = tx.broker || "HSBC";
      if (txBroker === b) {
        if (tx.type === "BUY") {
          return acc - tx.amount;
        } else if (tx.type === "SELL") {
          return acc + tx.amount;
        }
      }
      return acc;
    }, 0);
  };

  const futuRecords = cashRecords.filter(r => r.broker === "FUTU");
  const ibRecords = cashRecords.filter(r => r.broker === "IB");
  const hsbcRecords = cashRecords.filter(r => r.broker === "HSBC");
  const binanceRecords = cashRecords.filter(r => r.broker === "BINANCE");

  const futuIn = futuRecords.filter(r => r.type === "IN").reduce((acc, r) => acc + r.amount, 0);
  const futuOut = futuRecords.filter(r => r.type === "OUT").reduce((acc, r) => acc + r.amount, 0);
  
  const ibIn = ibRecords.filter(r => r.type === "IN").reduce((acc, r) => acc + r.amount, 0);
  const ibOut = ibRecords.filter(r => r.type === "OUT").reduce((acc, r) => acc + r.amount, 0);

  const hsbcIn = hsbcRecords.filter(r => r.type === "IN").reduce((acc, r) => acc + r.amount, 0);
  const hsbcOut = hsbcRecords.filter(r => r.type === "OUT").reduce((acc, r) => acc + r.amount, 0);

  const binanceIn = binanceRecords.filter(r => r.type === "IN").reduce((acc, r) => acc + r.amount, 0);
  const binanceOut = binanceRecords.filter(r => r.type === "OUT").reduce((acc, r) => acc + r.amount, 0);

  const cashFutu = BASE_CASH_FUTU + futuIn - futuOut + getMfCashImpact("FUTU");
  const cashIB = BASE_CASH_IB + ibIn - ibOut + getMfCashImpact("IB");
  const cashHSBC = BASE_CASH_HSBC + hsbcIn - hsbcOut + getMfCashImpact("HSBC");
  const cashBinance = BASE_CASH_BINANCE + binanceIn - binanceOut + getMfCashImpact("BINANCE");

  const totalCash = cashFutu + cashIB + cashHSBC + cashBinance;

  const [baseHoldings, setBaseHoldings] = useState<any[]>(() => {
    const saved = localStorage.getItem("wealth_base_holdings_v2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading base holdings", e);
      }
    }
    return [
      { symbol: "AMD", qty: 40, cost: 140.043, broker: "FUTU" },
      { symbol: "CRWV", qty: 15, cost: 117.65, broker: "FUTU" },
      { symbol: "EQT", qty: 35, cost: 58.065, broker: "FUTU" },
      { symbol: "FLJH", qty: 25, cost: 44.475, broker: "FUTU" },
      { symbol: "FMCC", qty: 150, cost: 7.132, broker: "FUTU" },
      { symbol: "GOOGL", qty: 26, cost: 193.184, broker: "FUTU" },
      { symbol: "BTC-USD", qty: 0.01443, cost: 89245.33, broker: "FUTU" },
      { symbol: "ETH-USD", qty: 11.8171, cost: 3252.65, broker: "FUTU" },
      { symbol: "GRAB", qty: 515, cost: 4.578, broker: "FUTU" },
      { symbol: "HIMS", qty: 35, cost: 45.793, broker: "FUTU" },
      { symbol: "MSFT", qty: 5, cost: 424.84, broker: "FUTU" },
      { symbol: "NBIS", qty: 40, cost: 102.047, broker: "FUTU" },
      { symbol: "NOW", qty: 10, cost: 116.1, broker: "FUTU" },
      { symbol: "ORCL", qty: 12, cost: 183.44, broker: "FUTU" },
      { symbol: "PLTR", qty: 8, cost: 145.44, broker: "FUTU" },
      { symbol: "QQQM", qty: 20, cost: 196.717, broker: "FUTU" },
      { symbol: "ROKT", qty: 8, cost: 132.54, broker: "FUTU" },
      { symbol: "SOFI", qty: 59, cost: 24.019, broker: "FUTU" },
      { symbol: "TSLA", qty: 4, cost: 302.1, broker: "FUTU" },
      { symbol: "VOO", qty: 8, cost: 490.067, broker: "FUTU" },
      { symbol: "1810.HK", qty: 600, cost: 53.15, broker: "FUTU" },
      { symbol: "9999.HK", qty: 100, cost: 188, broker: "FUTU" }
    ];
  });

  const portfolioData = React.useMemo<PortfolioItem[]>(() => {
    const normalizedBase = baseHoldings.map((h: any) => ({
      ...h,
      symbol: h.symbol.toUpperCase(),
      broker: h.broker.toUpperCase(),
    }));

    // Apply subsequent trades chronologically
    const sortedTrades = [...tradeRecords].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    let activeHoldings = [...normalizedBase];

    for (const trade of sortedTrades) {
      const tSymbol = trade.symbol.toUpperCase();
      const tBroker = trade.broker.toUpperCase();
      const tQty = trade.quantity;
      const tPrice = trade.price;

      const idx = activeHoldings.findIndex(
        (h) => h.symbol === tSymbol && h.broker === tBroker
      );

      if (trade.type === "BUY") {
        if (idx !== -1) {
          const h = activeHoldings[idx];
          const oldTotalCost = h.qty * h.cost;
          const newQty = h.qty + tQty;
          const newCost = newQty > 0 ? (oldTotalCost + tQty * tPrice) / newQty : 0;
          activeHoldings[idx] = {
            ...h,
            qty: newQty,
            cost: newCost,
          };
        } else {
          activeHoldings.push({
            symbol: tSymbol,
            qty: tQty,
            cost: tPrice,
            broker: tBroker,
          });
        }
      } else if (trade.type === "SELL") {
        if (idx !== -1) {
          const h = activeHoldings[idx];
          const newQty = Math.max(0, h.qty - tQty);
          // Standard cost basis averaging doesn't change cost per remainder on a partial liquidation/sell
          activeHoldings[idx] = {
            ...h,
            qty: newQty,
          };
        } else {
          // Track holding if none existed initially
          activeHoldings.push({
            symbol: tSymbol,
            qty: -tQty,
            cost: tPrice,
            broker: tBroker,
          });
        }
      }
    }

    // Filter out closed holdings (qty is zero or virtually zero)
    activeHoldings = activeHoldings.filter((h) => Math.abs(h.qty) > 0.00001);

    // Form complete dynamic Portfolio items
    return activeHoldings.map((h) => {
      const live = portfolioRawInfo.find(
        (item: any) => item.symbol.toUpperCase() === h.symbol.toUpperCase()
      );
      let price = live ? live.price : h.cost;
      let costValue = h.cost;
      let change = live ? live.change : 0;
      const changePercent = live ? live.changePercent : 0;
      const name = live ? live.name : h.symbol;

      const isHK = h.symbol.toUpperCase().endsWith(".HK");
      if (isHK) {
        // Exchange rate standard: 1 USD = 7.82 HKD, so 1 HKD = 0.128 USD
        const rateToUsd = 0.128;
        price = price * rateToUsd;
        costValue = costValue * rateToUsd;
        change = change * rateToUsd;
      }

      const marketValue = h.qty * price;
      const totalCost = h.qty * costValue;
      const pnl = marketValue - totalCost;

      return {
        symbol: h.symbol,
        qty: h.qty,
        cost: costValue,
        name,
        price,
        change,
        changePercent,
        marketValue,
        totalCost,
        pnl,
        pnlPercent: totalCost !== 0 ? (pnl / totalCost) * 100 : 0,
        broker: h.broker,
      };
    });
  }, [portfolioRawInfo, tradeRecords, baseHoldings]);

  const handleExportCSV = () => {
    const csvRows = [
      ["DataType", "Id", "Symbol", "Type", "Quantity", "CostOrPrice", "Amount", "RealizedPnL", "Broker", "DateOrTimestamp", "Note"]
    ];

    // Add HOLDING
    baseHoldings.forEach((h: any) => {
      csvRows.push([
        "HOLDING",
        "",
        h.symbol,
        "",
        (h.qty || 0).toString(),
        (h.cost || 0).toString(),
        ((h.qty || 0) * (h.cost || 0)).toString(),
        "",
        h.broker || "",
        "",
        ""
      ]);
    });

    // Add CASH
    cashRecords.forEach((c: any) => {
      csvRows.push([
        "CASH",
        c.id || "",
        "",
        c.type || "",
        "",
        "",
        (c.amount || 0).toString(),
        "",
        c.broker || "",
        c.date || "",
        c.note || ""
      ]);
    });

    // Add MUTUAL_FUND
    mfTransactions.forEach((m: any) => {
      csvRows.push([
        "MUTUAL_FUND",
        m.id || "",
        "",
        m.type || "",
        "",
        "",
        (m.amount || 0).toString(),
        ((m.realizedPnL || m.pnl) || 0).toString(),
        m.broker || "",
        m.date || "",
        m.note || ""
      ]);
    });

    // Add TRADE_RECORD
    tradeRecords.forEach((t: any) => {
      csvRows.push([
        "TRADE_RECORD",
        t.id || "",
        t.symbol || "",
        t.type || "",
        (t.quantity || 0).toString(),
        (t.price || 0).toString(),
        (t.amount || ((t.quantity || 0) * (t.price || 0))).toString(),
        (t.realizedPnL || 0).toString(),
        t.broker || "",
        t.timestamp || "",
        t.note || ""
      ]);
    });

    // Generate CSV content with standard escaping
    const csvContent = "﻿" + csvRows
      .map((row) =>
        row
          .map((val) => {
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\r\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `wealth_manager_data_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (csvText: string) => {
    // Parse CSV lines carefully handling quotes
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let insideQuote = false;
    let currentField = "";

    // Remove BOM if present
    const cleanCsvText = csvText.startsWith("﻿") || csvText.startsWith("\ufeff") 
      ? csvText.substring(csvText.length > 1 && (csvText.charCodeAt(0) === 0xFEFF || csvText.charCodeAt(0) === 65279) ? 1 : 0)
      : csvText;

    for (let i = 0; i < cleanCsvText.length; i++) {
      const char = cleanCsvText[i];
      const nextChar = cleanCsvText[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentField += '"';
          i++; // Skip next quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip LF if CRLF
        }
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(field => field !== "")) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.length > 0 && currentRow.some(field => field !== "")) {
        lines.push(currentRow);
      }
    }

    if (lines.length < 2) {
      alert("Invalid or empty CSV file.");
      return;
    }

    // Inspect headers
    const headers = lines[0].map(h => h.trim().toUpperCase().replace(/[\ufeff\u200b]/g, ""));
    const typeIdx = headers.indexOf("DATATYPE");
    const idIdx = headers.indexOf("ID");
    const symbolIdx = headers.indexOf("SYMBOL");
    const modeTypeIdx = headers.indexOf("TYPE"); // BUY, SELL, IN, OUT
    const qtyIdx = headers.indexOf("QUANTITY");
    const costPriceIdx = headers.indexOf("COSTORPRICE");
    const amtIdx = headers.indexOf("AMOUNT");
    const pnlIdx = headers.indexOf("REALIZEDPNL");
    const brokerIdx = headers.indexOf("BROKER");
    const dateIdx = headers.indexOf("DATEORTIMESTAMP");
    const noteIdx = headers.indexOf("NOTE");

    if (typeIdx === -1) {
      alert("Header 'DataType' is missing. The uploaded file is in an invalid template format.");
      return;
    }

    const newHoldings: any[] = [];
    const newCash: any[] = [];
    const newMutual: any[] = [];
    const newTrades: any[] = [];

    for (let r = 1; r < lines.length; r++) {
      const row = lines[r];
      if (!row || row.length <= typeIdx) continue;

      const dataType = row[typeIdx]?.trim().toUpperCase();
      if (!dataType) continue;

      const getValue = (idx: number, fallback = "") => {
        if (idx === -1 || idx >= row.length) return fallback;
        return row[idx]?.trim() || fallback;
      };

      const idVal = getValue(idIdx) || Math.random().toString(36).substring(2, 9);
      const symbolVal = getValue(symbolIdx).toUpperCase();
      const actionTypeVal = getValue(modeTypeIdx).toUpperCase() as any; // BUY, SELL, IN, OUT
      const qtyVal = parseFloat(getValue(qtyIdx)) || 0;
      const costOrPriceVal = parseFloat(getValue(costPriceIdx)) || 0;
      const amountVal = parseFloat(getValue(amtIdx)) || 0;
      const pnlVal = parseFloat(getValue(pnlIdx)) || 0;
      const brokerVal = getValue(brokerIdx).toUpperCase() as any;
      const dateVal = getValue(dateIdx);
      const noteVal = getValue(noteIdx);

      if (dataType === "HOLDING") {
        if (symbolVal && qtyVal > 0) {
          newHoldings.push({
            symbol: symbolVal,
            qty: qtyVal,
            cost: costOrPriceVal,
            broker: brokerVal || "FUTU"
          });
        }
      } else if (dataType === "CASH") {
        if (actionTypeVal === "IN" || actionTypeVal === "OUT") {
          newCash.push({
            id: idVal,
            type: actionTypeVal,
            amount: amountVal || 0,
            broker: ["FUTU", "IB", "HSBC", "BINANCE"].includes(brokerVal) ? brokerVal : "FUTU",
            date: dateVal || "2026-06-11",
            note: noteVal
          });
        }
      } else if (dataType === "MUTUAL_FUND") {
        if (actionTypeVal === "BUY" || actionTypeVal === "SELL") {
          newMutual.push({
            id: idVal,
            type: actionTypeVal,
            amount: amountVal || 0,
            realizedPnL: pnlVal || 0,
            broker: ["FUTU", "IB", "HSBC", "BINANCE"].includes(brokerVal) ? brokerVal : "FUTU",
            date: dateVal || "2026-06-11",
            note: noteVal
          });
        }
      } else if (dataType === "TRADE_RECORD") {
        if (symbolVal && (actionTypeVal === "BUY" || actionTypeVal === "SELL")) {
          newTrades.push({
            id: idVal,
            symbol: symbolVal,
            type: actionTypeVal,
            broker: ["FUTU", "IB", "HSBC", "BINANCE"].includes(brokerVal) ? brokerVal : "FUTU",
            quantity: qtyVal,
            price: costOrPriceVal,
            amount: amountVal || (qtyVal * costOrPriceVal),
            realizedPnL: pnlVal || 0,
            timestamp: dateVal || "2026-06-11T00:00:00.000Z",
            note: noteVal
          });
        }
      }
    }

    if (newHoldings.length > 0 || newCash.length > 0 || newMutual.length > 0 || newTrades.length > 0) {
      const confirmText = `Are you sure you want to import this configuration?\n\n` +
        `• Holdings found: ${newHoldings.length} stocks\n` +
        `• Cash flows found: ${newCash.length} entries\n` +
        `• Mutual fund flows found: ${newMutual.length} records\n` +
        `• Trade execution logs found: ${newTrades.length} records\n\n` +
        `This will overwrite all active configurations in local memory. Continue?`;

      if (window.confirm(confirmText)) {
        if (newHoldings.length > 0) {
          setBaseHoldings(newHoldings);
          localStorage.setItem("wealth_base_holdings_v2", JSON.stringify(newHoldings));
        }
        setCashRecords(newCash);
        localStorage.setItem("wealth_cash_records_v1", JSON.stringify(newCash));

        setMfTransactions(newMutual);
        localStorage.setItem("wealth_mf_transactions_v1", JSON.stringify(newMutual));

        setTradeRecords(newTrades);
        localStorage.setItem("wealth_trade_records_v1", JSON.stringify(newTrades));

        alert("System Database successfully restored from CSV configuration file!");
      }
    } else {
      alert("No valid data rows matching schema tags (DataType == HOLDING, CASH, MUTUAL_FUND, TRADE_RECORD) were parsed successfully.");
    }
  };

  // New cash flow form states
  const [flowType, setFlowType] = useState<"IN" | "OUT">("IN");
  const [flowBroker, setFlowBroker] = useState<"FUTU" | "IB" | "HSBC" | "BINANCE">("FUTU");
  const [flowAmount, setFlowAmount] = useState<string>("");
  const [flowDate, setFlowDate] = useState<string>("2026-06-11");
  const [flowNote, setFlowNote] = useState<string>("");

  const handleAddCashRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(flowAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const newRec: CashRecord = {
      id: Math.random().toString(36).substring(2, 9),
      type: flowType,
      amount: parsedAmount,
      broker: flowBroker,
      date: flowDate || "2026-06-11",
      note: flowNote.trim()
    };

    const updated = [newRec, ...cashRecords];
    setCashRecords(updated);
    localStorage.setItem("wealth_cash_records_v1", JSON.stringify(updated));

    // Reset some inputs
    setFlowAmount("");
    setFlowNote("");
  };

  const handleDeleteCashRecord = (id: string) => {
    const updated = cashRecords.filter(r => r.id !== id);
    setCashRecords(updated);
    localStorage.setItem("wealth_cash_records_v1", JSON.stringify(updated));
  };

  // New Mutual Fund ledger form states
  const [mfFormType, setMfFormType] = useState<"BUY" | "SELL">("BUY");
  const [mfFormBroker, setMfFormBroker] = useState<"FUTU" | "IB" | "HSBC" | "BINANCE">("HSBC");
  const [mfFormAmount, setMfFormAmount] = useState<string>("");
  const [mfFormPnL, setMfFormPnL] = useState<string>(""); // optional realized gain/loss for SELL
  const [mfFormDate, setMfFormDate] = useState<string>("2026-06-11");
  const [mfFormNote, setMfFormNote] = useState<string>("");

  const handleAddMfTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(mfFormAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    const pnlVal = mfFormType === "SELL" ? parseFloat(mfFormPnL) || 0 : 0;

    const newTx: MutualFundTransaction = {
      id: Math.random().toString(36).substring(2, 9),
      type: mfFormType,
      amount: amountVal,
      realizedPnL: pnlVal,
      date: mfFormDate || "2026-06-11",
      broker: mfFormBroker,
      note: mfFormNote.trim()
    };

    const updated = [newTx, ...mfTransactions];
    setMfTransactions(updated);
    localStorage.setItem("wealth_mf_transactions_v1", JSON.stringify(updated));

    // Reset inputs
    setMfFormAmount("");
    setMfFormPnL("");
    setMfFormNote("");
  };

  const handleDeleteMfTransaction = (id: string) => {
    const updated = mfTransactions.filter((t) => t.id !== id);
    setMfTransactions(updated);
    localStorage.setItem("wealth_mf_transactions_v1", JSON.stringify(updated));
  };

  const unifiedChronicles = React.useMemo(() => {
    const cash = cashRecords.map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type, // "IN" | "OUT"
      broker: r.broker,
      note: r.note,
      amount: r.amount,
      isMf: false,
      realizedPnL: 0,
    }));

    const mf = mfTransactions.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type, // "BUY" | "SELL"
      broker: t.broker || "HSBC",
      note: t.note ? `[MF] ${t.note}` : "[MF] Trading activity",
      amount: t.amount,
      isMf: true,
      realizedPnL: t.realizedPnL,
    }));

    return [...cash, ...mf].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    });
  }, [cashRecords, mfTransactions]);

  const handleDeleteUnifiedEntry = (id: string, isMf: boolean) => {
    if (isMf) {
      handleDeleteMfTransaction(id);
    } else {
      handleDeleteCashRecord(id);
    }
  };

  const fetchAllData = async (silent = false, targetSymbol?: string) => {
    if (!silent) setLoading(true);
    setError(null);
    setIsRefreshing(true);
    try {
      const timestamp = Date.now();
      
      // Dynamic query symbols loaded straight from current local trades
      const savedTradesStr = localStorage.getItem("wealth_trade_records_v1") || "[]";
      let savedTrades: any[] = [];
      try {
        savedTrades = JSON.parse(savedTradesStr);
      } catch (e) {}
      const extraSymbols = Array.from(new Set(savedTrades.map((t: any) => t.symbol.toUpperCase()))).filter(Boolean);
      const symbolsParam = extraSymbols.join(",");

      // Pick symbol to fetch for spotlight
      let symbolToFetch = targetSymbol;
      if (!symbolToFetch) {
        const baseSymbols = [
          "AMD", "CRWV", "EQT", "FLJH", "FMCC", "GOOGL", "BTC-USD", "ETH-USD", 
          "GRAB", "HIMS", "MSFT", "NBIS", "NOW", "ORCL", "PLTR", "QQQM", "ROKT", 
          "SOFI", "TSLA", "VOO", "1810.HK", "9999.HK"
        ];
        const allUnique = Array.from(new Set([...baseSymbols, ...extraSymbols])).filter(Boolean);
        symbolToFetch = allUnique[Math.floor(Math.random() * allUnique.length)] || "NVDA";
      }

      setSpotlightSymbol(symbolToFetch);

      // Fetch dynamic spotlight, Portfolio, and Performance calculations concurrently
      const [spotlightRes, portfolioRes, perfRes] = await Promise.all([
        fetch(`/api/stock/${symbolToFetch}?t=${timestamp}`),
        fetch(`/api/portfolio?symbols=${symbolsParam}&t=${timestamp}`),
        fetch(`/api/performance?symbols=${symbolToFetch}&t=${timestamp}`)
      ]);

      if (!spotlightRes.ok) {
        const errJson = await spotlightRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch ${symbolToFetch} stock data (Status ${spotlightRes.status})`);
      }
      if (!portfolioRes.ok) {
        const errJson = await portfolioRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch Portfolio details (Status ${portfolioRes.status})`);
      }
      if (!perfRes.ok) {
        const errJson = await perfRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch Benchmark indices (Status ${perfRes.status})`);
      }

      const spotlightStockInfo: StockData = await spotlightRes.json();
      const portfolioRawInfoList: any[] = await portfolioRes.json();
      const historicalPerformance: any = await perfRes.json();

      setNvdaData(spotlightStockInfo);
      setPortfolioRawInfo(portfolioRawInfoList);
      setPerfData(historicalPerformance);
    } catch (err: any) {
      console.error("Fetch dashboard error:", err);
      setError(err?.message || "Failed to load stock data from Yahoo Finance.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const formatMarketCap = (num?: number) => {
    if (num === undefined || num === null) return "N/A";
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    return num.toLocaleString();
  };

  const formatVolume = (num?: number) => {
    if (num === undefined || num === null) return "N/A";
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    return num.toLocaleString();
  };

  const isNvdaPositive = nvdaData ? nvdaData.change >= 0 : false;
  const nvdaChangeFormatted = nvdaData 
    ? `${isNvdaPositive ? "+" : ""}${nvdaData.change.toFixed(2)}` 
    : "";
  const nvdaChangePercentFormatted = nvdaData 
    ? `${isNvdaPositive ? "+" : ""}${nvdaData.changePercent.toFixed(2)}%` 
    : "";

  // Filtered portfolio items based on selected broker
  const filteredPortfolio = selectedBroker === "All"
    ? portfolioData
    : portfolioData.filter((item) => item.broker.toUpperCase() === selectedBroker.toUpperCase());

  // Dynamic calculations for overall portfolio health
  const totalPortfolioValue = filteredPortfolio.reduce((acc, curr) => acc + curr.marketValue, 0);
  const totalPortfolioCost = filteredPortfolio.reduce((acc, curr) => acc + curr.totalCost, 0);
  const totalPortfolioPnL = totalPortfolioValue - totalPortfolioCost;
  const totalPortfolioPnLPercent = totalPortfolioCost > 0 ? (totalPortfolioPnL / totalPortfolioCost) * 100 : 0;

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex flex-col font-sans overflow-x-hidden relative selection:bg-[#76b900] selection:text-black">
      
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-25 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-25%] right-[-10%] w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-[#76b900] rounded-full blur-[140px] sm:blur-[220px]"></div>
        <div className="absolute bottom-[-15%] left-[-10%] w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-[#1a1a1a] rounded-full blur-[90px] sm:blur-[160px]"></div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 py-8 max-w-5xl mx-auto w-full">
        
        {/* Futu Wealth Professional App Header Strip */}
        <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-white/10 z-10 font-sans">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#76b900]/10 border border-[#76b900]/30 flex items-center justify-center">
              <span className="text-[#76b900] font-mono text-sm font-black">FT</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Futu Wealth Engine</h1>
              <p className="text-[10px] text-white/40 font-mono uppercase">All System Margins • Cryptocurrencies</p>
            </div>
          </div>
          
          {/* Mask toggle button */}
          <button
            onClick={toggleMask}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#76b900]/30 transition-all text-xs font-mono text-white/80 hover:text-white cursor-pointer select-none w-full sm:w-auto"
            title={isMasked ? "Show asset amounts" : "Hide sensitive amounts"}
          >
            {isMasked ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-[#76b900]" />}
            <span>{isMasked ? "SHOW BALANCES" : "MASK BALANCES"}</span>
          </button>
        </div>

        {/* Sleek Tab Controller */}
        <div className="w-full max-w-4xl z-10 mb-8 select-none">
          {/* Mobile Tab Control Grid */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl sm:hidden">
            <button
              onClick={() => setTab("nvda")}
              className={`flex items-center justify-center gap-2 px-3 py-3 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "nvda" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>SPOTLIGHT</span>
            </button>
            <button
              onClick={() => setTab("portfolio")}
              className={`flex items-center justify-center gap-2 px-3 py-3 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "portfolio" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>PORTFOLIO</span>
            </button>
            <button
              onClick={() => setTab("trades")}
              className={`flex items-center justify-center gap-2 px-3 py-3 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "trades" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>LOGS</span>
            </button>
            <button
              onClick={() => setTab("summary")}
              className={`flex items-center justify-center gap-2 px-3 py-3 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "summary" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>SUMMARY</span>
            </button>
            <button
              onClick={() => setTab("mutual")}
              className={`col-span-2 flex items-center justify-center gap-2 px-3 py-3 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "mutual" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>MUTUAL FUND</span>
            </button>
          </div>

          {/* Desktop Tab Selector Row */}
          <div className="hidden sm:flex flex-wrap justify-center bg-white/5 border border-white/10 p-1.5 rounded-2xl select-none gap-y-1">
            <button
              id="tab-nvda"
              onClick={() => setTab("nvda")}
              className={`px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider font-semibold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "nvda" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              SPOTLIGHT
            </button>
            <button
              id="tab-portfolio"
              onClick={() => setTab("portfolio")}
              className={`px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider font-semibold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "portfolio" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              MY PORTFOLIO TRACKER
            </button>
            <button
              id="tab-trades"
              onClick={() => setTab("trades")}
              className={`px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider font-semibold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "trades" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              TRADE LOGS & HISTORY
            </button>
            <button
              id="tab-summary"
              onClick={() => setTab("summary")}
              className={`px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider font-semibold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "summary" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              SUMMARY PERFORMANCE
            </button>
            <button
              id="tab-mutual"
              onClick={() => setTab("mutual")}
              className={`px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider font-semibold transition-all duration-200 rounded-xl cursor-pointer ${
                tab === "mutual" 
                  ? "bg-[#76b900] text-black shadow-lg shadow-[#76b900]/20" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              MUTUAL FUND
            </button>
          </div>
        </div>

        {/* Dynamic CSV Import/Export Action Center */}
        {tab === "portfolio" && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/10 px-5 py-3.5 rounded-2xl mb-8 sm:mb-12 w-full max-w-4xl z-10 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded bg-[#76b900]/10 border border-[#76b900]/20 text-[#76b900] text-[9px] font-bold uppercase tracking-wider">Sync Center</span>
              <span className="text-white/60 text-[11px]">Local Database Import / Export Controls</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-[#76b900]/20 hover:border-[#76b900]/40 hover:text-white rounded-xl transition-all text-xs font-semibold text-white/90 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4 text-[#76b900]" /> Export CSV
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-cyan-500/15 hover:border-cyan-500/35 hover:text-white rounded-xl transition-all text-xs font-semibold text-white/90 cursor-pointer">
                <ArrowDownRight className="w-4 h-4 text-cyan-400" /> Import CSV
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const txt = event.target?.result as string;
                      if (txt) handleImportCSV(txt);
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>
        )}

        {/* Content Segment */}
        {loading ? (
          /* High quality skeleton loader mapping the container sizing */
          <div className="flex flex-col items-center animate-pulse text-center w-full max-w-3xl my-auto">
            <div className="h-6 w-48 bg-white/10 rounded mb-4" />
            <div className="h-32 w-80 sm:w-96 bg-white/5 rounded-3xl mb-6" />
            <div className="h-16 w-56 bg-white/10 rounded mb-16" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full border-t border-white/10 pt-12">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-white/5 rounded-2xl"></div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State Panel */
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto my-auto gap-4 z-10">
            <div className="h-16 w-16 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-500">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-display font-semibold text-lg text-white">
                Unable to Retrieve Market Quote
              </h2>
              <p className="text-sm text-neutral-400 max-w-sm">
                {error}
              </p>
            </div>
            <button
              id="retry-btn"
              onClick={() => fetchAllData()}
              className="mt-4 px-6 py-2.5 bg-white text-black hover:bg-[#76b900] font-mono text-xs uppercase tracking-[0.2em] font-bold transition-all duration-200 cursor-pointer focus:outline-none"
            >
              Retry Connection
            </button>
          </div>
        ) : tab === "nvda" && nvdaData ? (
          
          /* VIEW 1: Dynamic Asset Spotlight Display */
          <div className="flex-1 flex flex-col items-center justify-center w-full my-auto transition-all duration-300">
            
            {/* Sleek Search Panel */}
            <div className="w-full max-w-sm mb-8 z-20 flex flex-col items-center">
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!searchQuery.trim()) return;
                  setSearchError(null);
                  try {
                    await fetchAllData(false, searchQuery.trim().toUpperCase());
                    setSearchQuery("");
                  } catch (err: any) {
                    setSearchError(err?.message || "Invalid symbol or search failed");
                  }
                }}
                className="relative w-full flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#76b900]/50 transition-all duration-200"
              >
                <input
                  type="text"
                  placeholder="Search Ticker (e.g. AAPL, BTC-USD, AMD)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent px-4 py-3 text-sm text-white focus:outline-none placeholder-white/35 uppercase font-mono tracking-wider"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-[#76b900] hover:bg-[#86cd00] text-black font-mono font-bold text-xs uppercase cursor-pointer transition-colors"
                >
                  Search
                </button>
              </form>
              {searchError && (
                <p className="text-rose-500 font-mono text-[10px] uppercase text-center mt-2 animate-pulse">
                  {searchError}
                </p>
              )}
            </div>

            {/* Header / Meta Indicator */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="flex items-center gap-3">
                <span className="bg-[#76b900] text-black font-mono font-black px-2.5 py-0.5 text-[11px] tracking-wider uppercase rounded-sm">
                  {nvdaData.currency || "USD"}
                </span>
                <span className="text-[#76b900] text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase italic">
                  {nvdaData.name}
                </span>
              </div>
            </div>

            {/* Giant Graphic Ticker Symbol */}
            <h1 className="text-[100px] sm:text-[160px] md:text-[200px] font-extrabold leading-none tracking-tighter text-white select-none opacity-95 font-display">
              {nvdaData.symbol}
            </h1>

            {/* Main Price display section with dynamic margins */}
            <div className="flex flex-col items-center min-h-[140px] mt-1">
              <span className="text-7xl sm:text-[110px] md:text-[120px] font-extralight leading-none tabular-nums text-white tracking-tight flex items-start">
                <span className="text-3xl sm:text-5xl font-light text-[#76b900]/85 mt-1 sm:mt-3">$</span>
                {nvdaData.price.toFixed(2)}
              </span>

              {/* Day change bubble indicator */}
              <div className="flex items-center gap-3 mt-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                <span className={`text-lg sm:text-2xl font-semibold font-mono ${isNvdaPositive ? "text-[#76b900]" : "text-rose-500"}`}>
                  {nvdaChangeFormatted}
                </span>
                <span className={`text-lg sm:text-2xl font-light font-mono ${isNvdaPositive ? "text-[#76b900]/80" : "text-rose-500/80"}`}>
                  ({nvdaChangePercentFormatted})
                </span>
                
                {isNvdaPositive ? (
                  <ArrowUpRight className="h-5 w-5 text-[#76b900] stroke-[2.5]" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-rose-500 stroke-[2.5]" />
                )}
              </div>
            </div>

            {/* Key Metrics grid layout */}
            <div className="mt-14 sm:mt-20 w-full max-w-3xl grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 border-t border-white/10 pt-10 px-4">
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1.5 flex items-center gap-1.5 font-mono">
                  <Layers className="h-3 w-3 text-[#76b900]" /> Market Cap
                </span>
                <span className="text-xl sm:text-2xl font-light font-mono tracking-tight text-white">
                  ${formatMarketCap(nvdaData.marketCap)}
                </span>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1.5 flex items-center gap-1.5 font-mono">
                  <BarChart3 className="h-3 w-3 text-[#76b900]" /> Volume (Today)
                </span>
                <span className="text-xl sm:text-2xl font-light font-mono tracking-tight text-white">
                  {formatVolume(nvdaData.volume)}
                </span>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1.5 flex items-center gap-1.5 font-mono">
                  <TrendingUp className="h-3 w-3 text-[#76b900]" /> Day Range
                </span>
                <span className="text-base sm:text-lg font-light font-mono tracking-tight text-white/95">
                  ${nvdaData.low.toFixed(2)} - ${nvdaData.high.toFixed(2)}
                </span>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-1.5 flex items-center gap-1.5 font-mono">
                  Open / Prev Close
                </span>
                <span className="text-base sm:text-lg font-light font-mono tracking-tight text-white/90">
                  ${nvdaData.open.toFixed(2)} / ${nvdaData.previousClose?.toFixed(2) || "N/A"}
                </span>
              </div>
            </div>

            {/* Historical Return Performance Table/Grid */}
            <div className="mt-12 w-full max-w-3xl border-t border-white/10 pt-8 px-4">
              <h3 className="text-xs font-mono uppercase tracking-[0.25em] text-[#76b900]/80 mb-6 flex items-center justify-center md:justify-start gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Historical Returns & Index Comparison
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {(["1M", "6M", "YTD", "1Y"] as const).map((period) => {
                  const nvdaPerf = perfData?.[nvdaData.symbol]?.[period];
                  const vooPerf = perfData?.["VOO"]?.[period];
                  const qqqPerf = perfData?.["QQQ"]?.[period];

                  const periodLabel = {
                    "1M": "1 Month",
                    "6M": "6 Months",
                    "YTD": "YTD",
                    "1Y": "1 Year"
                  }[period];

                  const isPositive = nvdaPerf !== null && nvdaPerf !== undefined && nvdaPerf >= 0;

                  return (
                    <div key={period} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 hover:bg-white/[0.04] text-center md:text-left">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono block mb-1">
                          {periodLabel}
                        </span>
                        {nvdaPerf === null || nvdaPerf === undefined ? (
                          <span className="text-xs text-white/35 font-mono italic">No Data</span>
                        ) : (
                          <div className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${isPositive ? "text-[#76b900]" : "text-rose-500"}`}>
                            {isPositive ? "+" : ""}{nvdaPerf.toFixed(1)}%
                          </div>
                        )}
                      </div>

                      {/* Comparison details */}
                      {nvdaPerf !== null && nvdaPerf !== undefined && (
                        <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1">
                          {vooPerf !== null && vooPerf !== undefined && (
                            <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                              <span>vs VOO:</span>
                              <span className={`font-semibold ${nvdaPerf >= vooPerf ? "text-[#76b900]" : "text-amber-500/80"}`}>
                                {nvdaPerf >= vooPerf ? "+" : ""}{(nvdaPerf - vooPerf).toFixed(1)}%
                              </span>
                            </div>
                          )}
                          {qqqPerf !== null && qqqPerf !== undefined && (
                            <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                              <span>vs QQQ:</span>
                              <span className={`font-semibold ${nvdaPerf >= qqqPerf ? "text-[#76b900]" : "text-amber-500/80"}`}>
                                {nvdaPerf >= qqqPerf ? "+" : ""}{(nvdaPerf - qqqPerf).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : tab === "portfolio" ? (
          
          /* VIEW 2: Portfolio Holdings Ledger Table */
          <div className="w-full max-w-4xl bg-[#090909] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 z-10 transition-all duration-300">
            
            {/* Ledger Header details alongside total totals widget */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 pb-6 border-b border-white/5">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-white flex items-center gap-2.5">
                  <span className="p-1.5 bg-white/5 rounded-xl border border-white/10 text-[#76b900]">
                    <Briefcase className="w-5 h-5"/>
                  </span>
                  Portfolio Assets
                </h2>
                <p className="text-xs text-white/40 tracking-wider uppercase font-mono mt-1.5">Live Valuation Index</p>
              </div>

              {/* Dynamic overall value status based on Duration */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 sm:gap-6 bg-white/5 border border-white/10 p-5 rounded-2xl w-full lg:w-auto">
                <div className="flex flex-col min-w-[130px]">
                  {selectedDuration === "ALL" ? (
                    <>
                      <span className="text-[9px] uppercase tracking-widest text-[#76b900] font-mono flex items-center gap-1 font-bold">
                        <Layers className="w-3 h-3 text-[#76b900]"/> {selectedBroker === "All" ? "Total Portfolio" : `${selectedBroker} Assets`} Value
                      </span>
                      <span className="text-xl sm:text-2xl font-light font-mono text-white mt-1">
                        ${maskVal(totalPortfolioValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[9px] uppercase tracking-widest text-[#76b900] font-mono flex items-center gap-1 font-bold">
                        <TrendingUp className="w-3 h-3 text-[#76b900]"/> Weighted {selectedDuration} Return
                      </span>
                      <span className="text-xl sm:text-2xl font-semibold font-mono text-[#76b900] mt-1 flex flex-wrap items-baseline gap-1.5">
                        {(() => {
                          let weightedRet = 0;
                          let totalW = 0;
                          filteredPortfolio.forEach(item => {
                            const p = perfData?.[item.symbol]?.[selectedDuration];
                            if (p !== null && p !== undefined) {
                              weightedRet += item.marketValue * p;
                              totalW += item.marketValue;
                            }
                          });
                          const finalRet = totalW > 0 ? (weightedRet / totalW) : null;
                          return finalRet !== null ? `${finalRet >= 0 ? "+" : ""}${finalRet.toFixed(2)}%` : "No Data";
                        })()}
                        <span className="text-xs font-light text-white/50 font-mono">
                          (${maskVal(totalPortfolioValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))})
                        </span>
                      </span>
                    </>
                  )}
                </div>
                
                <div className="hidden md:block w-[1px] h-10 bg-white/10"></div>
                
                <div className="flex flex-col min-w-[130px]">
                  <span className="text-[9px] uppercase tracking-widest text-white/45 font-mono font-bold">
                    Net {selectedBroker === "All" ? "Unrealized" : selectedBroker} P/L
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-2">
                    <span className={`text-xl sm:text-2xl font-medium font-mono flex items-baseline gap-1 mt-1 ${totalPortfolioPnL >= 0 ? "text-[#76b900]" : "text-rose-500"}`}>
                      {totalPortfolioPnL >= 0 ? "+" : ""}${maskVal(totalPortfolioPnL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                      <span className="text-xs sm:text-sm font-light">({totalPortfolioPnLPercent >= 0 ? "+" : ""}{totalPortfolioPnLPercent.toFixed(2)}%)</span>
                    </span>
                  </div>
                </div>

                <div className="hidden md:block w-[1px] h-10 bg-white/10"></div>

                <div className="flex flex-col min-w-[120px]">
                  <span className="text-[9px] uppercase tracking-widest text-[#76b900] font-mono font-bold">
                    {selectedDuration} Benchmarks
                  </span>
                  <div className="text-xs font-mono text-white/70 mt-1 leading-normal flex flex-row md:flex-col gap-x-4 gap-y-0.5">
                    <span className="flex gap-1.5 items-center">
                      <span className="text-[9px] text-white/40 uppercase">VOO:</span>
                      <span className="font-semibold text-white">
                        {perfData?.["VOO"]?.[selectedDuration] !== null && perfData?.["VOO"]?.[selectedDuration] !== undefined ? `${(perfData?.["VOO"]?.[selectedDuration] || 0) >= 0 ? "+" : ""}${perfData?.["VOO"]?.[selectedDuration]}%` : "No Data"}
                      </span>
                    </span>
                    <span className="flex gap-1.5 items-center">
                      <span className="text-[9px] text-white/40 uppercase">QQQ:</span>
                      <span className="font-semibold text-[#76b900]">
                        {perfData?.["QQQ"]?.[selectedDuration] !== null && perfData?.["QQQ"]?.[selectedDuration] !== undefined ? `${(perfData?.["QQQ"]?.[selectedDuration] || 0) >= 0 ? "+" : ""}${perfData?.["QQQ"]?.[selectedDuration]}%` : "No Data"}
                      </span>
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Selection Filters Panel */}
            <div className="flex flex-col gap-4 mb-6 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              
              {/* Row 1: Broker Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                  <span className="text-[10px] text-white/40 font-mono tracking-widest uppercase shrink-0 w-32">
                    Select Broker:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {["All", "Futu", "IB", "HSBC", "Binance"].map((broker) => (
                      <button
                        key={broker}
                        id={`broker-${broker}`}
                        onClick={() => setSelectedBroker(broker)}
                        className={`px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-wider transition-all duration-150 rounded-lg cursor-pointer border ${
                          selectedBroker === broker
                            ? "bg-[#76b900] text-black border-[#76b900] shadow-md shadow-[#76b900]/10"
                            : "text-white/60 hover:text-white border-white/10 hover:bg-white/5 bg-transparent"
                        }`}
                      >
                        {broker}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase shrink-0 sm:text-right">
                  Showing {filteredPortfolio.length} of {portfolioData.length} holdings
                </div>
              </div>

              <div className="h-[1px] bg-white/5 w-full"></div>

              {/* Row 2: Duration / Time Frame Selection Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                <span className="text-[10px] text-white/40 font-mono tracking-widest uppercase shrink-0 w-32">
                  PL Historical Filter:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "1M", label: "1 Month" },
                    { key: "6M", label: "6 Months" },
                    { key: "YTD", label: "Year to Date" },
                    { key: "1Y", label: "1 Year" },
                    { key: "ALL", label: "All Time (Cost)" }
                  ].map((dur) => (
                    <button
                      key={dur.key}
                      onClick={() => setSelectedDuration(dur.key as any)}
                      className={`px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-wider transition-all duration-150 rounded-lg cursor-pointer border ${
                        selectedDuration === dur.key
                          ? "bg-[#76b900] text-black border-[#76b900] shadow-md shadow-[#76b900]/10"
                          : "text-white/60 hover:text-white border-white/10 hover:bg-white/5 bg-transparent"
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Mobile Cards-Based Portfolio List (Only visible on mobile screens) */}
            <div className="block sm:hidden space-y-3.5 mb-6">
              {filteredPortfolio.length === 0 ? (
                <div className="py-10 text-center text-xs text-white/40 font-mono bg-white/[0.01] border border-white/5 rounded-2xl">
                  No holdings matching the selected broker found.
                </div>
              ) : (
                filteredPortfolio.map((item, idx) => {
                  const assetPeriodReturn: number | null = item.pnlPercent;
                  const isItemPositive = item.pnl >= 0;

                  return (
                    <div 
                      key={`mobile-asset-${item.symbol}-${item.broker}-${idx}`}
                      className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-4 space-y-3 font-sans relative overflow-hidden"
                    >
                      {/* Top Row: Symbol, Name and Broker Tag */}
                      <div className="flex items-center justify-between font-sans">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-xs text-[#76b900]">
                            {item.symbol}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white">{item.symbol}</div>
                            <div className="text-[10px] text-white/45 truncate max-w-[140px]">{item.name}</div>
                          </div>
                        </div>
                        
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase ${
                          item.broker === "Futu" ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20" :
                          item.broker === "IB" ? "bg-amber-950/40 text-amber-400 border border-amber-500/20" :
                          item.broker === "HSBC" ? "bg-red-950/40 text-red-400 border border-red-500/20" :
                          "bg-orange-950/40 text-orange-400 border border-orange-500/20" // Binance
                        }`}>
                          {item.broker}
                        </span>
                      </div>

                      {/* Middle Rows: Grid containing metrics */}
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-2 border-t border-white/5">
                        <div>
                          <div className="text-[10px] text-white/40 uppercase font-mono">Qty:</div>
                          <div className="text-xs font-mono font-semibold text-white/80">{maskVal(item.qty)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 uppercase font-mono">Cost:</div>
                          <div className="text-xs font-mono font-semibold text-white/80">${maskVal(item.cost.toFixed(2))}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 uppercase font-mono">Price:</div>
                          <div className="text-xs font-mono font-semibold text-white">${maskVal(item.price.toFixed(2))}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 uppercase font-mono">Market Value:</div>
                          <div className="text-xs font-mono font-bold text-white">
                            ${maskVal(item.marketValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Profit / Loss */}
                      <div className="flex justify-between items-center bg-white/[0.01] border border-white/5 px-3 py-2 rounded-xl mt-2">
                        <span className="text-[9px] text-white/40 uppercase font-mono font-bold">Unrealized P/L:</span>
                        {assetPeriodReturn === null ? (
                          <span className="text-xs font-mono text-white/35 italic">No Data</span>
                        ) : (
                          <span className={`text-xs font-bold font-mono ${isItemPositive ? "text-[#76b900]" : "text-rose-500"}`}>
                            {isItemPositive ? "+" : ""}${maskVal(item.pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}{" "}
                            ({isItemPositive ? "+" : ""}{assetPeriodReturn.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Portfolio Table - Desktop friendly scroll container (Hidden on mobile screens) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="py-4 px-3 text-[9px] uppercase tracking-[0.15em] font-mono">Asset</th>
                    <th className="py-4 px-1 text-[9px] uppercase tracking-[0.1em] font-mono w-20 font-sans">Allocation</th>
                    <th className="py-4 px-2 text-[9px] uppercase tracking-[0.1em] font-mono text-right">Quantity</th>
                    <th className="py-4 px-2 text-[9px] uppercase tracking-[0.1em] font-mono text-right">Cost Price</th>
                    <th className="py-4 px-2 text-[9px] uppercase tracking-[0.1em] font-mono text-right">Current Price</th>
                    <th className="py-4 px-2 text-[9px] uppercase tracking-[0.1em] font-mono text-right">Market Value</th>
                    <th className="py-4 px-3 text-[9px] uppercase tracking-[0.15em] font-mono text-right">
                      Cumulative P/L
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPortfolio.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-white/40 font-mono">
                        No holdings matching the selected broker found.
                      </td>
                    </tr>
                  ) : (
                    filteredPortfolio.map((item, idx) => {
                      const assetPeriodReturn: number | null = item.pnlPercent;
                      const isItemPositive = item.pnl >= 0;

                      return (
                        <tr key={`${item.symbol}-${item.broker}-${idx}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                          
                          {/* Asset Info */}
                          <td className="py-5 px-3">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-xs text-[#76b900] group-hover:bg-[#76b900] group-hover:text-black transition-all">
                                {item.symbol}
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-white">{item.symbol}</div>
                                <div className="text-[10px] text-white/45 truncate max-w-[150px]">{item.name}</div>
                              </div>
                            </div>
                          </td>

                          {/* Allocation */}
                          <td className="py-5 px-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                              item.broker === "Futu" ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20" :
                              item.broker === "IB" ? "bg-amber-950/40 text-amber-400 border border-amber-500/20" :
                              item.broker === "HSBC" ? "bg-red-950/40 text-red-400 border border-red-500/20" :
                              "bg-orange-950/40 text-orange-400 border border-orange-500/20" // Binance
                            }`}>
                              {item.broker}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="py-5 px-2 text-right font-mono text-sm text-white/80">
                            {maskVal(item.qty)}
                          </td>

                          {/* Purchase Cost */}
                          <td className="py-5 px-2 text-right font-mono text-sm text-white/80">
                            ${maskVal(item.cost.toFixed(2))}
                          </td>

                          {/* Live Price */}
                          <td className="py-5 px-2 text-right font-mono text-sm text-white">
                            ${maskVal(item.price.toFixed(2))}
                          </td>

                          {/* Market Valuation */}
                          <td className="py-5 px-2 text-right font-mono text-sm font-semibold text-white">
                            ${maskVal(item.marketValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                          </td>

                          {/* Profit / Loss with VOO and QQQ Comparison details */}
                          <td className="py-5 px-3 text-right">
                            <div className="flex flex-col items-end justify-center min-h-[44px]">
                              {assetPeriodReturn === null ? (
                                <span className="text-xs font-mono text-white/30 italic">No Data</span>
                              ) : (
                                <>
                                  <span className={`text-sm font-semibold font-mono flex items-center justify-end gap-0.5 ${isItemPositive ? "text-[#76b900]" : "text-rose-500"}`}>
                                    {isItemPositive ? "+" : ""}${maskVal(item.pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}{" "}
                                    ({isItemPositive ? "+" : ""}{assetPeriodReturn.toFixed(2)}%)
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Extra context informational footer inside the ledger */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-[10px] text-white/30 font-mono gap-2 border-t border-white/5 pt-6">
              <span>LEDGER COMPILATION: FUTU ALL SYSTEM MARGIN • BTC & ETH CRYPTO • HKD TRANSLATED LIVE</span>
              <span>ALL TRADING MARGINS ACTIVE</span>
            </div>

          </div>
        ) : tab === "summary" ? (
          
          /* VIEW 3: SUMMARY PERFORMANCE PAGES (Assets, Cash & Overall Benchmarks) */
          <div className="w-full max-w-4xl flex flex-col gap-8 z-10 transition-all duration-300">
                   {/* Bento Panel 1: Wealth Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card A: Grand Asset Allocation Total */}
              <div className="md:col-span-3 bg-[#0a0a0a] border border-white/10 p-6 sm:p-8 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#76b900] font-mono flex items-center gap-1.5 font-bold mb-2">
                    <Layers className="w-3.5 h-3.5"/> Unified Net Worth
                  </span>
                  <p className="text-3xl sm:text-4xl lg:text-5xl font-normal font-mono text-white tracking-tight mt-1">
                    ${maskVal((
                      portfolioData.reduce((acc, curr) => acc + curr.marketValue, 0) + totalCash + mfTotalAmount
                    ).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                  </p>
                  <p className="text-xs text-white/40 font-mono mt-1">Investments + Mutual funds + Cash</p>
                </div>
                
                {/* Visual Ratio breakdown lines */}
                {(() => {
                  const stockValue = portfolioData.reduce((acc, curr) => acc + curr.marketValue, 0);
                  const totalNetWorth = stockValue + totalCash + mfTotalAmount;
                  const stockPer = totalNetWorth > 0 ? (stockValue / totalNetWorth) * 100 : 0;
                  const mfPer = totalNetWorth > 0 ? (mfTotalAmount / totalNetWorth) * 100 : 0;
                  const cashPer = totalNetWorth > 0 ? (totalCash / totalNetWorth) * 100 : 0;
                  return (
                    <div className="w-full lg:max-w-md space-y-2 lg:border-l lg:border-white/5 lg:pl-6">
                      <div className="flex justify-between font-mono text-[10px] text-white/50">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#76b900] inline-block"/>Stocks: {stockPer.toFixed(0)}%</span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"/>M.Funds: {mfPer.toFixed(0)}%</span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block"/>Cash: {cashPer.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-[#76b900] h-full" 
                          style={{ width: `${stockPer}%` }}
                        />
                        <div 
                          className="bg-purple-500 h-full" 
                          style={{ width: `${mfPer}%` }}
                        />
                        <div 
                          className="bg-cyan-500 h-full" 
                          style={{ width: `${cashPer}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-white/30 font-mono">Current asset allocation weights</p>
                    </div>
                  );
                })()}
              </div>

              {/* Card B: Securities Portfolio totals */}
              <div className="bg-[#090909] border border-white/10 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/45 font-mono flex items-center gap-1.5 mb-2">
                    <Briefcase className="w-3.5 h-3.5 text-white/60"/> Total Equities
                  </span>
                  <p className="text-2xl sm:text-3xl font-light font-mono text-white tracking-tight mt-1">
                    ${maskVal(portfolioData.reduce((acc, curr) => acc + curr.marketValue, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                  </p>
                  <p className="text-xs text-white/40 font-mono mt-1">Total investment value</p>
                </div>
                
                <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-3 font-mono text-[10px]">
                  <span className="text-white/40">Total Cumulative Gain:</span>
                  <span className={`font-semibold ${portfolioData.reduce((acc, curr) => acc + curr.pnl, 0) >= 0 ? "text-[#76b900]" : "text-rose-500"}`}>
                    {portfolioData.reduce((acc, curr) => acc + curr.pnl, 0) >= 0 ? "+" : ""}${maskVal((portfolioData.reduce((acc, curr) => acc + curr.pnl, 0)).toLocaleString(undefined, {minimumFractionDigits: 2}))}
                  </span>
                </div>
              </div>

              {/* Card B2: Mutual Fund summary column */}
              <div className="bg-[#090909] border border-white/10 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-purple-400 font-mono flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-purple-400"/> Mutual Fund
                  </span>
                  <p className="text-2xl sm:text-3xl font-light font-mono text-white tracking-tight mt-1">
                    ${maskVal(mfTotalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                  </p>
                  <p className="text-xs text-white/40 font-mono mt-1">Mutual fund assets</p>
                </div>
                
                <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-3 font-mono text-[10px]">
                  <span className="text-white/40">Unrealized P/L:</span>
                  <span className={`font-semibold ${mfUnrealizedPnL >= 0 ? "text-[#76b900]" : "text-rose-500"}`}>
                    {mfUnrealizedPnL >= 0 ? "+" : ""}${maskVal(mfUnrealizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2}))}
                  </span>
                </div>
              </div>

              {/* Card C: Liquid Cash aggregate */}
              <div className="bg-[#090909] border border-white/10 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/45 font-mono flex items-center gap-1.5 mb-2">
                    <DollarSign className="w-3.5 h-3.5 text-cyan-400"/> Liquid Cash reserves
                  </span>
                  <p className="text-2xl sm:text-3xl font-light font-mono text-white tracking-tight mt-1">
                    ${maskVal(totalCash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                  </p>
                  <p className="text-xs text-white/40 font-mono mt-1">Capital buffers available</p>
                </div>

                <div className="mt-6 border-t border-white/5 pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px]">
                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 px-2 py-1 rounded">
                      <span className="text-white/45">FUTU:</span>
                      <span className="text-cyan-400 font-bold">${maskVal(cashFutu.toLocaleString(undefined, {maximumFractionDigits: 1}))}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 px-2 py-1 rounded">
                      <span className="text-white/45">IB:</span>
                      <span className="text-yellow-400 font-bold">${maskVal(cashIB.toLocaleString(undefined, {maximumFractionDigits: 1}))}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 px-2 py-1 rounded">
                      <span className="text-white/45">HSBC:</span>
                      <span className="text-rose-400 font-bold">${maskVal(cashHSBC.toLocaleString(undefined, {maximumFractionDigits: 1}))}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 px-2 py-1 rounded">
                      <span className="text-white/45">Binance:</span>
                      <span className="text-emerald-400 font-bold">${maskVal(cashBinance.toLocaleString(undefined, {maximumFractionDigits: 1}))}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Bento Panel 2: Liquid Cash Register controls & inputs */}
            <div className="bg-[#090909] border border-white/10 p-6 sm:p-8 rounded-2xl sm:rounded-3xl">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-white/5">
                <div>
                  <h3 className="text-md font-semibold tracking-tight text-white mb-1 flex items-center gap-2">
                    <span className="p-1 bg-white/5 rounded-lg border border-white/10 text-[#76b900]">
                      <Layers className="w-4 h-4"/>
                    </span>
                    Cash Flow Ledger & Regulator
                  </h3>
                  <p className="text-xs text-white/45 font-mono uppercase tracking-wider">Dynamic cash in / out calculator - completely isolated from equities P/L performance</p>
                </div>
                <div className="text-[10px] font-mono text-white/30 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <span>BASE LIQUID CASH Today:</span>
                  <span className="text-white/60 font-bold bg-white/5 px-2 py-0.5 rounded">FUTU $8,561.80 | IB $26.40 | HSBC $0.00 | Binance $0.00</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* FLOW REGULATOR FORM */}
                <form onSubmit={handleAddCashRecord} className="lg:col-span-5 space-y-4 bg-white/[0.01] border border-white/5 p-5 rounded-xl">
                  <h4 className="text-xs font-mono uppercase text-[#76b900] tracking-wider font-bold mb-2">Record Capital Flow</h4>
                  
                  {/* Flow Type Toggle & Broker Selector in same small layout */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Flow Type */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase text-white/40">Flow Type</label>
                      <div className="flex bg-white/5 border border-white/10 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setFlowType("IN")}
                          className={`flex-1 py-1 text-[9px] font-mono font-bold tracking-wider rounded ${
                            flowType === "IN" 
                              ? "bg-[#76b900]/20 text-[#76b900] border border-[#76b900]/30" 
                              : "text-white/50 hover:text-white"
                          }`}
                        >
                          CASH IN
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlowType("OUT")}
                          className={`flex-1 py-1 text-[9px] font-mono font-bold tracking-wider rounded ${
                            flowType === "OUT" 
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" 
                              : "text-white/50 hover:text-white"
                          }`}
                        >
                          CASH OUT
                        </button>
                      </div>
                    </div>

                    {/* Broker Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase text-white/40">Account/Broker</label>
                      <div className="grid grid-cols-2 gap-1 bg-white/5 border border-white/10 p-1 rounded-lg">
                        {(["FUTU", "IB", "HSBC", "BINANCE"] as const).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setFlowBroker(b)}
                            className={`py-1 text-[8px] font-mono font-bold tracking-wider rounded transition-all ${
                              flowBroker === b 
                                ? "bg-[#76b900]/20 text-[#76b900] border border-[#76b900]/30" 
                                : "text-white/50 hover:text-white"
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Flow Amount */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40 flex justify-between">
                      <span>Amount</span>
                      <span className="text-white/50 italic">USD</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-white/40 text-xs font-mono">$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={flowAmount}
                        onChange={(e) => setFlowAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#76b900] pl-7 pr-3 py-1.5 text-xs text-white font-mono rounded-lg outline-none w-full transition-all"
                      />
                    </div>
                  </div>

                  {/* Flow Date */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40">Date</label>
                    <input
                      type="date"
                      required
                      value={flowDate}
                      onChange={(e) => setFlowDate(e.target.value)}
                      className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#76b900] px-3 py-1.5 text-xs text-white font-mono rounded-lg outline-none w-full transition-all"
                    />
                  </div>

                  {/* Flow Note */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40">Memo / Note</label>
                    <input
                      type="text"
                      value={flowNote}
                      onChange={(e) => setFlowNote(e.target.value)}
                      placeholder="Salary, interest, stock purchase, etc."
                      className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#76b900] px-3 py-1.5 text-xs text-white rounded-lg outline-none w-full transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#76b900] hover:bg-[#85cd00] text-black text-xs font-bold font-mono py-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#76b900]/10 border-0"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    Record Ledger Entry
                  </button>
                </form>

                {/* HISTORICAL LEDGER ENTRIES */}
                <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-4">
                  <div>
                    <h4 className="text-xs font-mono uppercase text-white/50 tracking-white flex items-center gap-1.5 font-bold mb-3">
                      <History className="w-3.5 h-3.5 text-white/40" /> Ledger Chronicles
                    </h4>
                    
                    <div className="border border-white/10 bg-[#060606] rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                      {unifiedChronicles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                          <p className="text-xs font-mono text-white/30 italic mb-1">No dynamic cash flows cataloged.</p>
                          <p className="text-[9px] text-white/20">Any deposits (Cash In) or withdrawals (Cash Out) recorded here dynamically update liquid cash pools.</p>
                        </div>
                      ) : (
                        <table className="w-full font-mono text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02] text-[8px] uppercase tracking-wider text-white/45">
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Broker</th>
                              <th className="py-2.5 px-3">Note</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                              <th className="py-2.5 px-3"></th>
                            </tr>
                          </thead>
                          <tbody className="text-[10px] divide-y divide-white/5">
                            {unifiedChronicles.map((rec) => {
                              const isCashIncrease = rec.type === "IN" || rec.type === "SELL";
                              return (
                                <tr key={`${rec.isMf ? "mf" : "cash"}-${rec.id}`} className="hover:bg-white/[0.01] transition-colors">
                                  <td className="py-2 px-3 text-white/50">{rec.date}</td>
                                  <td className="py-2 px-3">
                                    {rec.isMf ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${rec.type === "BUY" ? "bg-purple-500/10 text-purple-300 border border-purple-500/20" : "bg-amber-500/10 text-amber-300 border border-amber-500/20"}`}>
                                        {rec.type === "BUY" ? "MF BUY" : "MF SELL"}
                                      </span>
                                    ) : (
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${isCashIncrease ? "bg-[#76b900]/10 text-[#76b900] border border-[#76b900]/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                                        {rec.type === "IN" ? "CASH IN" : "CASH OUT"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium border ${
                                      rec.broker === "FUTU" 
                                        ? "bg-cyan-950/20 text-cyan-400 border-cyan-500/20" 
                                        : rec.broker === "IB" 
                                        ? "bg-yellow-950/20 text-yellow-400 border-yellow-500/20"
                                        : rec.broker === "HSBC"
                                        ? "bg-rose-950/20 text-rose-400 border-rose-500/20"
                                        : "bg-emerald-950/20 text-emerald-400 border-emerald-500/20"
                                    }`}>
                                      {rec.broker}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 max-w-[120px] truncate text-white/60" title={rec.note || "--"}>
                                    {rec.note || <span className="text-white/20 italic">No memo</span>}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-bold ${isCashIncrease ? "text-[#76b900]" : "text-rose-400"}`}>
                                    {isCashIncrease ? "+" : "-"}${rec.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUnifiedEntry(rec.id, rec.isMf)}
                                      className="text-white/30 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-all cursor-pointer border-0"
                                      title={rec.isMf ? "Delete MF Order" : "Delete Cash Entry"}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Cash Register stats metrics */}
                  <div className="border border-white/5 bg-white/[0.01] p-3 rounded-xl grid grid-cols-3 gap-2 font-mono text-[9px]">
                    <div className="flex flex-col justify-center border-r border-white/5 pl-1.5">
                      <span className="text-white/40 uppercase">Total Cash Inflows:</span>
                      <strong className="text-[#76b900] text-xs mt-0.5">
                        ${(futuIn + ibIn + hsbcIn + binanceIn).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </strong>
                    </div>
                    <div className="flex flex-col justify-center border-r border-white/5 pl-1.5">
                      <span className="text-white/40 uppercase">Total Outflows:</span>
                      <strong className="text-rose-400 text-xs mt-0.5">
                        ${(futuOut + ibOut + hsbcOut + binanceOut).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </strong>
                    </div>
                    <div className="flex flex-col justify-center pl-1.5">
                      <span className="text-white/40 uppercase">Net Flow Delta:</span>
                      <strong className={`text-xs mt-0.5 ${((futuIn + ibIn + hsbcIn + binanceIn) - (futuOut + ibOut + hsbcOut + binanceOut)) >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                        {((futuIn + ibIn + hsbcIn + binanceIn) - (futuOut + ibOut + hsbcOut + binanceOut)) >= 0 ? "+" : ""}${((futuIn + ibIn + hsbcIn + binanceIn) - (futuOut + ibOut + hsbcOut + binanceOut)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </strong>
                    </div>
                  </div>

                </div>
              </div>
            </div>



          </div>
        ) : tab === "mutual" ? (
          <div className="w-full max-w-4xl flex flex-col gap-8 z-10 transition-all duration-300 animate-fadeIn">
            
            {/* Wealth Display Metrics Card */}
            <div className="bg-[#090909] border border-white/10 p-6 sm:p-8 rounded-2xl sm:rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-white flex items-center gap-2.5">
                  <span className="p-1.5 bg-white/5 rounded-xl border border-white/10 text-purple-400">
                    <Layers className="w-5 h-5"/>
                  </span>
                  Mutual Fund Holdings
                </h2>
                <p className="text-xs text-white/40 tracking-wider uppercase font-mono mt-1.5">Whole asset mutual fund summary performance indicator</p>
              </div>

              {/* Amount 11,906.35 USD & Unrealized P/L & Realized P/L */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-6 bg-white/5 border border-white/10 p-5 rounded-2xl w-full md:w-auto">
                {/* Total amount of mutual fund */}
                <div className="flex flex-col min-w-[150px]">
                  <span className="text-[9px] uppercase tracking-widest text-[#76b900] font-mono font-bold">Total Valuation</span>
                  <span className="text-3xl font-light font-mono text-white mt-1">
                    ${maskVal(mfTotalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                  </span>
                  <span className="text-[10px] text-white/30 font-mono mt-0.5">USD Total Value</span>
                </div>

                <div className="hidden sm:block w-[1px] h-12 bg-white/10"></div>

                {/* Unrealized P/L of mutual fund */}
                <div className="flex flex-col min-w-[150px]">
                  <span className="text-[9px] uppercase tracking-widest text-purple-400 font-mono font-bold">Unrealized P/L</span>
                  <span className={`text-3xl font-semibold font-mono mt-1 ${mfUnrealizedPnL >= 0 ? "text-[#76b900]" : "text-rose-500"}`}>
                    {mfUnrealizedPnL >= 0 ? "+" : ""}${maskVal(mfUnrealizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono mt-0.5">
                    {(() => {
                      const basis = mfTotalAmount - mfUnrealizedPnL;
                      const growth = basis > 0 ? (mfUnrealizedPnL / basis) * 100 : 0;
                      return `${growth >= 0 ? "+" : ""}${growth.toFixed(2)}% net returns`;
                    })()}
                  </span>
                </div>

                <div className="hidden sm:block w-[1px] h-12 bg-white/10"></div>

                {/* Realized P/L of mutual fund */}
                <div className="flex flex-col min-w-[150px]">
                  <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-mono font-bold">Realized P/L</span>
                  <span className={`text-3xl font-semibold font-mono mt-1 ${mfTotalRealizedPnL >= 0 ? "text-[#76b900]" : "text-rose-500"}`}>
                    {mfTotalRealizedPnL >= 0 ? "+" : ""}${maskVal(mfTotalRealizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono mt-0.5">
                    Redemption Profits
                  </span>
                </div>
              </div>
            </div>

            {/* Input Ledger for Mutual Funds (allow input amount, buy/sell type, and realized gain/loss, no ticker indices) */}
            <div className="bg-[#090909] border border-white/10 p-6 sm:p-8 rounded-2xl sm:rounded-3xl">
              <div className="mb-6 pb-6 border-b border-white/5">
                <h3 className="text-md font-semibold tracking-tight text-white mb-1 flex items-center gap-2">
                  <span className="p-1 bg-white/5 rounded-lg border border-white/10 text-[#76b900]">
                    <Database className="w-4 h-4"/>
                  </span>
                  Mutual Fund Buy/Sell Ledger
                </h3>
                <p className="text-xs text-white/45 font-mono uppercase tracking-wider">Record buy/sell operations with custom realized earnings logs to dynamically recalibrate baseline values</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* FORM PANEL FOR TRANSACTION ENTRY */}
                <form onSubmit={handleAddMfTransaction} className="lg:col-span-5 space-y-4 bg-white/[0.01] border border-white/5 p-5 rounded-xl">
                  <h4 className="text-xs font-mono uppercase text-[#76b900] tracking-wider font-bold mb-2">Record Transaction</h4>

                  {/* Transaction Type */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40">Transaction Type</label>
                    <div className="flex bg-white/5 border border-white/10 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setMfFormType("BUY")}
                        className={`flex-1 py-1 text-[9px] font-mono font-bold tracking-wider rounded transition-all ${
                          mfFormType === "BUY" 
                            ? "bg-[#76b900]/20 text-[#76b900] border border-[#76b900]/30" 
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        BUY (Add Funds)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMfFormType("SELL")}
                        className={`flex-1 py-1 text-[9px] font-mono font-bold tracking-wider rounded transition-all ${
                          mfFormType === "SELL" 
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        SELL (Redeem)
                      </button>
                    </div>
                  </div>

                  {/* Bank / Broker Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40">Bank / Broker Account</label>
                    <select
                      value={mfFormBroker}
                      onChange={(e) => setMfFormBroker(e.target.value as any)}
                      className="bg-[#121212] border border-white/10 hover:border-white/20 focus:border-[#76b900] px-3 py-1.5 text-xs text-white font-mono rounded-lg outline-none w-full transition-all appearance-none cursor-pointer"
                    >
                      <option value="FUTU" className="bg-[#121212] text-white">FUTU Brokerage</option>
                      <option value="IB" className="bg-[#121212] text-white">Interactive Brokers (IB)</option>
                      <option value="HSBC" className="bg-[#121212] text-white">HSBC Bank</option>
                      <option value="BINANCE" className="bg-[#121212] text-white">Binance Account</option>
                    </select>
                  </div>

                  {/* Transaction Amount */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40 flex justify-between">
                      <span>Transaction Amount</span>
                      <span className="text-white/50 italic font-mono uppercase">USD</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-white/40 text-xs font-mono">$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={mfFormAmount}
                        onChange={(e) => setMfFormAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#76b900] pl-7 pr-3 py-1.5 text-xs text-white font-mono rounded-lg outline-none w-full transition-all"
                      />
                    </div>
                  </div>

                  {/* Realized Gain / Loss (Show ONLY when SELL is selected) */}
                  {mfFormType === "SELL" && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase text-white/40 flex justify-between">
                        <span>Realized Gain / (Loss)</span>
                        <span className="text-purple-400 font-bold font-mono">PnL Impact</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-white/40 text-xs font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={mfFormPnL}
                          onChange={(e) => setMfFormPnL(e.target.value)}
                          placeholder="e.g. +500.00 or -200.00"
                          className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#76b900] pl-7 pr-3 py-1.5 text-xs text-white font-mono rounded-lg outline-none w-full transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Transaction Date */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40">Date</label>
                    <input
                      type="date"
                      required
                      value={mfFormDate}
                      onChange={(e) => setMfFormDate(e.target.value)}
                      className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#76b900] px-3 py-1.5 text-xs text-white font-mono rounded-lg outline-none w-full transition-all"
                    />
                  </div>

                  {/* Memo Note */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-white/40">Memo / Note</label>
                    <input
                      type="text"
                      value={mfFormNote}
                      onChange={(e) => setMfFormNote(e.target.value)}
                      placeholder="e.g. Subscription adjustment, liquidation, dividend re-investment"
                      className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#76b900] px-3 py-1.5 text-xs text-white rounded-lg outline-none w-full transition-all font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#76b900] hover:bg-[#85cd00] text-black text-xs font-bold font-mono py-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#76b900]/10 border-0"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    Record Ledger Entry
                  </button>
                </form>

                {/* TRANSACTION LEDGER CHRONICLES */}
                <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-4">
                  <div>
                    <h4 className="text-xs font-mono uppercase text-white/50 tracking-white flex items-center gap-1.5 font-bold mb-3">
                      <History className="w-3.5 h-3.5 text-white/40" /> Ledger Chronicles
                    </h4>
                    
                    <div className="border border-white/10 bg-[#060606] rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                      {mfTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                          <p className="text-xs font-mono text-white/30 italic mb-1">No custom Mutual Fund trades recorded yet.</p>
                          <p className="text-[9px] text-white/20">The base valuation begins at $11,906.35 USD with +$7,261.62 USD unrealized profit. Add elements here to model additional buys or sales.</p>
                        </div>
                      ) : (
                        <table className="w-full font-mono text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02] text-[8px] uppercase tracking-wider text-white/45">
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Account</th>
                              <th className="py-2.5 px-3">Note</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                              <th className="py-2.5 px-3 text-right">Realized P/L</th>
                              <th className="py-2.5 px-3"></th>
                            </tr>
                          </thead>
                          <tbody className="text-[10px] divide-y divide-white/5">
                            {mfTransactions.map((rec) => {
                              const isBuy = rec.type === "BUY";
                              return (
                                <tr key={rec.id} className="hover:bg-white/[0.01] transition-colors">
                                  <td className="py-2 px-3 text-white/50">{rec.date}</td>
                                  <td className="py-2 px-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${isBuy ? "bg-[#76b900]/10 text-[#76b900] border border-[#76b900]/20" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"}`}>
                                      {rec.type}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-purple-300 font-bold">{rec.broker || "HSBC"}</td>
                                  <td className="py-2 px-3 max-w-[150px] truncate text-white/60" title={rec.note || "--"}>
                                    {rec.note || <span className="text-white/20 italic">No memo</span>}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-semibold ${isBuy ? "text-[#76b900]" : "text-white/85"}`}>
                                    ${rec.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-bold ${!isBuy && rec.realizedPnL >= 0 ? "text-[#76b900]" : !isBuy && rec.realizedPnL < 0 ? "text-rose-400" : "text-white/20"}`}>
                                    {isBuy ? "--" : `${rec.realizedPnL >= 0 ? "+" : ""}$${rec.realizedPnL.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMfTransaction(rec.id)}
                                      className="text-white/30 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-all cursor-pointer border-0"
                                      title="Delete Entry"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Ledger Metrics */}
                  <div className="border border-white/5 bg-white/[0.01] p-3 rounded-xl grid grid-cols-2 gap-2 font-mono text-[9px]">
                    <div className="flex flex-col justify-center border-r border-white/5 pl-1.5">
                      <span className="text-white/40 uppercase">Total Buy Subs:</span>
                      <strong className="text-[#76b900] text-xs mt-0.5">
                        ${mfTransactions.filter(t => t.type === "BUY").reduce((acc, t) => acc + t.amount, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </strong>
                    </div>
                    <div className="flex flex-col justify-center pl-1.5">
                      <span className="text-white/40 uppercase">Total Redemptions:</span>
                      <strong className="text-purple-400 text-xs mt-0.5">
                        ${mfTransactions.filter(t => t.type === "SELL").reduce((acc, t) => acc + t.amount, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </strong>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="border border-white/5 bg-white/[0.02] p-5 rounded-2xl text-xs text-white/45 flex flex-col gap-2 font-mono">
              <span className="text-[#76b900]/90 uppercase font-bold tracking-wider">Baseline Ledger Calibration Notes</span>
              <p>
                - The Mutual Fund is maintained as a consolidated wealth element with a baseline value of <strong>$11,906.35 USD</strong> and <strong>+$7,261.62 USD</strong> unrealized gain (P/L).
              </p>
              <p>
                - Purchasing more funds additions adds directly to your asset valuation, and selling removes funds.
              </p>
              <p>
                - Selling events allow specifying custom realized gain/losses to adjust the overall historical P/L curve metrics. No product list, ticker names, quantities or price indices are captured for simplicity.
              </p>
            </div>

          </div>
        ) : (
          <TradeHistoryView
            portfolioData={portfolioData}
            cashRecords={cashRecords}
            setCashRecords={setCashRecords}
            tradeRecords={tradeRecords}
            setTradeRecords={setTradeRecords}
          />
        )}

      </div>

      {/* Unified Action Footer / Control Strip */}
      <footer className="w-full h-auto sm:h-24 px-6 sm:px-12 py-6 sm:py-0 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto bg-black/40 backdrop-blur-md z-20">
        
        {/* Timing and engine details */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-white/30 flex items-center gap-1.5 justify-center sm:justify-start">
              <Clock className="w-2.5 h-2.5" /> Source Timestamp
            </span>
            <span className="text-xs font-mono text-white/60">
              {nvdaData ? new Date(nvdaData.updatedAt).toLocaleDateString() + " — " + new Date(nvdaData.updatedAt).toLocaleTimeString() : "--/--/---- --:--:--"}
            </span>
          </div>
          
          <div className="hidden sm:block h-8 w-[1px] bg-white/10"></div>
          
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-white/30 flex items-center gap-1.5 justify-center sm:justify-start">
              <Database className="w-2.5 h-2.5" /> Source Engine
            </span>
            <span className="text-xs font-mono text-[#76b900]/70 uppercase">
              yahoo-finance2 • node-api
            </span>
          </div>
        </div>

        {/* Real-time Indicator and Action Button */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-end">
          <div className="px-4 py-2 border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-3 select-none">
            <div className="w-2 h-2 rounded-full bg-[#76b900] animate-pulse"></div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/80">
              Quotes Uncached
            </span>
          </div>

          <button
            id="refresh-btn"
            onClick={() => fetchAllData(false)}
            disabled={loading || isRefreshing}
            className="px-6 py-3 bg-white text-black text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-[#76b900] hover:text-black transition-all duration-150 cursor-pointer disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:ring-offset-2 focus:ring-offset-black"
          >
            {isRefreshing && <RefreshCw className="h-3 w-3 animate-spin text-black" />}
            Refresh Quote
          </button>
        </div>

      </footer>
    </div>
  );
}
