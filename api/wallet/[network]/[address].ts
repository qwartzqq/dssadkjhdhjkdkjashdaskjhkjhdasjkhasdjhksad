import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  axios,
  getCache,
  setCache,
  formatTonAddress,
  getCachedPrice,
  analyzePersonality,
  TONAPI_HEADERS,
} from "../../_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let { network, address } = req.query as { network: string; address: string };

  // Resolve TON DNS
  const isDns =
    address.toLowerCase().endsWith(".ton") ||
    address.toLowerCase().endsWith(".t.me") ||
    address.startsWith("@");

  if (network === "ton" && isDns) {
    const dnsCacheKey = `dns_resolve_${address.toLowerCase()}`;
    const cachedAddr = getCache(dnsCacheKey);
    if (cachedAddr) {
      address = cachedAddr;
    } else {
      try {
        let searchName = address.toLowerCase();
        if (searchName.startsWith("@")) searchName = searchName.slice(1) + ".t.me";
        const dnsRes = await axios.get(
          `https://tonapi.io/v2/dns/${searchName}/resolve`,
          { timeout: 5000, headers: TONAPI_HEADERS }
        );
        const resolved = dnsRes.data?.wallet?.address || dnsRes.data?.address;
        if (resolved) {
          setCache(dnsCacheKey, resolved, 3600);
          address = resolved;
        } else {
          const searchRes = await axios.get(
            `https://tonapi.io/v2/accounts/${searchName}`,
            { timeout: 5000, headers: TONAPI_HEADERS }
          );
          if (searchRes.data?.address) address = searchRes.data.address;
        }
      } catch (e: any) {
        console.error(`DNS Resolve failed for ${address}:`, e.message);
      }
    }
  }

  const cacheKey = `wallet_${network}_${address}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await fetchWalletData(network, address, cacheKey);
    return res.json(result);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.message || "Failed to fetch wallet data";
    return res.status(status).json({ error: message });
  }
}

async function fetchWalletData(network: string, address: string, cacheKey: string): Promise<any> {
  let data: any = {
    address,
    balance: "0",
    usdValue: 0,
    transactions: [],
    stats: { totalReceived: "0", totalSent: "0", txCount: 0, firstTx: "N/A", lastTx: "N/A" },
    tokens: [],
  };

  if (network === "ton") {
    const [accountRes, eventsRes, price] = await Promise.all([
      axios.get(`https://tonapi.io/v2/accounts/${address}`, { timeout: 8000, headers: TONAPI_HEADERS }),
      axios.get(`https://tonapi.io/v2/accounts/${address}/events?limit=100`, { timeout: 8000, headers: TONAPI_HEADERS }),
      getCachedPrice("the-open-network"),
    ]);

    const account = accountRes.data;
    const myAddress = account.address;
    const currentBalanceNano = BigInt(account.balance);
    const balance = (Number(currentBalanceNano) / 1e9).toFixed(2);

    const allEvents: any[] = [];
    const eventIds = new Set<string>();
    for (const e of eventsRes.data.events || []) {
      if (!eventIds.has(e.event_id)) {
        allEvents.push(e);
        eventIds.add(e.event_id);
      }
    }

    let totalReceivedNano = 0n;
    let totalSentNano = 0n;
    let maxBalanceNano = currentBalanceNano;
    let runningBalanceNano = currentBalanceNano;

    allEvents.sort((a, b) => (b.lt || 0) - (a.lt || 0));

    for (const event of allEvents) {
      event.actions.forEach((action: any) => {
        if (action.type === "TonTransfer") {
          const t = action.TonTransfer;
          const amount = BigInt(t.amount);
          if (t.recipient.address === myAddress) totalReceivedNano += amount;
          else if (t.sender.address === myAddress) totalSentNano += amount;
        }
      });
      const change = BigInt(event.extra || 0);
      const balanceBefore = runningBalanceNano - change;
      if (runningBalanceNano > maxBalanceNano) maxBalanceNano = runningBalanceNano;
      if (balanceBefore > maxBalanceNano) maxBalanceNano = balanceBefore;
      runningBalanceNano = balanceBefore;
    }

    const processedTransactions = allEvents
      .map((event: any) => {
        const hasValueTransfer = event.actions.some(
          (a: any) =>
            a.type === "TonTransfer" ||
            a.type === "JettonTransfer" ||
            a.type === "NftItemTransfer" ||
            (a.type === "SmartContractExec" && BigInt(a.SmartContractExec.ton_attached || 0) > 0n)
        );
        if (!hasValueTransfer) return null;

        const action =
          event.actions.find(
            (a: any) =>
              a.type === "TonTransfer" ||
              a.type === "JettonTransfer" ||
              a.type === "NftItemTransfer"
          ) || event.actions[0];

        let amount = "0 TON";
        let from = "N/A", fromName, to = "N/A", toName;
        let typeLabel = action.type;
        let direction: "in" | "out" = "out";
        let nftInfo = undefined;
        let comment = undefined;

        if (action.type === "TonTransfer") {
          const t = action.TonTransfer;
          amount = (Number(BigInt(t.amount)) / 1e9).toFixed(4) + " TON";
          from = formatTonAddress(t.sender.address);
          to = formatTonAddress(t.recipient.address);
          fromName = t.sender.name;
          toName = t.recipient.name;
          direction = t.recipient.address === myAddress ? "in" : "out";
          comment = t.comment;
        } else if (action.type === "JettonTransfer") {
          const j = action.JettonTransfer;
          amount = (parseInt(j.amount) / Math.pow(10, j.jetton.decimals)).toFixed(2) + " " + j.jetton.symbol;
          from = formatTonAddress(j.sender?.address || "N/A");
          to = formatTonAddress(j.recipient?.address || "N/A");
          fromName = j.sender?.name;
          toName = j.recipient?.name;
          direction = j.recipient?.address === myAddress ? "in" : "out";
          comment = j.comment;
        } else if (action.type === "NftItemTransfer") {
          const n = action.NftItemTransfer;
          amount = "NFT Transfer";
          from = formatTonAddress(n.sender?.address || "N/A");
          to = formatTonAddress(n.recipient?.address || "N/A");
          fromName = n.sender?.name;
          toName = n.recipient?.name;
          direction = n.recipient?.address === myAddress ? "in" : "out";
          comment = n.comment;
          const nftItem = n.nft_item;
          const nftAddress = n.nft;
          const nftName =
            nftItem?.metadata?.name ||
            nftItem?.dns ||
            (nftItem?.index !== undefined && nftItem?.collection
              ? `${nftItem.collection.name} #${nftItem.index}`
              : undefined) ||
            (nftItem?.index !== undefined ? `NFT #${nftItem.index}` : undefined) ||
            (nftAddress ? `${nftAddress.slice(0, 4)}...${nftAddress.slice(-4)}` : "Unnamed NFT");
          const isOfficial =
            ["Telegram Usernames", "Anonymous Telegram Numbers", "TON DNS", "Telegram Numbers"].includes(
              nftItem?.collection?.name
            );
          nftInfo = {
            name: nftName,
            image:
              nftItem?.previews?.find((p: any) => p.resolution === "100x100")?.url ||
              nftItem?.previews?.[0]?.url ||
              nftItem?.metadata?.image,
            description: nftItem?.metadata?.description,
            collection: nftItem?.collection?.name,
            verified: isOfficial,
          };
        } else if (action.type === "SmartContractExec") {
          const s = action.SmartContractExec;
          const amountNano = BigInt(s.ton_attached || 0);
          amount = amountNano > 0n ? (Number(amountNano) / 1e9).toFixed(4) + " TON" : "Contract Exec";
          from = formatTonAddress(s.executor.address);
          to = formatTonAddress(s.contract.address);
          fromName = s.executor.name;
          toName = s.contract.name;
          direction = s.contract.address === myAddress ? "in" : "out";
          typeLabel = s.operation || "Contract Exec";
        }

        return {
          hash: event.event_id,
          date: new Date(event.timestamp * 1000).toISOString(),
          from, to, fromName, toName, amount, comment,
          status: event.in_progress ? "Pending" : "Success",
          fee: (parseInt(event.extra || 0) / 1e9).toFixed(6) + " TON",
          type: typeLabel, direction, nftInfo, raw: event,
        };
      })
      .filter((tx) => tx !== null);

    data = {
      address: formatTonAddress(myAddress),
      balance: `${balance} TON`,
      usdValue: parseFloat(balance) * price,
      transactions: processedTransactions,
      nfts: [],
      stats: {
        totalReceived: (Number(totalReceivedNano) / 1e9).toFixed(2) + " TON",
        totalSent: (Number(totalSentNano) / 1e9).toFixed(2) + " TON",
        txCount: allEvents.length,
        firstTx:
          allEvents.length > 0
            ? new Date(allEvents[allEvents.length - 1].timestamp * 1000).toLocaleDateString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
              })
            : "N/A",
        lastTx: account.last_activity
          ? new Date(account.last_activity * 1000).toLocaleDateString()
          : "N/A",
        status: account.status,
        interfaces: account.interfaces || [],
        maxBalance: (Number(maxBalanceNano) / 1e9).toFixed(2) + " TON",
        code: account.code || "No code available",
      },
      tokens: [],
      raw: { account, events: allEvents },
    };
  } else if (network === "bitcoin") {
    const [btcRes, price] = await Promise.all([
      axios.get(`https://blockchain.info/rawaddr/${address}`, { timeout: 10000 }),
      getCachedPrice("bitcoin"),
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
          direction: isIncoming ? "in" : "out",
          type: "Transfer",
        };
      }),
      stats: {
        totalReceived: ((btcRes.data?.total_received || 0) / 1e8).toFixed(8) + " BTC",
        totalSent: ((btcRes.data?.total_sent || 0) / 1e8).toFixed(8) + " BTC",
        txCount: btcRes.data?.n_tx || 0,
        firstTx: "N/A", lastTx: "N/A",
        maxBalance: ((btcRes.data?.total_received || 0) / 1e8).toFixed(8) + " BTC (Est.)",
      },
      tokens: [],
    };
  } else if (network === "ethereum") {
    const [ethRes, price] = await Promise.all([
      axios.get(`https://api.blockcypher.com/v1/eth/main/addrs/${address}`, { timeout: 10000 }),
      getCachedPrice("ethereum"),
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
          status: "Success", fee: "N/A",
          direction: isIncoming ? "in" : "out",
          type: "Transfer",
        };
      }),
      stats: {
        totalReceived: ((ethRes.data?.total_received || 0) / 1e18).toFixed(6) + " ETH",
        totalSent: ((ethRes.data?.total_sent || 0) / 1e18).toFixed(6) + " ETH",
        txCount: ethRes.data?.n_tx || 0,
        firstTx: "N/A", lastTx: "N/A",
        maxBalance: ((ethRes.data?.total_received || 0) / 1e18).toFixed(6) + " ETH (Est.)",
      },
      tokens: [],
    };
  } else if (network === "tron") {
    const [tronRes, txRes, price] = await Promise.all([
      axios.get(`https://apilist.tronscan.org/api/account?address=${address}`, { timeout: 10000 }),
      axios.get(`https://apilist.tronscan.org/api/transaction?address=${address}&limit=50`, { timeout: 10000 }),
      getCachedPrice("tron"),
    ]);
    const account = tronRes.data;
    const balance = ((account?.balance || 0) / 1e6).toFixed(2);
    data = {
      address,
      balance: `${balance} TRX`,
      usdValue: parseFloat(balance) * price,
      transactions: (txRes.data.data || []).map((tx: any) => ({
        hash: tx.hash,
        date: new Date(tx.timestamp).toISOString(),
        from: tx.ownerAddress || "N/A",
        to: tx.toAddress || "N/A",
        amount: ((tx.amount || 0) / 1e6).toFixed(2) + " TRX",
        status: tx.confirmed ? "Success" : "Pending",
        fee: ((tx.cost?.fee || 0) / 1e6).toFixed(6) + " TRX",
        direction: tx.toAddress === address ? "in" : "out",
        type: "Transfer",
      })),
      stats: {
        totalReceived: ((account?.totalReceived || 0) / 1e6).toFixed(2) + " TRX",
        totalSent: ((account?.totalSent || 0) / 1e6).toFixed(2) + " TRX",
        txCount: account?.totalTransactionCount || 0,
        firstTx: "N/A",
        lastTx: account?.date_created ? new Date(account.date_created).toLocaleDateString() : "N/A",
        maxBalance: ((account?.totalReceived || 0) / 1e6).toFixed(2) + " TRX (Est.)",
      },
      tokens: (account?.trc20token_balances || []).map((t: any) => ({
        name: t.tokenName || "Unknown Token",
        symbol: t.tokenAbbr || "TOKEN",
        balance: (parseInt(t.balance || 0) / Math.pow(10, t.tokenDecimal || 6)).toFixed(2),
        usdValue: t.vip
          ? (parseInt(t.balance || 0) / Math.pow(10, t.tokenDecimal || 6)) * (t.priceInUsd || 0)
          : 0,
      })),
    };
  }

  data.analysis = analyzePersonality(data);
  setCache(cacheKey, data, 300);
  return data;
}
