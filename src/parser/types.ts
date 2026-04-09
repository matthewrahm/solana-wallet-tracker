export type ParsedTransaction =
  | SwapTransaction
  | TransferTransaction
  | UnknownTransaction;

export interface SwapTransaction {
  type: "SWAP";
  wallet: string;
  walletLabel: string | null;
  signature: string;
  timestamp: number;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: number;
  toAmount: number;
  fromValueUsd: number | null;
  toValueUsd: number | null;
  platform: string;
}

export interface TransferTransaction {
  type: "TRANSFER";
  wallet: string;
  walletLabel: string | null;
  signature: string;
  timestamp: number;
  direction: "SENT" | "RECEIVED";
  token: TokenInfo;
  amount: number;
  valueUsd: number | null;
  counterparty: string;
}

export interface UnknownTransaction {
  type: "UNKNOWN";
  wallet: string;
  walletLabel: string | null;
  signature: string;
  timestamp: number;
  description: string;
}

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
}

// Helius Enhanced Transaction types
export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  description: string;
  fee: number;
  feePayer: string;
  nativeTransfers: HeliusNativeTransfer[];
  tokenTransfers: HeliusTokenTransfer[];
  events: {
    swap?: HeliusSwapEvent;
  };
}

export interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  mint: string;
  tokenAmount: number;
  tokenStandard: string;
}

export interface HeliusSwapEvent {
  nativeInput: { account: string; amount: string } | null;
  nativeOutput: { account: string; amount: string } | null;
  tokenInputs: HeliusSwapToken[];
  tokenOutputs: HeliusSwapToken[];
  innerSwaps: unknown[];
}

export interface HeliusSwapToken {
  userAccount: string;
  tokenAccount: string;
  mint: string;
  rawTokenAmount: {
    tokenAmount: string;
    decimals: number;
  };
}
