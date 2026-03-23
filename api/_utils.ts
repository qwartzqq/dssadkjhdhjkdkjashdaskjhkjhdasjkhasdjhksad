import axios from "axios";
import axiosRetry from "axios-retry";
import { Address } from "@ton/core";

axiosRetry(axios, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    if (error.response?.status === 429) return false;
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ?? 0) >= 500;
  },
});

export const TONAPI_HEADERS = process.env.TONAPI_KEY
  ? { Authorization: `Bearer ${process.env.TONAPI_KEY}` }
  : {};

// Simple in-memory cache (lives per warm serverless instance)
const memCache = new Map<string, { value: any; expiry: number }>();

export const getCache = (key: string) => {
  const entry = memCache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.value;
  return null;
};

export const setCache = (key: string, value: any, ttlSeconds: number) => {
  memCache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
};

export const formatTonAddress = (addr: string) => {
  if (!addr || addr === "N/A" || !addr.includes(":")) return addr;
  try {
    return Address.parse(addr).toString({ bounceable: true, testOnly: false });
  } catch {
    return addr;
  }
};

export const detectNetwork = (address: string) => {
  const addr = address.trim();
  if (addr.toLowerCase().endsWith(".ton")) return "ton";
  if (addr.toLowerCase().endsWith(".t.me")) return "ton";
  if (addr.startsWith("@")) return "ton";
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return "ethereum";
  if (/^T[a-zA-Z0-9]{33}$/.test(addr)) return "tron";
  if (/^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(addr)) return "bitcoin";
  if (/^[a-zA-Z0-9_-]{48}$/.test(addr)) return "ton";
  return "unknown";
};

export const getCachedPrice = async (coinId: string): Promise<number> => {
  const cacheKey = `price_${coinId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached.usd;

  const response = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    { timeout: 5000 }
  );
  const priceUsd: number = response.data[coinId]?.usd ?? 0;
  setCache(cacheKey, { usd: priceUsd }, 120);
  return priceUsd;
};

export const analyzePersonality = (data: any) => {
  const txCount = data.transactions.length;
  const nftCount = data.nfts?.length || 0;
  const tokenCount = data.tokens?.length || 0;
  const balance = parseFloat(data.balance);

  let personality = "Casual User";
  let riskScore = 0;
  const tags: string[] = [];

  if (txCount > 100) { personality = "Active Trader"; tags.push("High Activity"); }
  if (nftCount > 10) { personality = "NFT Collector"; tags.push("Art Lover"); }
  if (balance > 1000) { personality = "Whale"; tags.push("Deep Pockets"); }
  if (tokenCount > 5) { personality = "DeFi Explorer"; tags.push("Diversified"); }
  if (txCount < 5) { personality = "Newcomer"; tags.push("Fresh Wallet"); }

  const scamTxs = data.transactions.filter(
    (tx: any) => tx.isScam || (tx.comment && /scam|spam|win|prize|claim/i.test(tx.comment))
  );
  if (scamTxs.length > 0) riskScore += 20;
  if (data.stats?.status === "uninit") riskScore += 5;

  return { personality, riskScore, tags };
};

export { axios };
