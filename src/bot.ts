import { Telegraf } from "telegraf";
import { authMiddleware } from "./auth.js";
import { addWallet, removeWallet, listWallets } from "./lib/store.js";
import type { WalletSubscriber } from "./watcher/subscriber.js";

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function createBot(
  token: string,
  getSubscriber: () => WalletSubscriber
): Telegraf {
  const bot = new Telegraf(token);

  bot.use(authMiddleware);

  bot.command("start", (ctx) =>
    ctx.reply(
      [
        "<b>Solana Wallet Tracker</b>",
        "",
        "📡 Real-time transaction alerts for any Solana wallet.",
        "",
        "<b>Commands</b>",
        "/watch &lt;address&gt; [label] — Track a wallet",
        "/unwatch &lt;address&gt; — Stop tracking",
        "/wallets — List tracked wallets",
        "/ping — Health check",
      ].join("\n"),
      { parse_mode: "HTML" }
    )
  );

  bot.command("ping", (ctx) => ctx.reply("Pong! Tracker is alive."));

  bot.command("watch", (ctx) => {
    const text = ctx.message.text;
    const parts = text.split(/\s+/);
    const address = parts[1];
    const label = parts.slice(2).join(" ") || null;

    if (!address || !SOLANA_ADDR_RE.test(address)) {
      return ctx.reply(
        "Usage: /watch &lt;solana_address&gt; [label]\n\nExample:\n<code>/watch DJx...4kR Smart Money #1</code>",
        { parse_mode: "HTML" }
      );
    }

    const added = addWallet(address, label, ctx.chat.id);

    if (!added) {
      return ctx.reply("Already watching this wallet.");
    }

    getSubscriber().subscribe(address);

    const display = label ? `${label} (${shortAddr(address)})` : shortAddr(address);
    return ctx.reply(
      `👁 Now watching <b>${display}</b>\n\nYou'll receive alerts for all swaps and transfers.`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("unwatch", (ctx) => {
    const text = ctx.message.text;
    const address = text.split(/\s+/)[1];

    if (!address) {
      return ctx.reply("Usage: /unwatch <address>");
    }

    const removed = removeWallet(address, ctx.chat.id);

    if (!removed) {
      return ctx.reply("Wallet not found in your watch list.");
    }

    getSubscriber().unsubscribe(address);
    return ctx.reply(`Stopped watching <code>${shortAddr(address)}</code>.`, {
      parse_mode: "HTML",
    });
  });

  bot.command("wallets", (ctx) => {
    const wallets = listWallets(ctx.chat.id);

    if (wallets.length === 0) {
      return ctx.reply(
        "No wallets tracked yet.\n\nUse /watch <address> [label] to start."
      );
    }

    const lines = wallets.map((w, i) => {
      const label = w.label ? `<b>${escHtml(w.label)}</b>` : "Unlabeled";
      return `${i + 1}. ${label}\n   <code>${w.address}</code>`;
    });

    return ctx.reply(
      [`<b>Tracked Wallets</b> (${wallets.length})`, "", ...lines].join("\n"),
      { parse_mode: "HTML" }
    );
  });

  return bot;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function escHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
