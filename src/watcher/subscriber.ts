import { Telegraf } from "telegraf";
import { HeliusConnection } from "./connection.js";
import { getEnrichedTransaction } from "../lib/helius.js";
import { parseTransaction } from "../parser/index.js";
import { formatTransaction } from "../formatter/telegram.js";
import { getAllWallets } from "../lib/store.js";
import type { HeliusTransaction } from "../parser/types.js";

const SEEN_SIGS = new Set<string>();
const MAX_SEEN = 10_000;

export class WalletSubscriber {
  private connection: HeliusConnection;
  private bot: Telegraf;
  private processing = false;
  private queue: Array<{ signature: string; wallet: string }> = [];

  constructor(bot: Telegraf) {
    this.bot = bot;
    this.connection = new HeliusConnection((signature, wallet) => {
      this.enqueue(signature, wallet);
    });
  }

  start(): void {
    // Subscribe to all wallets from the database
    const wallets = getAllWallets();
    console.log(`Watching ${wallets.length} wallet(s).`);

    if (wallets.length > 0) {
      // Only connect if there are wallets to watch
      this.connection.connect();
      for (const w of wallets) {
        this.connection.subscribe(w.address);
      }
    } else {
      console.log("No wallets to watch. Use /watch to add one.");
    }
  }

  subscribe(address: string): void {
    this.connection.subscribe(address);
  }

  unsubscribe(address: string): void {
    this.connection.unsubscribe(address);
  }

  stop(): void {
    this.connection.disconnect();
  }

  private enqueue(signature: string, wallet: string): void {
    // Deduplicate
    if (SEEN_SIGS.has(signature)) return;
    SEEN_SIGS.add(signature);

    // Evict old entries
    if (SEEN_SIGS.size > MAX_SEEN) {
      const first = SEEN_SIGS.values().next().value;
      if (first) SEEN_SIGS.delete(first);
    }

    this.queue.push({ signature, wallet });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await this.handleTransaction(item.signature, item.wallet);
      } catch (err) {
        console.error(`Error processing tx ${item.signature}:`, err);
      }
    }

    this.processing = false;
  }

  private async handleTransaction(
    signature: string,
    walletAddress: string
  ): Promise<void> {
    // Brief delay to let Helius index the enriched transaction
    await new Promise((r) => setTimeout(r, 2_000));

    const enriched = await getEnrichedTransaction(signature);
    if (!enriched) {
      console.log(`No enriched data for ${signature}`);
      return;
    }

    const parsed = await parseTransaction(
      enriched as unknown as HeliusTransaction,
      walletAddress
    );

    // Skip unknown/boring transactions to avoid spam
    if (parsed.type === "UNKNOWN") return;

    const message = formatTransaction(parsed);

    // Send to all chats tracking this wallet
    const wallets = getAllWallets();
    const chatIds = new Set(
      wallets
        .filter((w) => w.address === walletAddress)
        .map((w) => w.chat_id)
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
