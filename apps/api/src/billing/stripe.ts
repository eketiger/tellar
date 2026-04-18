import Stripe from 'stripe';

let client: Stripe | null = null;

export function stripe(): Stripe | null {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
  return client;
}

export const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO || '',
  scale: process.env.STRIPE_PRICE_SCALE || '',
};
