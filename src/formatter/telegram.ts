import type {
  ParsedTransaction,
  SwapTransaction,
  TransferTransaction,
  UnknownTransaction,
} from "../parser/types.js";

const SOLSCAN_TX = "https://solscan.io/tx/";
const SOLSCAN_ADDR = "https://solscan.io/account/";

export function formatTransaction(tx: ParsedTransaction): string {
  switch (tx.type) {
    case "SWAP":
      return formatSwap(tx);
    case "TRANSFER":
      return formatTransfer(tx);
    case "UNKNOWN":
      return formatUnknown(tx);
  }
}

function formatSwap(tx: SwapTransaction): string {
  const label = tx.walletLabel
    ? `${tx.walletLabel}`
    : shortAddr(tx.wallet);

  const fromAmt = formatAmount(tx.fromAmount);
  const toAmt = formatAmount(tx.toAmount);

  const valueStr = tx.toValueUsd
    ? `\n💰 Value: ~$${formatUsd(tx.toValueUsd)}`
    : tx.fromValueUsd
      ? `\n💰 Value: ~$${formatUsd(tx.fromValueUsd)}`
      : "";

  return [
    `🔄 <b>SWAP</b>  ·  ${label}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `${fromAmt} <b>${esc(tx.fromToken.symbol)}</b>  →  ${toAmt} <b>${esc(tx.toToken.symbol)}</b>${valueStr}`,
    `📍 ${esc(tx.platform)}`,
    ``,
    `<a href="${SOLSCAN_TX}${tx.signature}">View Tx</a>  ·  <a href="${SOLSCAN_ADDR}${tx.wallet}">Wallet</a>  ·  ${timeAgo(tx.timestamp)}`,
  ].join("\n");
}

function formatTransfer(tx: TransferTransaction): string {
  const label = tx.walletLabel
    ? `${tx.walletLabel}`
    : shortAddr(tx.wallet);

  const icon = tx.direction === "SENT" ? "📤" : "📥";
  const dirWord = tx.direction === "SENT" ? "Sent" : "Received";
  const preposition = tx.direction === "SENT" ? "→" : "←";
  const amt = formatAmount(tx.amount);

  const valueStr = tx.valueUsd
    ? `\n💰 Value: ~$${formatUsd(tx.valueUsd)}`
    : "";

  return [
    `${icon} <b>${dirWord.toUpperCase()}</b>  ·  ${label}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `${amt} <b>${esc(tx.token.symbol)}</b> ${preposition} ${shortAddr(tx.counterparty)}${valueStr}`,
    ``,
    `<a href="${SOLSCAN_TX}${tx.signature}">View Tx</a>  ·  <a href="${SOLSCAN_ADDR}${tx.wallet}">Wallet</a>  ·  ${timeAgo(tx.timestamp)}`,
  ].join("\n");
}

function formatUnknown(tx: UnknownTransaction): string {
  const label = tx.walletLabel
    ? `${tx.walletLabel}`
    : shortAddr(tx.wallet);

  return [
    `📋 <b>ACTIVITY</b>  ·  ${label}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `${esc(tx.description)}`,
    ``,
    `<a href="${SOLSCAN_TX}${tx.signature}">View Tx</a>  ·  ${timeAgo(tx.timestamp)}`,
  ].join("\n");
}

function shortAddr(addr: string): string {
  return `<code>${addr.slice(0, 4)}...${addr.slice(-4)}</code>`;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.001) return n.toFixed(4);
  return n.toExponential(2);
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
