import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import axiosRetry from "axios-retry";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Address } from "@ton/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("cache.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    expiry INTEGER
  )
`);

const app = express();
const PORT = 3000;

// Configure axios-retry — do NOT retry 429 (retrying makes rate limiting worse)
// Only retry on network failures and 5xx server errors
axiosRetry(axios, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    if (error.response?.status === 429) return false; // never retry rate limit
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ?? 0) >= 500;
  },
});

// In-flight deduplication — if two identical requests arrive simultaneously,
// they share one promise instead of hitting the API twice
const pendingRequests = new Map<string, Promise<any>>();
const dedupeRequest = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  if (pendingRequests.has(key)) return pendingRequests.get(key)!;
  const promise = fn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
};

app.use(express.json());

// Cache helper
// Use TONAPI key if provided — free tier: ~1 req/s, with key: ~10 req/s
const TONAPI_HEADERS = process.env.TONAPI_KEY
  ? { Authorization: `Bearer ${process.env.TONAPI_KEY}` }
  : {};

const getCache = (key: string) => {
  const row = db.prepare("SELECT value, expiry FROM cache WHERE key = ?").get(key) as { value: string, expiry: number } | undefined;
  if (row && row.expiry > Date.now()) {
    return JSON.parse(row.value);
  }
  return null;
};

const setCache = (key: string, value: any, ttlSeconds: number) => {
  const expiry = Date.now() + ttlSeconds * 1000;
  db.prepare("INSERT OR REPLACE INTO cache (key, value, expiry) VALUES (?, ?, ?)").run(key, JSON.stringify(value), expiry);
};

// TON Address Formatter
const formatTonAddress = (addr: string) => {
  if (!addr || addr === "N/A" || !addr.includes(':')) return addr;
  try {
    return Address.parse(addr).toString({ bounceable: true, testOnly: false });
  } catch (e) {
    return addr;
  }
};

// Address Detection
const detectNetwork = (address: string) => {
  const addr = address.trim();
  if (addr.toLowerCase().endsWith('.ton')) return "ton";
  if (addr.toLowerCase().endsWith('.t.me')) return "ton";
  if (addr.startsWith('@')) return "ton";
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return "ethereum";
  if (/^T[a-zA-Z0-9]{33}$/.test(addr)) return "tron";
  if (/^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(addr)) return "bitcoin";
  if (/^[a-zA-Z0-9_-]{48}$/.test(addr)) return "ton";
  return "unknown";
};

// Personality & Risk Analysis
const analyzePersonality = (data: any) => {
  const txCount = data.transactions.length;
  const nftCount = data.nfts?.length || 0;
  const tokenCount = data.tokens?.length || 0;
  const balance = parseFloat(data.balance);
  
  let personality = "Casual User";
  let riskScore = 0; // 0-100
  let tags = [];

  if (txCount > 100) { personality = "Active Trader"; tags.push("High Activity"); }
  if (nftCount > 10) { personality = "NFT Collector"; tags.push("Art Lover"); }
  if (balance > 1000) { personality = "Whale"; tags.push("Deep Pockets"); }
  if (tokenCount > 5) { personality = "DeFi Explorer"; tags.push("Diversified"); }
  if (txCount < 5) { personality = "Newcomer"; tags.push("Fresh Wallet"); }

  // Simple risk heuristic
  const scamTxs = data.transactions.filter((tx: any) => tx.isScam || (tx.comment && /scam|spam|win|prize|claim/i.test(tx.comment)));
  if (scamTxs.length > 0) riskScore += 20;
  if (data.stats?.status === "uninit") riskScore += 5;
  
  return { personality, riskScore, tags };
};

// Shared price cache helper — all wallet handlers use this instead of direct CoinGecko calls
const PRICE_TTL = 120; // seconds
const getCachedPrice = async (coinId: string): Promise<number> => {
  const cacheKey = `price_${coinId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached.usd;

  const idMap: Record<string, string> = {
    "the-open-network": "the-open-network",
    "bitcoin": "bitcoin",
    "ethereum": "ethereum",
    "tron": "tron",
  };
  const response = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price?ids=${idMap[coinId] || coinId}&vs_currencies=usd`,
    { timeout: 5000 }
  );
  const priceUsd: number = response.data[coinId]?.usd ?? 0;
  setCache(cacheKey, { usd: priceUsd }, PRICE_TTL);
  return priceUsd;
};

// API Routes
app.get("/api/detect/:address", (req, res) => {
  const network = detectNetwork(req.params.address);
  res.json({ network });
});

app.get("/api/price/ton", async (req, res) => {
  try {
    // Reuse shared price cache
    const priceUsd = await getCachedPrice("the-open-network");
    const cacheKey = "price_the-open-network";
    const cached = getCache(cacheKey);
    // Return the same shape the frontend expects (includes usd + 24h change if available)
    const cacheKeyLegacy = "ton_price_legacy";
    const cachedLegacy = getCache(cacheKeyLegacy);
    if (cachedLegacy) return res.json(cachedLegacy);

    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true",
      { timeout: 5000 }
    );
    const data = response.data["the-open-network"];
    setCache(cacheKeyLegacy, data, PRICE_TTL);
    setCache("price_the-open-network", { usd: data.usd }, PRICE_TTL);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch price" });
  }
});

app.get("/api/wallet/:network/:address", async (req, res) => {
  let { network, address } = req.params;
  
  // Resolve TON DNS if needed
  const isDns = address.toLowerCase().endsWith('.ton') || 
                address.toLowerCase().endsWith('.t.me') || 
                address.startsWith('@');
                
  if (network === "ton" && isDns) {
    const dnsCacheKey = `dns_resolve_${address.toLowerCase()}`;
    const cachedAddr = getCache(dnsCacheKey);
    if (cachedAddr) {
      address = cachedAddr;
    } else {
      try {
        let searchName = address.toLowerCase();
        if (searchName.startsWith('@')) {
          searchName = searchName.slice(1) + '.t.me';
        }
        
        // Use a more reliable DNS resolution method with timeout
        const dnsRes = await axios.get(`https://tonapi.io/v2/dns/${searchName}/resolve`, { timeout: 5000, headers: TONAPI_HEADERS });
        // The resolve endpoint returns a wallet object if it's a wallet
        const resolved = dnsRes.data?.wallet?.address || dnsRes.data?.address;
        
        if (resolved) {
          setCache(dnsCacheKey, resolved, 3600);
          address = resolved;
        } else {
          // Fallback: try to search for the domain as an account
          const searchRes = await axios.get(`https://tonapi.io/v2/accounts/${searchName}`, { timeout: 5000, headers: TONAPI_HEADERS });
          if (searchRes.data?.address) {
            address = searchRes.data.address;
          }
        }
      } catch (e) {
        console.error(`DNS Resolve failed for ${address}:`, e.message);
      }
    }
  }

  const cacheKey = `wallet_${network}_${address}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Dedupe: if same address is requested simultaneously, share the one in-flight fetch
    const result = await dedupeRequest(cacheKey, () => fetchWalletData(network, address, cacheKey));
    return res.json(result);
  } catch (error: any) {
    console.error(`Wallet fetch error (${network}):`, error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.message || "Failed to fetch wallet data";
    return res.status(status).json({ error: message });
  }
});

// Extracted fetch logic so dedupeRequest can wrap it cleanly
async function fetchWalletData(network: string, address: string, cacheKey: string): Promise<any> {
  try {
    let data: any = {
      address,
      balance: "0",
      usdValue: 0,
      transactions: [],
      stats: { totalReceived: "0", totalSent: "0", txCount: 0, firstTx: "N/A", lastTx: "N/A" },
      tokens: []
    };

    if (network === "ton") {
      // ONLY 2 real requests: account + events (price from shared cache, nfts lazy-loaded separately)
      const [accountRes, eventsRes, price] = await Promise.all([
        axios.get(`https://tonapi.io/v2/accounts/${address}`, { timeout: 8000, headers: TONAPI_HEADERS }),
        axios.get(`https://tonapi.io/v2/accounts/${address}/events?limit=100`, { timeout: 8000, headers: TONAPI_HEADERS }),
        getCachedPrice("the-open-network")  // 0 extra requests if fetched within 2 min
      ]);

      const account = accountRes.data;
      const myAddress = account.address;
      const currentBalanceNano = BigInt(account.balance);
      const balance = (Number(currentBalanceNano) / 1e9).toFixed(2);

      let allEvents: any[] = [];
      const eventIds = new Set<string>();
      try {
        for (const e of (eventsRes.data.events || [])) {
          if (!eventIds.has(e.event_id)) {
            allEvents.push(e);
            eventIds.add(e.event_id);
          }
        }
      } catch (e) {
        console.error("Error processing events:", e.message);
      }

      let totalReceivedNano = 0n;
      let totalSentNano = 0n;
      let maxBalanceNano = currentBalanceNano;
      let runningBalanceNano = currentBalanceNano;
      
      // Calculate real stats by summing actual transfers
      // Sort events by LT descending (newest first) to accurately reconstruct history
      allEvents.sort((a, b) => (b.lt || 0) - (a.lt || 0));

      for (const event of allEvents) {
        // Summing transfers for Received/Sent stats
        event.actions.forEach((action: any) => {
          if (action.type === "TonTransfer") {
            const t = action.TonTransfer;
            const amount = BigInt(t.amount);
            if (t.recipient.address === myAddress) {
              totalReceivedNano += amount;
            } else if (t.sender.address === myAddress) {
              totalSentNano += amount;
            }
          }
        });

        // For Max Balance, we reconstruct history backwards
        const change = BigInt(event.extra || 0);
        const balanceBefore = runningBalanceNano - change;
        
        if (runningBalanceNano > maxBalanceNano) maxBalanceNano = runningBalanceNano;
        if (balanceBefore > maxBalanceNano) maxBalanceNano = balanceBefore;
        
        runningBalanceNano = balanceBefore;
      }

      // NFT map not needed here — nft_item data comes inline from events (NftItemTransfer.nft_item)
      const currentNftsMap = new Map();

      const processedTransactions = (await Promise.all(allEvents.map(async (event: any) => {
        // Filter out purely technical events with no value transfer
        const hasValueTransfer = event.actions.some((a: any) => 
          a.type === "TonTransfer" || 
          a.type === "JettonTransfer" || 
          a.type === "NftItemTransfer" ||
          (a.type === "SmartContractExec" && BigInt(a.SmartContractExec.ton_attached || 0) > 0n)
        );

        if (!hasValueTransfer) return null;

        const action = event.actions.find((a: any) => a.type === "TonTransfer" || a.type === "JettonTransfer" || a.type === "NftItemTransfer") || event.actions[0];
        
        let amount = "0 TON";
        let from = "N/A";
        let fromName = undefined;
        let to = "N/A";
        let toName = undefined;
        let typeLabel = action.type;
        let direction: 'in' | 'out' = 'out';
        let nftInfo = undefined;
        let comment = undefined;
        
        if (action.type === "TonTransfer") {
          const t = action.TonTransfer;
          const amountNano = BigInt(t.amount);
          amount = (Number(amountNano) / 1e9).toFixed(4) + " TON";
          from = formatTonAddress(t.sender.address);
          to = formatTonAddress(t.recipient.address);
          fromName = t.sender.name;
          toName = t.recipient.name;
          // Compare with canonical address from account response
          direction = t.recipient.address === myAddress ? 'in' : 'out';
          comment = t.comment;
        } else if (action.type === "JettonTransfer") {
          const j = action.JettonTransfer;
          amount = (parseInt(j.amount) / Math.pow(10, j.jetton.decimals)).toFixed(2) + " " + j.jetton.symbol;
          from = formatTonAddress(j.sender?.address || "N/A");
          to = formatTonAddress(j.recipient?.address || "N/A");
          fromName = j.sender?.name;
          toName = j.recipient?.name;
          direction = j.recipient?.address === myAddress ? 'in' : 'out';
          comment = j.comment;
        } else if (action.type === "NftItemTransfer") {
          const n = action.NftItemTransfer;
          amount = "NFT Transfer";
          from = formatTonAddress(n.sender?.address || "N/A");
          to = formatTonAddress(n.recipient?.address || "N/A");
          fromName = n.sender?.name;
          toName = n.recipient?.name;
          direction = n.recipient?.address === myAddress ? 'in' : 'out';
          comment = n.comment;
          
          let nftItem = n.nft_item;
          const nftAddress = n.nft;

          if (!nftItem && nftAddress) {
            if (currentNftsMap.has(nftAddress)) {
              nftItem = currentNftsMap.get(nftAddress);
            } else {
              const cacheKey = `nft_meta_${nftAddress}`;
              const cached = getCache(cacheKey);
              if (cached) {
                nftItem = cached;
              } else {
                // Skip fetching metadata for transactions to avoid massive parallel requests
                // We'll just use the address as the name if not cached
              }
            }
          }

          const nftName = nftItem?.metadata?.name || 
                          nftItem?.dns || 
                          (nftItem?.index !== undefined && nftItem?.collection ? `${nftItem.collection.name} #${nftItem.index}` : undefined) ||
                          (nftItem?.index !== undefined ? `NFT #${nftItem.index}` : undefined) ||
                          (nftItem?.address ? `${nftItem.address.slice(0, 4)}...${nftItem.address.slice(-4)}` : 
                           (nftAddress ? `${nftAddress.slice(0, 4)}...${nftAddress.slice(-4)}` : "Unnamed NFT"));

          const isOfficial = nftItem?.collection?.name === "Telegram Usernames" || 
                             nftItem?.collection?.name === "Anonymous Telegram Numbers" ||
                             nftItem?.collection?.name === "TON DNS" ||
                             nftItem?.collection?.name === "Telegram Numbers";

          nftInfo = {
            name: nftName,
            image: nftItem?.previews?.find((p: any) => p.resolution === '100x100')?.url || 
                   nftItem?.previews?.[0]?.url || 
                   nftItem?.metadata?.image,
            description: nftItem?.metadata?.description,
            collection: nftItem?.collection?.name,
            verified: isOfficial
          };
        } else if (action.type === "SmartContractExec") {
          const s = action.SmartContractExec;
          const amountNano = BigInt(s.ton_attached || 0);
          amount = amountNano > 0n ? (Number(amountNano) / 1e9).toFixed(4) + " TON" : "Contract Exec";
          from = formatTonAddress(s.executor.address);
          to = formatTonAddress(s.contract.address);
          fromName = s.executor.name;
          toName = s.contract.name;
          direction = s.contract.address === myAddress ? 'in' : 'out';
          typeLabel = s.operation || "Contract Exec";
        }

        return {
          hash: event.event_id,
          date: new Date(event.timestamp * 1000).toISOString(),
          from,
          to,
          fromName,
          toName,
          amount,
          comment,
          status: event.in_progress ? "Pending" : "Success",
          fee: (parseInt(event.extra || 0) / 1e9).toFixed(6) + " TON",
          type: typeLabel,
          direction,
          nftInfo,
          raw: event
        };
      }))).filter(tx => tx !== null);

      data = {
        address: formatTonAddress(myAddress), // Return the canonical address in user-friendly format
        balance: `${balance} TON`,
        usdValue: parseFloat(balance) * price,
        transactions: processedTransactions,
        nfts: [], // Loaded lazily via GET /api/nfts/ton/:address when Collectibles tab opens
        stats: {
          totalReceived: (Number(totalReceivedNano) / 1e9).toFixed(2) + " TON",
          totalSent: (Number(totalSentNano) / 1e9).toFixed(2) + " TON",
          txCount: allEvents.length,
          firstTx: allEvents.length > 0 ? new Date(allEvents[allEvents.length - 1].timestamp * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A",
          lastTx: account.last_activity ? new Date(account.last_activity * 1000).toLocaleDateString() : "N/A",
          status: account.status,
          interfaces: account.interfaces || [],
          maxBalance: (Number(maxBalanceNano) / 1e9).toFixed(2) + " TON",
          code: account.code || "No code available"
        },
        tokens: [], // Jettons endpoint removed — token balances tab not present on site
        raw: {
          account,
          events: allEvents
        }
      };
    } else if (network === "bitcoin") {
      const [btcRes, price] = await Promise.all([
        axios.get(`https://blockchain.info/rawaddr/${address}`, { timeout: 10000 }),
        getCachedPrice("bitcoin")
      ]);
      const balance = (btcRes.data.final_balance / 1e8).toFixed(8);

      data = {
        address,
        balance: `${balance} BTC`,
        usdValue: parseFloat(balance) * price,
        transactions: btcRes.data.txs.slice(0, 50).map((tx: any) => {
          const isIncoming = tx.out.some((o: any) => o.addr === address);
          return {
            hash: tx.hash,
            date: new Date(tx.time * 1000).toISOString(),
            from: tx.inputs[0]?.prev_out?.addr || "Multiple Inputs",
            to: tx.out[0]?.addr || "Multiple Outputs",
            amount: (Math.abs(tx.result) / 1e8).toFixed(8) + " BTC",
            status: "Success",
            fee: (tx.fee / 1e8).toFixed(8) + " BTC",
            direction: isIncoming ? 'in' : 'out',
            type: 'Transfer'
          };
        }),
        stats: {
          totalReceived: ( (btcRes.data?.total_received || 0) / 1e8).toFixed(8) + " BTC",
          totalSent: ( (btcRes.data?.total_sent || 0) / 1e8).toFixed(8) + " BTC",
          txCount: btcRes.data?.n_tx || 0,
          firstTx: "N/A",
          lastTx: "N/A",
          maxBalance: ( (btcRes.data?.total_received || 0) / 1e8).toFixed(8) + " BTC (Est.)"
        },
        tokens: []
      };
    } else if (network === "ethereum") {
      const [ethRes, price] = await Promise.all([
        axios.get(`https://api.blockcypher.com/v1/eth/main/addrs/${address}`, { timeout: 10000 }),
        getCachedPrice("ethereum")
      ]);
      
      const balance = (ethRes.data.balance / 1e18).toFixed(6);

      data = {
        address,
        balance: `${balance} ETH`,
        usdValue: parseFloat(balance) * price,
        transactions: (ethRes.data.txrefs || []).slice(0, 50).map((tx: any) => {
          const isIncoming = tx.tx_output_n >= 0;
          return {
            hash: tx.tx_hash,
            date: tx.confirmed || new Date().toISOString(),
            from: isIncoming ? "External Source" : address,
            to: isIncoming ? address : "External Destination",
            amount: (tx.value / 1e18).toFixed(6) + " ETH",
            status: "Success",
            fee: "N/A",
            direction: isIncoming ? 'in' : 'out',
            type: 'Transfer'
          };
        }),
        stats: {
          totalReceived: ( (ethRes.data?.total_received || 0) / 1e18).toFixed(6) + " ETH",
          totalSent: ( (ethRes.data?.total_sent || 0) / 1e18).toFixed(6) + " ETH",
          txCount: ethRes.data?.n_tx || 0,
          firstTx: "N/A",
          lastTx: "N/A",
          maxBalance: ( (ethRes.data?.total_received || 0) / 1e18).toFixed(6) + " ETH (Est.)"
        },
        tokens: []
      };
    } else if (network === "tron") {
      // All 3 requests in parallel: was sequential (account → then tx separately)
      const [tronRes, txRes, price] = await Promise.all([
        axios.get(`https://apilist.tronscan.org/api/account?address=${address}`, { timeout: 10000 }),
        axios.get(`https://apilist.tronscan.org/api/transaction?address=${address}&limit=50`, { timeout: 10000 }),
        getCachedPrice("tron")
      ]);
      
      const account = tronRes.data;
      const balance = ( (account?.balance || 0) / 1e6).toFixed(2);

      data = {
        address,
        balance: `${balance} TRX`,
        usdValue: parseFloat(balance) * price,
        transactions: (txRes.data.data || []).map((tx: any) => {
          const isIncoming = tx.toAddress === address;
          return {
            hash: tx.hash,
            date: new Date(tx.timestamp).toISOString(),
            from: tx.ownerAddress || "N/A",
            to: tx.toAddress || "N/A",
            amount: ( (tx.amount || 0) / 1e6).toFixed(2) + " TRX",
            status: tx.confirmed ? "Success" : "Pending",
            fee: ( (tx.cost?.fee || 0) / 1e6).toFixed(6) + " TRX",
            direction: isIncoming ? 'in' : 'out',
            type: 'Transfer'
          };
        }),
        stats: {
          totalReceived: ( (account?.totalReceived || 0) / 1e6).toFixed(2) + " TRX",
          totalSent: ( (account?.totalSent || 0) / 1e6).toFixed(2) + " TRX",
          txCount: account?.totalTransactionCount || 0,
          firstTx: "N/A",
          lastTx: account?.date_created ? new Date(account.date_created).toLocaleDateString() : "N/A",
          maxBalance: ( (account?.totalReceived || 0) / 1e6).toFixed(2) + " TRX (Est.)"
        },
        tokens: (account?.trc20token_balances || []).map((t: any) => ({
          name: t.tokenName || "Unknown Token",
          symbol: t.tokenAbbr || "TOKEN",
          balance: (parseInt(t.balance || 0) / Math.pow(10, t.tokenDecimal || 6)).toFixed(2),
          usdValue: t.vip ? (parseInt(t.balance || 0) / Math.pow(10, t.tokenDecimal || 6)) * (t.priceInUsd || 0) : 0
        }))
      };
    }

    // Add Analysis
    data.analysis = analyzePersonality(data);

    setCache(cacheKey, data, 300); // Cache wallet data for 5 minutes
    return data;
  } catch (error: any) {
    throw error; // re-throw so dedupeRequest callers and the route handler can handle it
  }
}

