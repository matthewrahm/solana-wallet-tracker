import { getHeliusRpcUrl } from "../lib/helius.js";
import { getEnrichedTransaction } from "../lib/helius.js";
import { parseTransaction } from "../parser/index.js";
import { formatTransaction } from "../formatter/telegram.js";
import { getAllWallets } from "../lib/store.js";
import type { HeliusTransaction } from "../parser/types.js";
import type { Telegraf } from "telegraf";

const POLL_INTERVAL = 10_000; // 10 seconds
const SEEN_SIGS = new Set<string>();
const MAX_SEEN = 10_000;

// Track the last seen signature per wallet to avoid re-processing
const lastSeen = new Map<string, string>();

export class WalletPoller {
  private bot: Telegraf;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  start(): void {
    const wallets = getAllWallets();
    console.log(`Watching ${wallets.length} wallet(s).`);

    if (wallets.length === 0) {
      console.log("No wallets to watch. Use /watch to add one.");
    }

    // Initial poll to seed last-seen signatures (don't alert on old txs)
    this.seedLastSeen().then(() => {
      this.timer = setInterval(() => this.poll(), POLL_INTERVAL);
      console.log(`Polling every ${POLL_INTERVAL / 1000}s.`);
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async seedLastSeen(): Promise<void> {
    const wallets = getAllWallets();
    for (const w of wallets) {
      try {
        const sigs = await getRecentSignatures(w.address, 1);
        if (sigs.length > 0) {
          lastSeen.set(w.address, sigs[0].signature);
          SEEN_SIGS.add(sigs[0].signature);
        }
      } catch (err) {
        console.error(`Failed to seed ${w.address}:`, err);
      }
      // Small delay to avoid rate limiting
      await sleep(500);
    }
    console.log("Seeded last-seen signatures.");
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;

    const wallets = getAllWallets();

    for (const w of wallets) {
      try {
        const last = lastSeen.get(w.address);
        const sigs = await getRecentSignatures(w.address, 5, last);

        // Process newest first, but we got them newest-first from RPC
        // Reverse so we process oldest new tx first (chronological order)
        const newSigs = sigs
          .filter((s) => !SEEN_SIGS.has(s.signature))
          .reverse();

        for (const sig of newSigs) {
          SEEN_SIGS.add(sig.signature);
          evictOldSigs();

          try {
            await this.handleTransaction(sig.signature, w.address);
          } catch (err) {
            console.error(`Error handling tx ${sig.signature}:`, err);
          }

          await sleep(500); // Don't hammer the enriched API
        }

        // Update last seen to the most recent signature
        if (sigs.length > 0) {
          lastSeen.set(w.address, sigs[0].signature);
        }
      } catch (err) {
        console.error(`Poll error for ${w.address}:`, err);
      }

      await sleep(200); // Small gap between wallets
    }

    this.polling = false;
  }

  private async handleTransaction(
    signature: string,
    walletAddress: string
  ): Promise<void> {
    const enriched = await getEnrichedTransaction(signature);
    if (!enriched) {
      console.log(`No enriched data for ${signature}`);
      return;
    }

    const parsed = await parseTransaction(
      enriched as unknown as HeliusTransaction,
      walletAddress
    );

    // Skip unknown transactions to reduce noise
    if (parsed.type === "UNKNOWN") return;

    const message = formatTransaction(parsed);

    // Send to all chats tracking this wallet
    const wallets = getAllWallets();
    const chatIds = new Set(
      wallets
        .filter((wt) => wt.address === walletAddress)
        .map((wt) => wt.chat_id)
    );

    for (const chatId of chatIds) {
      try {
        await this.bot.telegram.sendMessage(chatId, message, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
      } catch (err) {
        console.error(`Failed to send to chat ${chatId}:`, err);
      }
    }
  }
}

interface SignatureInfo {
  signature: string;
  blockTime: number | null;
}

async function getRecentSignatures(
  address: string,
  limit: number,
  until?: string
): Promise<SignatureInfo[]> {
  const params: unknown[] = [
    address,
    { limit, commitment: "confirmed", ...(until ? { until } : {}) },
  ];

  const res = await fetch(getHeliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params,
    }),
  });

  const data = (await res.json()) as {
    result?: SignatureInfo[];
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result ?? [];
}

function evictOldSigs(): void {
  if (SEEN_SIGS.size > MAX_SEEN) {
    const first = SEEN_SIGS.values().next().value;
    if (first) SEEN_SIGS.delete(first);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
