import React from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      alert("Copy failed");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/60 hover:text-white transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({
  code,
  language = "json",
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
        <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
          {language}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="p-5 overflow-x-auto text-[13px] leading-7 font-mono text-white/80">
        <code dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
      </pre>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card p-8 sm:p-10">
      {subtitle && (
        <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.24em] mb-3">
          {subtitle}
        </div>
      )}
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">{title}</h2>
      {children}
    </section>
  );
}

function EndpointCard({
  method,
  path,
  description,
  request,
  response,
}: {
  method: string;
  path: string;
  description: string;
  request: string;
  response: string;
}) {

  const [open, setOpen] = React.useState(false);

  const methodClasses =
    method === "GET"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-white/10 text-white border-white/20";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">

      <div className="px-6 py-5 border-b border-white/10">

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${methodClasses}`}>
            {method}
          </span>

          <span className="font-mono text-sm text-white/90">
            {path}
          </span>
        </div>

        <p className="text-sm text-white/45 mt-4">
          {description}
        </p>

      </div>


      <div className="grid xl:grid-cols-2 border-white/10">

        <div className="p-6 border-b xl:border-b-0 xl:border-r border-white/10">
          <div className="text-[10px] font-bold text-white/20 uppercase mb-4">
            Example Request
          </div>

          <CodeBlock code={request} language="http" />
        </div>


        <div className="p-6">

          <button
            onClick={() => setOpen(!open)}
            className="mb-4 text-xl text-[#7dd3fc] hover:text-white transition"
          >
            {open ? "Hide Response ▲" : "Show Response ▼"}
          </button>

          {open && (
            <CodeBlock code={response} language="json" />
          )}

        </div>

      </div>
    </div>
  );
}

function Row({
  name,
  type,
  description,
}: {
  name: string;
  type: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_140px_1fr] gap-3 md:gap-6 px-5 py-4 border-b border-white/5">
      <div className="font-mono text-[#7dd3fc] text-sm break-all">{name}</div>
      <div className="text-xs uppercase tracking-widest text-white/30 font-bold">{type}</div>
      <div className="text-sm text-white/55 leading-7">{description}</div>
    </div>
  );
}

function highlightCode(input: string) {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let html = escapeHtml(input);

  html = html.replace(
    /"([^"]+)"(?=\s*:)/g,
    '<span style="color:#7dd3fc">"$1"</span>'
  );

  html = html.replace(
    /:\s*"([^"]*)"/g,
    ': <span style="color:#86efac">"$1"</span>'
  );

  html = html.replace(
    /:\s*(-?\d+(\.\d+)?)/g,
    ': <span style="color:#f9a8d4">$1</span>'
  );

  html = html.replace(
    /:\s*(true|false|null)/g,
    ': <span style="color:#fca5a5">$1</span>'
  );

  html = html.replace(
    /\b(GET|POST|PUT|PATCH|DELETE)\b/g,
    '<span style="color:#86efac">$1</span>'
  );

  html = html.replace(
    /(\/api\/[A-Za-z0-9_/:.-]+)/g,
    '<span style="color:#7dd3fc">$1</span>'
  );

  return html;
}

const detectRequest = `GET /api/detect/EQCXXXXXXXXXXXXXXXXXXXXXXXXXXXX`;
const detectResponse = `{
  "network": "ton"
}`;

const walletRequest = `GET /api/wallet/ton/EQCXXXXXXXXXXXXXXXXXXXXXXXXXXXX`;
const walletResponse = `{
  "address": "EQDxxxxxxxxxxxxxxxx",
  "balance": "12.40 TON",
  "usdValue": 79.41,
  "tokens": [
    {
      "symbol": "USDT",
      "usdValue": 50
    }
  ],
  "nfts": [
    {
      "name": "Example NFT",
      "collection": "Pale Collection",
      "description": "Example item description",
      "image": "https://example.com/nft.png",
      "verified": true,
      "address": "EQNFT123..."
    }
  ],
  "transactions": [
    {
      "date": "2026-03-16T12:00:00Z",
      "direction": "in",
      "type": "TonTransfer",
      "amount": "2.75 TON",
      "from": "EQAAAA...",
      "to": "EQBBBB...",
      "fromName": "Alice",
      "toName": "Bob",
      "hash": "1234567890abcdef",
      "comment": "Payment",
      "isScam": false,
      "nftInfo": null
    }
  ],
  "stats": {
    "totalReceived": "25 TON",
    "totalSent": "12.6 TON",
    "maxBalance": "18 TON",
    "code": "te6ccg...",
    "interfaces": [
      "wallet_v4"
    ]
  },
  "analysis": {
    "riskScore": 10,
    "personality": "Standard",
    "tags": [
      "Active"
    ]
  }
}`;

const priceRequest = `GET /api/price/ton`;
const priceResponse = `{
  "usd": 6.42,
  "usd_24h_change": 2.15
}`;

export default function ApiPage() {
  return (
    <div className="min-h-screen text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <a
              href="/"
              className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              PaleChain
            </a>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/40">
              <a href="/" className="hover:text-white transition-colors">
                Home
              </a>
              <a href="/features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="/api" className="text-white transition-colors">
                API
              </a>
            </div>
          </div>

          <div className="text-xs font-bold text-white/25 uppercase tracking-[0.22em]">
            Documentation
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <div className="flex flex-col gap-8">
          <section className="glass-card p-8 sm:p-12 overflow-hidden relative">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(51,147,224,0.14),transparent_25%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[11px] font-medium text-white/60 mb-6">
                Internal API • Current project structure
              </div>

              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
                PaleChain API
              </h1>

              <p className="text-white/45 max-w-3xl text-sm sm:text-base leading-8">
                This documentation is based on the endpoints your current frontend
                already uses right now. Nothing here changes your logic. It only
                documents the existing request flow and expected response structure.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.18em] mb-2">
                    Base URL
                  </div>
                  <div className="font-mono text-sm text-[#7dd3fc]">
                    http://localhost:3000
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.18em] mb-2">
                    Auth
                  </div>
                  <div className="font-mono text-sm text-white/75">No auth used in current frontend</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.18em] mb-2">
                    Format
                  </div>
                  <div className="font-mono text-sm text-white/75">JSON responses</div>
                </div>
              </div>
            </div>
          </section>

          <Section title="Search flow" subtitle="How current frontend works">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  n: "01",
                  title: "Detect network",
                  text: "The frontend first sends the entered address or value to /api/detect/:value.",
                },
                {
                  n: "02",
                  title: "Fetch wallet data",
                  text: "After detection, it requests /api/wallet/:network/:address and renders the dashboard.",
                },
                {
                  n: "03",
                  title: "Fetch TON price",
                  text: "TON price is requested separately from /api/price/ton for price widgets and USD values.",
                },
              ].map((item) => (
                <div
                  key={item.n}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="text-[10px] font-bold text-[#7dd3fc] uppercase tracking-[0.2em] mb-3">
                    Step {item.n}
                  </div>
                  <div className="text-lg font-bold mb-3">{item.title}</div>
                  <div className="text-sm text-white/50 leading-7">{item.text}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Endpoints" subtitle="Current API routes">
            <div className="flex flex-col gap-6">
              <EndpointCard
                method="GET"
                path="/api/detect/:value"
                description="Detects the blockchain network for the entered value. Current frontend expects a JSON object with a single network field."
                request={detectRequest}
                response={detectResponse}
              />

              <EndpointCard
                method="GET"
                path="/api/wallet/:network/:address"
                description="Returns wallet data used by the main dashboard, including balance, transactions, NFTs, stats and analysis."
                request={walletRequest}
                response={walletResponse}
              />

              <EndpointCard
                method="GET"
                path="/api/price/ton"
                description="Returns the current TON price and 24h change. Used by the frontend price fetch logic."
                request={priceRequest}
                response={priceResponse}
              />
            </div>
          </Section>

          <Section title="Wallet response fields" subtitle="Main object structure">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <Row
                name="address"
                type="string"
                description="Wallet address shown in the main account card."
              />
              <Row
                name="balance"
                type="string"
                description="Formatted native balance, for example 12.40 TON."
              />
              <Row
                name="usdValue"
                type="number"
                description="USD value of the native balance."
              />
              <Row
                name="tokens"
                type="array"
                description="Token list used in the asset distribution chart."
              />
              <Row
                name="nfts"
                type="array"
                description="Collectibles shown in the Collectibles tab and NFT modal."
              />
              <Row
                name="transactions"
                type="array"
                description="Transaction history shown in History and Raw Transactions tabs."
              />
              <Row
                name="stats"
                type="object"
                description="Wallet stats, contract code and detected interfaces."
              />
              <Row
                name="analysis"
                type="object"
                description="Risk score, personality label and tags used by the UI."
              />
            </div>
          </Section>

          <Section title="Transaction object fields" subtitle="transactions[]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <Row name="date" type="string" description="ISO date string of the transaction." />
              <Row name="direction" type="string" description='Expected values: "in" or "out".' />
              <Row name="type" type="string" description='Transaction type, for example "TonTransfer" or "NftItemTransfer".' />
              <Row name="amount" type="string" description="Formatted amount shown in transaction rows." />
              <Row name="from" type="string" description="Sender address." />
              <Row name="to" type="string" description="Receiver address." />
              <Row name="fromName" type="string" description="Optional display label for sender." />
              <Row name="toName" type="string" description="Optional display label for receiver." />
              <Row name="hash" type="string" description="Transaction hash used for reference and explorer redirection." />
              <Row name="comment" type="string" description="Optional message/comment displayed in the row." />
              <Row name="isScam" type="boolean" description="If true, transaction can be marked as spam/scam in UI." />
              <Row name="nftInfo" type="object|null" description="NFT metadata object for NFT transfer rows." />
            </div>
          </Section>

          <Section title="NFT object fields" subtitle="nfts[] / transactions[].nftInfo">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <Row name="name" type="string" description="NFT name shown on cards and modal." />
              <Row name="collection" type="string" description="Collection name." />
              <Row name="description" type="string" description="Description shown in NFT modal." />
              <Row name="image" type="string" description="Image URL used for NFT preview." />
              <Row name="verified" type="boolean" description="Shows the verified badge if true." />
              <Row name="address" type="string" description="NFT address shown in modal and copyable by user." />
            </div>
          </Section>

          <Section title="Stats and analysis" subtitle="stats / analysis">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">
                  stats
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                  <Row name="totalReceived" type="string" description="All-time received amount." />
                  <Row name="totalSent" type="string" description="All-time sent amount." />
                  <Row name="maxBalance" type="string" description="Maximum wallet balance." />
                  <Row name="code" type="string" description="Contract code / BOC shown in the Code tab." />
                  <Row name="interfaces" type="array" description="Detected methods/interfaces shown in Methods tab." />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">
                  analysis
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                  <Row name="riskScore" type="number" description="Risk score used by warning banner and PaleScore bar." />
                  <Row name="personality" type="string" description="Wallet personality/label badge." />
                  <Row name="tags" type="array" description="Additional tag badges rendered under the account card." />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Minimal valid examples" subtitle="Quick reference">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <CodeBlock
                language="json"
                code={`{
  "network": "ton"
}`}
              />
              <CodeBlock
                language="json"
                code={`{
  "usd": 6.42,
  "usd_24h_change": 2.15
}`}
              />
              <CodeBlock
                language="json"
                code={`{
  "address": "EQDxxxxxxxxxxxxxxxx",
  "balance": "12.40 TON",
  "usdValue": 79.41,
  "tokens": [],
  "nfts": [],
  "transactions": [],
  "stats": {
    "totalReceived": "25 TON",
    "totalSent": "12.6 TON",
    "maxBalance": "18 TON",
    "code": "te6ccg...",
    "interfaces": ["wallet_v4"]
  },
  "analysis": {
    "riskScore": 10,
    "personality": "Standard",
    "tags": ["Active"]
  }
}`}
              />
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}