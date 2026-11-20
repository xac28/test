/** Whether a real (non-placeholder) Stripe secret key is configured — same check the bookings route uses to decide whether to actually call Stripe. */
export function stripeReady(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? ""
  return key.startsWith("sk_") && !/dummy|placeholder|change-?me|xxxx/i.test(key)
}
