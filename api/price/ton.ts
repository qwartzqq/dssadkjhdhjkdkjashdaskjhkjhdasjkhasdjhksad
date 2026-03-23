import type { VercelRequest, VercelResponse } from "@vercel/node";
import { axios, getCache, setCache } from "../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const cacheKey = "ton_price";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true",
      { timeout: 5000 }
    );
    const data = response.data["the-open-network"];
    setCache(cacheKey, data, 120);
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to fetch price" });
  }
}
