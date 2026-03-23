import React from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, Search, Wallet, Layers, Activity, ArrowRight, Globe, Database, Lock, BarChart3, Cpu } from 'lucide-react';

const navLink = 'hover:text-white transition-colors';

function FeatureCard({
  icon: Icon,
  title,
  text,
  bullets,
}: {
  icon: any;
  title: string;
  text: string;
  bullets: string[];
}) {
  return (
    <div className="glass-card p-6 sm:p-7 h-full">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
        <Icon className="w-6 h-6 text-[#3393e0]" />
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-3">{title}</h3>
      <p className="text-sm text-white/45 leading-7 mb-5">{text}</p>
      <div className="space-y-2">
        {bullets.map((item) => (
          <div key={item} className="text-sm text-white/65 flex items-start gap-3">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#3393e0] flex-shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">{label}</div>
      <div className="text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}

export default function FeaturesPage() {
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
              <a href="/features" className="text-white transition-colors">Features</a>
              <a href="/api" className={navLink}>API</a>
			  
            </div>
          </div>
          <div className="text-xs font-bold text-white/25 uppercase tracking-[0.22em]">Product</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8">
          <section className="glass-card p-8 sm:p-12 overflow-hidden relative">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(51,147,224,0.18),transparent_28%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[11px] font-medium text-white/60 mb-6">
                Blockchain explorer • wallet intelligence • multi-chain lookup
              </div>
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 max-w-4xl">
                Everything users need to inspect wallets, assets and activity.
              </h1>
              <p className="text-white/45 max-w-3xl text-sm sm:text-base leading-8 mb-8">
                Features page for PaleChain. Clean blocks, same background as the landing page, and enough sections so you can later rewrite the text without rebuilding the whole layout.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniStat label="Supported flow" value="Address + TX lookup" />
                <MiniStat label="Networks" value="BTC / ETH / LTC / TON / TRON" />
                <MiniStat label="Wallet UX" value="TonConnect ready" />
                <MiniStat label="Data view" value="History / NFTs / code" />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <FeatureCard
              icon={Search}
              title="Automatic network detection"
              text="Users can paste an address or hash and PaleChain routes the lookup to the right chain without making them switch tabs manually."
              bullets={[
                'Address-first search flow',
                'Fast detection before wallet request',
                'Works as the entry point of the dashboard',
              ]}
            />
            <FeatureCard
              icon={Wallet}
              title="Wallet overview"
              text="A single account page shows balance, USD value, max balance, interfaces and a QR share block in the hero section."
              bullets={[
                'Main account card with address tools',
                'Balance and USD summary',
                'Favorite and share actions',
              ]}
            />
            <FeatureCard
              icon={Activity}
              title="Transaction history"
              text="Readable transaction list with direction, addresses, comments, NFT transfers and external hash opening."
              bullets={[
                'Incoming and outgoing flow labels',
                'Comment and spam markers',
                'Raw transaction tab for full JSON view',
              ]}
            />
            <FeatureCard
              icon={Layers}
              title="NFT and collectibles"
              text="Collectibles tab with cards, previews and modal details for collections, images, descriptions and verified badges."
              bullets={[
                'Grid layout for items',
                'Preview modal with metadata',
                'Reusable NFT data structure',
              ]}
            />
            <FeatureCard
              icon={Shield}
              title="Risk and behavior signals"
              text="Wallet pages can display score, risk warnings, personality labels and extra tags based on analysis returned by the backend."
              bullets={[
                'Visible warning state for risky wallets',
                'Tag badges below the account card',
                'Simple score UI already wired in',
              ]}
            />
            <FeatureCard
              icon={BarChart3}
              title="Asset distribution"
              text="Pie-chart style distribution block for native balance and tokens so users can see the wallet composition instantly."
              bullets={[
                'Native + token values',
                'Tooltip ready chart block',
                'Fits dashboard side panel nicely',
              ]}
            />
          </section>

          <section className="glass-card p-8 sm:p-10">
            <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.24em] mb-3">Built for expansion</div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">What you can grow from here</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Cpu className="w-5 h-5 text-[#3393e0]" />
                  <div className="font-bold">Data and methods</div>
                </div>
                <div className="space-y-3 text-sm text-white/55 leading-7">
                  <p>There is already room for contract code, interfaces, method detection and per-network data shaping.</p>
                  <p>You can later expand this into deeper explorer features without redesigning the whole page structure.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-5 h-5 text-[#3393e0]" />
                  <div className="font-bold">Private tools and admin flows</div>
                </div>
                <div className="space-y-3 text-sm text-white/55 leading-7">
                  <p>The layout also works for future balance tools, deal flow, admin actions, premium explorer blocks or bot-driven features.</p>
                  <p>Nothing here is overlocked to one use-case, so you can reword sections later for API, products or integrations.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6">
            <div className="glass-card p-8 sm:p-10">
              <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.24em] mb-3">User value</div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-5">Why this page exists</h2>
              <div className="space-y-4 text-sm sm:text-base text-white/50 leading-8">
                <p>PaleChain needs a separate features page so users can understand the product before they start searching addresses or reading API docs.</p>
                <p>This page gives you a clean marketing structure: hero, feature cards, expansion section and CTA block. You can keep the layout and rewrite the text later for your real release.</p>
              </div>
            </div>

            <div className="glass-card p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.24em] mb-3">Next step</div>
                <h2 className="text-2xl font-bold tracking-tight mb-4">Need the full stack too?</h2>
                <p className="text-sm text-white/50 leading-7 mb-8">
                  Connect this page with your landing, API docs and later product flows like deals, premium analytics or account tools.
                </p>
              </div>
              <a
                href="/api"
                className="inline-flex items-center justify-center gap-2 btn-pill btn-primary w-full sm:w-auto"
              >
                Open API docs
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
}
