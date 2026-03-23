import type { VercelRequest, VercelResponse } from "@vercel/node";
import { detectNetwork } from "../_utils";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { address } = req.query;
  const network = detectNetwork(String(address));
  res.json({ network });
}
