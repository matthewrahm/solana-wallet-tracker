import "dotenv/config";
import { createBot } from "./bot.js";
import { WalletSubscriber } from "./watcher/subscriber.js";

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("BOT_TOKEN is required. Add it to your .env file.");
  process.exit(1);
}

if (!process.env.HELIUS_API_KEY) {
  console.error("HELIUS_API_KEY is required. Add it to your .env file.");
  process.exit(1);
}

let subscriber: WalletSubscriber;

const bot = createBot(token, () => subscriber);

subscriber = new WalletSubscriber(bot);

bot.launch(() => {
  console.log("Wallet Tracker bot is running.");
  subscriber.start();
});

process.once("SIGINT", () => {
  subscriber.stop();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  subscriber.stop();
  bot.stop("SIGTERM");
});
