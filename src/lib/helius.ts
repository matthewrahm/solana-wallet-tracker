const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;

export function getHeliusWsUrl(): string {
  return `wss://atlas-mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
}

export function getHeliusRpcUrl(): string {
  return `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
}

export async function getEnrichedTransaction(signature: string) {
  const url = `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions: [signature] }),
  });

  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data[0] ?? null;
}
