const SOL_MINT = "So11111111111111111111111111111111111111112";
const PRICE_CACHE = new Map<string, { price: number; ts: number }>();
const CACHE_TTL = 30_000; // 30 seconds

export async function getTokenPrice(mint: string): Promise<number | null> {
  const cached = PRICE_CACHE.get(mint);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.price;
  }

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`
    );
    const data = (await res.json()) as {
      pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }>;
    };

    if (!data.pairs || data.pairs.length === 0) return null;

    // Pick the pair with highest liquidity
    const best = data.pairs
      .filter((p) => p.priceUsd)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

    if (!best?.priceUsd) return null;

    const price = parseFloat(best.priceUsd);
    PRICE_CACHE.set(mint, { price, ts: Date.now() });
    return price;
  } catch {
    return null;
  }
}

export async function getSolPrice(): Promise<number | null> {
  return getTokenPrice(SOL_MINT);
}

export function getTokenSymbol(mint: string): string {
  if (mint === SOL_MINT) return "SOL";
  return mint.slice(0, 4) + "..." + mint.slice(-4);
}

export const SOL = SOL_MINT;