// Lazy NFT endpoint — called only when user opens the Collectibles tab
// Saves 1 request on every initial wallet load
app.get("/api/nfts/ton/:address", async (req, res) => {
  const { address } = req.params;
  const cacheKey = `nfts_ton_${address}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const nftsRes = await dedupeRequest(cacheKey + "_inflight", () =>
      axios.get(`https://tonapi.io/v2/accounts/${address}/nfts?limit=100`, { timeout: 8000, headers: TONAPI_HEADERS })
    );
    const nfts = (nftsRes.data?.nft_items || []).map((n: any) => ({
      address: formatTonAddress(n.address),
      name: n.metadata?.name || n.dns || `NFT #${n.index}`,
      image: n.previews?.find((p: any) => p.resolution === '500x500')?.url || n.previews?.[0]?.url || n.metadata?.image,
      description: n.metadata?.description,
      collection: n.collection?.name,
      index: n.index,
      verified: n.collection?.name === "Telegram Usernames" ||
                n.collection?.name === "Anonymous Telegram Numbers" ||
                n.collection?.name === "TON DNS" ||
                n.collection?.name === "Telegram Numbers"
    }));
    setCache(cacheKey, nfts, 300); // Cache NFTs for 5 min
    res.json(nfts);
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ error: error.message || "Failed to fetch NFTs" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
