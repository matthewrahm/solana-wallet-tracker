import "dotenv/config";
import { createBot } from "./bot.js";
import { WalletPoller } from "./watcher/poller.js";

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("BOT_TOKEN is required. Add it to your .env file.");
  process.exit(1);
}

if (!process.env.HELIUS_API_KEY) {
  console.error("HELIUS_API_KEY is required. Add it to your .env file.");
  process.exit(1);
}

let poller: WalletPoller;

const bot = createBot(token, () => poller);

poller = new WalletPoller(bot);

bot.launch(() => {
  console.log("Wallet Tracker bot is running.");
  poller.start();
});

process.once("SIGINT", () => {
  poller.stop();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  poller.stop();
  bot.stop("SIGTERM");
});
