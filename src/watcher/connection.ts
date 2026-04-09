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

  constructor(onTransaction: TransactionCallback) {
    this.onTransaction = onTransaction;
  }

  connect(): void {
    const url = getHeliusWsUrl();
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("Helius WebSocket connected.");
      // Re-subscribe all addresses after reconnect
      for (const address of this.subscriptions.keys()) {
        this.pendingSubscriptions.add(address);
        this.sendSubscribe(address);
      }
      for (const address of this.pendingSubscriptions) {
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

        // Transaction notification
        if (msg.method === "accountNotification" && msg.params) {
          const subId = msg.params.subscription;
          const address = this.findAddressBySubId(subId);
          if (address) {
            const signature = msg.params.result?.value?.signature
              ?? msg.params.result?.signature;
            if (signature) {
              this.onTransaction(signature, address);
            }
          }
        }

        // Log notification — Helius sends "logsNotification" for account subscriptions
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

    this.ws.on("close", () => {
      console.log("Helius WebSocket disconnected. Reconnecting in 5s...");
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("Helius WebSocket error:", err.message);
    });
  }

  subscribe(address: string): void {
    if (this.subscriptions.has(address) || this.pendingSubscriptions.has(address)) {
      return;
    }

    this.pendingSubscriptions.add(address);

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
    // Store the mapping of request ID to address for confirmation handling
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

  private requestIdToAddress = new Map<number, string>();

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
    }, 5_000);
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
