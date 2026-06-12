import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import yahooFinance from "yahoo-finance2";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware
  app.use(express.json());

  // Prevent browser & API caching so refreshed demands are always fetched new from Yahoo Finance
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // API Route to fetch latest dynamic stock price
  app.get("/api/stock/:symbol", async (req, res) => {
    try {
      const symbol = (req.params.symbol || "NVDA").toUpperCase();
      // Query quote details for the requested symbol
      const quote: any = await yahooFinance.quote(symbol);
      
      if (!quote) {
        return res.status(404).json({ error: `${symbol} stock data could not be retrieved from Yahoo Finance.` });
      }

      const responseData = {
        symbol: symbol,
        name: quote.longName || quote.shortName || symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        marketCap: quote.marketCap || 0,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        open: quote.regularMarketOpen || 0,
        previousClose: quote.regularMarketPreviousClose || 0,
        volume: quote.regularMarketVolume || 0,
        currency: quote.currency || "USD",
        updatedAt: quote.regularMarketTime 
          ? new Date(quote.regularMarketTime).toISOString() 
          : new Date().toISOString(),
      };

      res.json(responseData);
    } catch (error: any) {
      console.error(`Error fetching ${req.params.symbol} from Yahoo Finance:`, error);
      res.status(500).json({ 
        error: error?.message || `Failed to fetch ${req.params.symbol} stock information from Yahoo Finance.` 
      });
    }
  });

  // API Route to fetch portfolio stock details (TSLA, AMD, GOOGL, or any custom query symbols)
  app.get("/api/portfolio", async (req, res) => {
    try {
      const querySymbols = req.query.symbols ? (req.query.symbols as string).split(",") : [];
      const defaultSymbols = [
        "AMD", "CRWV", "EQT", "FLJH", "FMCC", "GOOGL", "BTC-USD", "ETH-USD", 
        "GRAB", "HIMS", "MSFT", "NBIS", "NOW", "ORCL", "PLTR", "QQQM", "ROKT", 
        "SOFI", "TSLA", "VOO", "QQQ", "1810.HK", "9999.HK"
      ];
      // Combine and filter unique uppercase tickers
      const symbols = Array.from(new Set([...defaultSymbols, ...querySymbols]))
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const quote: any = await yahooFinance.quote(symbol);
            return {
              symbol,
              name: quote?.longName || quote?.shortName || symbol,
              price: quote?.regularMarketPrice || 0,
              change: quote?.regularMarketChange || 0,
              changePercent: quote?.regularMarketChangePercent || 0,
            };
          } catch (e: any) {
            console.error(`Error fetching individual portfolio item ${symbol}:`, e);
            return {
              symbol,
              name: symbol,
              price: 0,
              change: 0,
              changePercent: 0,
              error: true,
            };
          }
        })
      );
      res.json(results);
    } catch (error: any) {
      console.error("Error fetching portfolio from Yahoo Finance:", error);
      res.status(500).json({
        error: error?.message || "Failed to fetch portfolio details from Yahoo Finance."
      });
    }
  });

  // Store in-memory cache for historical performance ratios to remain lightning-fast and responsive
  let performanceCache: {
    timestamp: number;
    data: Record<string, Record<string, number | null>>;
  } | null = null;
  const PERF_CACHE_DURATION = 15 * 60 * 1000; // 15 mins

  app.get("/api/performance", async (req, res) => {
    try {
      const querySymbols = req.query.symbols ? (req.query.symbols as string).split(",") : [];
      const defaultSymbols = [
        "AMD", "CRWV", "EQT", "FLJH", "FMCC", "GOOGL", "BTC-USD", "ETH-USD", 
        "GRAB", "HIMS", "MSFT", "NBIS", "NOW", "ORCL", "PLTR", "QQQM", "ROKT", 
        "SOFI", "TSLA", "VOO", "QQQ", "1810.HK", "9999.HK"
      ];
      const symbols = Array.from(new Set([...defaultSymbols, ...querySymbols]))
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      const now = Date.now();
      // Only use cache if the requested set of symbols is exactly the default set
      const isDefaultSet = symbols.length === defaultSymbols.length && symbols.every(s => defaultSymbols.includes(s));
      if (isDefaultSet && performanceCache && (now - performanceCache.timestamp < PERF_CACHE_DURATION)) {
        return res.json(performanceCache.data);
      }

      const periods = ["1M", "6M", "YTD", "1Y", "ALL"];
      const currentDate = new Date();
      
      const targetDates: Record<string, Date> = {
        "1M": new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate()),
        "6M": new Date(currentDate.getFullYear(), currentDate.getMonth() - 6, currentDate.getDate()),
        "YTD": new Date(currentDate.getFullYear(), 0, 1),
        "1Y": new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate()),
        "ALL": new Date(currentDate.getFullYear() - 8, currentDate.getMonth(), currentDate.getDate()),
      };

      const results: Record<string, Record<string, number | null>> = {};

      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            // Fetch historical daily quotes using the direct chart API starting from oldest required period (ALL is 8 years ago)
            const chartResult: any = await yahooFinance.chart(symbol, {
              period1: targetDates["ALL"],
              interval: "1d",
            });

            const rawQuotes = chartResult?.quotes || [];
            // Filter out quotes that don't have valid close/adjclose prices
            const quotes = rawQuotes.filter(
              (q) => q && (typeof q.close === "number" || typeof q.adjclose === "number")
            );

            if (quotes.length === 0) {
              results[symbol] = { "1M": null, "6M": null, "YTD": null, "1Y": null, "ALL": null };
              return;
            }

            // Find latest available close price
            const lastQuote = quotes[quotes.length - 1];
            const endPrice = lastQuote.close ?? lastQuote.adjclose ?? 0;

            if (endPrice === 0) {
              results[symbol] = { "1M": null, "6M": null, "YTD": null, "1Y": null, "ALL": null };
              return;
            }

            const pLevels: Record<string, number | null> = {};

            periods.forEach((period) => {
              const targetTime = targetDates[period].getTime();

              // Search the closest trading quote
              let closest = quotes[0];
              let minDiff = Math.abs(new Date(closest.date).getTime() - targetTime);

              for (const q of quotes) {
                const qTime = new Date(q.date).getTime();
                const diff = Math.abs(qTime - targetTime);
                if (diff < minDiff) {
                  minDiff = diff;
                  closest = q;
                }
              }

              const startPrice = closest ? (closest.close ?? closest.adjclose ?? 0) : 0;
              if (startPrice > 0) {
                const gain = ((endPrice - startPrice) / startPrice) * 100;
                pLevels[period] = parseFloat(gain.toFixed(2));
              } else {
                pLevels[period] = null;
              }
            });

            results[symbol] = pLevels;
          } catch (e) {
            console.error(`Error calculating historical indices for ${symbol}:`, e);
            results[symbol] = { "1M": null, "6M": null, "YTD": null, "1Y": null, "ALL": null };
          }
        })
      );

      // Save into cache object
      performanceCache = {
        timestamp: now,
        data: results
      };

      res.json(results);
    } catch (err: any) {
      console.error("General error serving performance telemetry:", err);
      res.status(500).json({ error: err?.message || "Failed to load period comparison index" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
