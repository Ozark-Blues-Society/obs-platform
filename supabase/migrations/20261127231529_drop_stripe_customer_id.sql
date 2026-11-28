-- M-3 (decision 0007): Zeffy takes the membership payments, not Stripe, so the Stripe customer id
-- from M-2 goes. It was always null and nothing reads it. Zeffy payments carry no customer id or
-- metadata: they are matched to members by the buyer's email (docs/spec/architecture.md, "Zeffy →
-- Supabase"). Dropping the column drops its unique constraint with it.

alter table public.profiles drop column stripe_customer_id;
