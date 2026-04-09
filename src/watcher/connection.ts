import WebSocket from "ws";
import { getHeliusWsUrl } from "../lib/helius.js";

type TransactionCallback = (signature: string, wallet: string) => void;

export class HeliusConnection {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, number>(); // address -> subscription ID
  private nextId = 1;
  private onTransaction: TransactionCallback;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSubscriptions = new Set<string>();
  private requestIdToAddress = new Map<number, string>();
  private reconnectDelay = 5_000;
  private connected = false;

  constructor(onTransaction: TransactionCallback) {
    this.onTransaction = onTransaction;
  }

  connect(): void {
    // Clean up any existing connection
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    const url = getHeliusWsUrl();
    console.log("Connecting to Helius WebSocket...");
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("Helius WebSocket connected.");
      this.connected = true;
      this.reconnectDelay = 5_000; // Reset backoff on success

      // Re-subscribe all known addresses
      const allAddresses = new Set([
        ...this.subscriptions.keys(),
        ...this.pendingSubscriptions,
      ]);
      this.subscriptions.clear();

      for (const address of allAddresses) {
        this.pendingSubscriptions.add(address);
        this.sendSubscribe(address);
      }
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Subscription confirmation
        if (msg.result !== undefined && msg.id) {
          const address = this.findPendingAddress(msg.id);
          if (address) {
            this.subscriptions.set(address, msg.result);
            this.pendingSubscriptions.delete(address);
            console.log(`Subscribed to ${address} (sub ID: ${msg.result})`);
          }
          return;
        }

        // Log notification
        if (msg.method === "logsNotification" && msg.params) {
          const subId = msg.params.subscription;
          const address = this.findAddressBySubId(subId);
          if (address) {
            const signature = msg.params.result?.value?.signature;
            if (signature) {
              this.onTransaction(signature, address);
            }
          }
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    });

    this.ws.on("close", (code) => {
      this.connected = false;
      console.log(`Helius WebSocket closed (code: ${code}). Reconnecting in ${this.reconnectDelay / 1000}s...`);
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("Helius WebSocket error:", err.message);
      // Don't reconnect here — the "close" event will fire after error
    });
  }

  subscribe(address: string): void {
    if (this.subscriptions.has(address) || this.pendingSubscriptions.has(address)) {
      return;
    }

    this.pendingSubscriptions.add(address);

    // Connect if not yet connected
    if (!this.connected && !this.ws) {
      this.connect();
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(address);
    }
  }

  unsubscribe(address: string): void {
    this.pendingSubscriptions.delete(address);
    const subId = this.subscriptions.get(address);
    if (subId === undefined) return;

    this.subscriptions.delete(address);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: this.nextId++,
          method: "logsUnsubscribe",
          params: [subId],
        })
      );
    }
  }

  private sendSubscribe(address: string): void {
    const id = this.nextId++;
    this.requestIdToAddress.set(id, address);

    this.ws!.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "logsSubscribe",
        params: [
          { mentions: [address] },
          { commitment: "confirmed" },
        ],
      })
    );
  }

  private findPendingAddress(requestId: number): string | undefined {
    const address = this.requestIdToAddress.get(requestId);
    if (address) {
      this.requestIdToAddress.delete(requestId);
    }
    return address;
  }

  private findAddressBySubId(subId: number): string | undefined {
    for (const [address, id] of this.subscriptions) {
      if (id === subId) return address;
    }
    return undefined;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff: 5s → 10s → 20s → 40s → max 60s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000);
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.removeAllListeners();
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}
