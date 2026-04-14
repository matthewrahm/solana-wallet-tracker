# solana-wallet-tracker

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-9945FF?logo=solana&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram_Bot-26A5E4?logo=telegram&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

Telegram bot that monitors Solana wallets in real-time and sends formatted alerts for swaps, transfers, and other on-chain activity. Track any wallet, get instant notifications when it moves.

Useful for watching smart money wallets, monitoring your own positions, tracking developer wallets before a token launch, or keeping tabs on wallets connected to projects you hold. Add a wallet with one command, get clean trading-terminal-style alerts in Telegram whenever it does anything on-chain.

## Features

### Real-Time Monitoring

Two monitoring strategies run in parallel for reliability:

- **WebSocket** -- Helius WebSocket subscription for instant transaction detection. Auto-reconnects with exponential backoff (5s to 60s max) and re-subscribes to all wallets on reconnection.
- **Polling** -- Helius RPC polling every 10 seconds as a fallback. Deduplicates against already-seen transactions (tracks up to 10,000 signatures).

### Transaction Parsing

Automatically identifies and formats three transaction types:

- **Swaps** -- Detects token swaps on Jupiter, Raydium, and PumpSwap. Shows input/output tokens, amounts, USD values, and which DEX was used.
- **Transfers** -- Identifies SOL and token transfers. Shows direction (sent/received), amount, USD value, and counterparty address.
- **Other Activity** -- Catches everything else with the raw activity type and description.

### Smart Data Enrichment

- **Token resolution** -- Resolves raw mint addresses to human-readable names and ticker symbols via DexScreener, with an in-memory cache to avoid redundant lookups.
- **USD pricing** -- Automatic price lookups for all tokens involved in a transaction. Prices cached for 30 seconds. Selects the highest-liquidity trading pair when multiple exist.
- **Enriched transactions** -- Fetches full enriched transaction data from Helius for accurate swap detection and amount parsing.

### Alert Format

Alerts are sent as HTML-formatted Telegram messages with clickable links:

```
SWAP  --  Smart Money #1
--------------------------
2.50 SOL  ->  1.20M BONK
Value: ~$412.50
Jupiter

View Tx  --  Wallet  --  2m ago
```

```
SENT  --  Dev Wallet
--------------------------
10.00 SOL -> 7vK...mN3
Value: ~$1,650.00

View Tx  --  Wallet  --  3m ago
```

Each alert includes links to Solscan for the transaction and wallet.

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show help and list available commands |
| `/watch <address> [label]` | Start tracking a wallet with an optional label |
| `/unwatch <address>` | Stop tracking a wallet |
| `/wallets` | List all wallets you are currently tracking |
| `/ping` | Health check |

Wallet addresses are validated against Solana's base58 format (32-44 characters). Each wallet can have a custom label that appears in alerts.

## Architecture

```
    Telegram (Telegraf)
         |
    Bot Commands ──→ SQLite (wallet persistence)
         |
    ┌────┴────┐
    |         |
  Poller   Subscriber
  (10s RPC)  (WebSocket)
    |         |
    └────┬────┘
         |
    Helius API (enriched transactions)
         |
    Parser (swap / transfer / unknown)
         |
    DexScreener (token names + prices)
         |
    Formatter (HTML Telegram message)
         |
    Send to all chats tracking that wallet
```

**Data flow:**

1. User adds a wallet via `/watch` -- stored in SQLite, subscribed to via WebSocket and polling
2. When a transaction is detected (either channel), the bot fetches enriched data from Helius
3. The parser identifies the transaction type and extracts amounts, tokens, and counterparties
4. Token symbols and USD prices are resolved via DexScreener
5. The formatter builds an HTML message with all details and Solscan links
6. The alert is sent to every Telegram chat tracking that wallet

### Persistence

Tracked wallets are stored in SQLite (`wallets.db`) and survive restarts. The schema is one table with address, label, chat ID, and creation timestamp. Duplicate wallet-per-chat combinations are silently ignored.

### Authorization

Access is restricted to specific Telegram user IDs defined in `config.yaml`. Unauthorized messages are silently dropped -- no error response is sent.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js, TypeScript |
| Telegram | Telegraf |
| Blockchain data | Helius RPC + WebSocket + enriched transactions API |
| Token prices | DexScreener API |
| Database | better-sqlite3 |
| Config | YAML (config.yaml) + dotenv (.env) |

## Getting Started

### Prerequisites

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A [Helius](https://helius.dev) API key (free tier works)
- Your Telegram user ID (get it from [@userinfobot](https://t.me/userinfobot))

### Configure

```sh
cp .env.example .env
```

Fill in the required values:

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from BotFather |
| `HELIUS_API_KEY` | Yes | Helius API key for on-chain data and WebSocket |

Edit `config.yaml` to add your Telegram user ID to the allowed users list:

```yaml
allowed_users:
  - 123456789
```

### Install and run

```sh
npm install
npm run build
npm start
```

### Development

```sh
npm run dev    # Runs with tsx watch (auto-restart on changes)
```

### Run with PM2 (recommended for production)

```sh
npm run build
pm2 start dist/index.js --name wallet-tracker
pm2 save
```

## Project Structure

```
src/
  index.ts                      # Entry point, starts bot + poller, graceful shutdown
  bot.ts                        # Telegraf command handlers (watch, unwatch, wallets, ping)
  config.ts                     # Loads config.yaml (allowed users)
  auth.ts                       # Authorization middleware (checks Telegram user ID)
  watcher/
    connection.ts               # Helius WebSocket connection with auto-reconnect
    poller.ts                   # RPC polling fallback (10s interval, deduplication)
    subscriber.ts               # WebSocket subscription manager
  parser/
    index.ts                    # Transaction parser (swap, transfer, unknown detection)
    types.ts                    # TypeScript types (ParsedTransaction, SwapTransaction, etc.)
  formatter/
    telegram.ts                 # HTML formatter for Telegram alerts
  lib/
    helius.ts                   # Helius URL helpers and enriched transaction fetcher
    price.ts                    # DexScreener price lookups with 30s cache
    store.ts                    # SQLite wallet persistence (add, remove, list, query)
config.yaml                     # Allowed Telegram user IDs
.env                            # Bot token + Helius API key
```

## License

MIT
