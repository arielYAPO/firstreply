-- Migration V3: Manual PayPal.Me payment flow with admin validation
-- Run this in Supabase SQL Editor

-- Payment requests (replaces the old payments table for the beta flow)
CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL DEFAULT 1000,
  currency text NOT NULL DEFAULT 'EUR',
  credits_requested integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pending',  -- pending | paid | rejected | expired
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  validated_by text,  -- admin email or identifier
  admin_note text,
  paypal_reference text  -- admin can note the PayPal transaction ID
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own payment requests
CREATE POLICY "Users can read own payment_requests"
  ON payment_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own payment requests
CREATE POLICY "Users can insert own payment_requests"
  ON payment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only service role can update (admin validation)
-- No update policy for regular users = they can't modify their requests
