import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Transaction {
  hash: string;
  date: string;
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  amount: string;
  status: string;
  fee: string;
  token?: string;
  type?: string;
  direction?: 'in' | 'out';
  comment?: string;
  isScam?: boolean;
  nftInfo?: {
    name: string;
    image?: string;
    description?: string;
    collection?: string;
    verified?: boolean;
  };
}

export interface NFT {
  name: string;
  image?: string;
  description?: string;
  collection?: string;
  address?: string;
  verified?: boolean;
}

export interface Token {
  name: string;
  symbol: string;
  balance: string;
  usdValue: number;
}

export interface WalletData {
  address: string;
  balance: string;
  usdValue: number;
  transactions: Transaction[];
  nfts: NFT[];
  stats: {
    totalReceived: string;
    totalSent: string;
    txCount: number;
    firstTx: string;
    lastTx: string;
    maxBalance?: string;
    code?: string;
    interfaces?: string[];
  };
  tokens: Token[];
  analysis?: {
    personality: string;
    riskScore: number;
    tags: string[];
  };
}

export type Network = 'ethereum' | 'bitcoin' | 'tron' | 'ton' | 'unknown';
