import type { VercelRequest, VercelResponse } from "@vercel/node";
import { axios, getCache, setCache, formatTonAddress, TONAPI_HEADERS } from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { address } = req.query;
  const addr = String(address);
  const cacheKey = `nfts_ton_${addr}`;

  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const nftsRes = await axios.get(
      `https://tonapi.io/v2/accounts/${addr}/nfts?limit=100`,
      { timeout: 8000, headers: TONAPI_HEADERS }
    );
    const nfts = (nftsRes.data?.nft_items || []).map((n: any) => ({
      address: formatTonAddress(n.address),
      name: n.metadata?.name || n.dns || `NFT #${n.index}`,
      image:
        n.previews?.find((p: any) => p.resolution === "500x500")?.url ||
        n.previews?.[0]?.url ||
        n.metadata?.image,
      description: n.metadata?.description,
      collection: n.collection?.name,
      index: n.index,
      verified:
        n.collection?.name === "Telegram Usernames" ||
        n.collection?.name === "Anonymous Telegram Numbers" ||
        n.collection?.name === "TON DNS" ||
        n.collection?.name === "Telegram Numbers",
    }));
    setCache(cacheKey, nfts, 300);
    res.json(nfts);
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ error: error.message || "Failed to fetch NFTs" });
  }
}
