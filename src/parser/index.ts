import type {
  HeliusTransaction,
  ParsedTransaction,
  TokenInfo,
} from "./types.js";
import { getTokenPrice, SOL } from "../lib/price.js";
import { getWallet } from "../lib/store.js";

const LAMPORTS = 1_000_000_000;

const TOKEN_CACHE = new Map<string, { symbol: string; name: string }>();

export async function parseTransaction(
  tx: HeliusTransaction,
  watchedAddress: string
): Promise<ParsedTransaction> {
  const wallet = getWallet(watchedAddress);
  const walletLabel = wallet?.label ?? null;

  // Try swap first
  if (tx.events?.swap) {
    return parseSwap(tx, watchedAddress, walletLabel);
  }

  // Check for token transfers
  if (tx.tokenTransfers.length > 0) {
    return parseTokenTransfer(tx, watchedAddress, walletLabel);
  }

  // Check for native SOL transfers
  if (tx.nativeTransfers.length > 0) {
    return parseNativeTransfer(tx, watchedAddress, walletLabel);
  }

  return {
    type: "UNKNOWN",
    wallet: watchedAddress,
    walletLabel,
    signature: tx.signature,
    timestamp: tx.timestamp,
    description: tx.description || tx.type || "Unknown transaction",
  };
}

async function parseSwap(
  tx: HeliusTransaction,
  wallet: string,
  walletLabel: string | null
): Promise<ParsedTransaction> {
  const swap = tx.events!.swap!;

  let fromMint: string;
  let fromAmount: number;
  let toMint: string;
  let toAmount: number;

  // Determine input
  if (swap.nativeInput && BigInt(swap.nativeInput.amount) > 0n) {
    fromMint = SOL;
    fromAmount = Number(swap.nativeInput.amount) / LAMPORTS;
  } else if (swap.tokenInputs.length > 0) {
    const input = swap.tokenInputs[0];
    fromMint = input.mint;
    fromAmount =
      Number(input.rawTokenAmount.tokenAmount) /
      Math.pow(10, input.rawTokenAmount.decimals);
  } else {
    fromMint = "unknown";
    fromAmount = 0;
  }

  // Determine output
  if (swap.nativeOutput && BigInt(swap.nativeOutput.amount) > 0n) {
    toMint = SOL;
    toAmount = Number(swap.nativeOutput.amount) / LAMPORTS;
  } else if (swap.tokenOutputs.length > 0) {
    const output = swap.tokenOutputs[0];
    toMint = output.mint;
    toAmount =
      Number(output.rawTokenAmount.tokenAmount) /
      Math.pow(10, output.rawTokenAmount.decimals);
  } else {
    toMint = "unknown";
    toAmount = 0;
  }

  const [fromPrice, toPrice] = await Promise.all([
    getTokenPrice(fromMint),
    getTokenPrice(toMint),
  ]);

  return {
    type: "SWAP",
    wallet,
    walletLabel,
    signature: tx.signature,
    timestamp: tx.timestamp,
    fromToken: await resolveToken(fromMint),
    toToken: await resolveToken(toMint),
    fromAmount,
    toAmount,
    fromValueUsd: fromPrice ? fromAmount * fromPrice : null,
    toValueUsd: toPrice ? toAmount * toPrice : null,
    platform: tx.source || "Unknown DEX",
  };
}

async function parseTokenTransfer(
  tx: HeliusTransaction,
  wallet: string,
  walletLabel: string | null
): Promise<ParsedTransaction> {
  const transfer = tx.tokenTransfers[0];
  const isSender = transfer.fromUserAccount === wallet;

  const price = await getTokenPrice(transfer.mint);

  return {
    type: "TRANSFER",
    wallet,
    walletLabel,
    signature: tx.signature,
    timestamp: tx.timestamp,
    direction: isSender ? "SENT" : "RECEIVED",
    token: await resolveToken(transfer.mint),
    amount: transfer.tokenAmount,
    valueUsd: price ? transfer.tokenAmount * price : null,
    counterparty: isSender
      ? transfer.toUserAccount
      : transfer.fromUserAccount,
  };
}

async function parseNativeTransfer(
  tx: HeliusTransaction,
  wallet: string,
  walletLabel: string | null
): Promise<ParsedTransaction> {
  // Find the largest native transfer involving our wallet
  const relevant = tx.nativeTransfers
    .filter(
      (t) => t.fromUserAccount === wallet || t.toUserAccount === wallet
    )
    .sort((a, b) => b.amount - a.amount);

  const transfer = relevant[0];
  if (!transfer) {
    return {
      type: "UNKNOWN",
      wallet,
      walletLabel,
      signature: tx.signature,
      timestamp: tx.timestamp,
      description: tx.description || "Native transfer",
    };
  }

  const isSender = transfer.fromUserAccount === wallet;
  const solAmount = transfer.amount / LAMPORTS;
  const solPrice = await getTokenPrice(SOL);

  return {
    type: "TRANSFER",
    wallet,
    walletLabel,
    signature: tx.signature,
    timestamp: tx.timestamp,
    direction: isSender ? "SENT" : "RECEIVED",
    token: { mint: SOL, symbol: "SOL", name: "Solana" },
    amount: solAmount,
    valueUsd: solPrice ? solAmount * solPrice : null,
    counterparty: isSender
      ? transfer.toUserAccount
      : transfer.fromUserAccount,
  };
}

async function resolveToken(mint: string): Promise<TokenInfo> {
  if (mint === SOL) return { mint: SOL, symbol: "SOL", name: "Solana" };
  if (mint === "unknown") return { mint: "unknown", symbol: "???", name: "Unknown" };

  const cached = TOKEN_CACHE.get(mint);
  if (cached) return { mint, ...cached };

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`
    );
    const data = (await res.json()) as {
      pairs?: Array<{ baseToken?: { symbol?: string; name?: string } }>;
    };

    if (data.pairs?.[0]?.baseToken) {
      const { symbol, name } = data.pairs[0].baseToken;
      const info = {
        symbol: symbol ?? mint.slice(0, 6),
        name: name ?? "Unknown",
      };
      TOKEN_CACHE.set(mint, info);
      return { mint, ...info };
    }
  } catch {
    // fall through
  }

  const fallback = { symbol: mint.slice(0, 6), name: "Unknown" };
  TOKEN_CACHE.set(mint, fallback);
  return { mint, ...fallback };
}
