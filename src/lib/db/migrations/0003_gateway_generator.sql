-- ---------------------------------------------------------------------------
-- 0003_gateway_generator : record the gateway as its own generator
--
-- Outreach messages store the generator that produced them, so a claim in an
-- email can always be traced back. Once routing moved through the AI Gateway,
-- a gateway-served message was being recorded as 'groq' — the closest value
-- the CHECK allowed — which is false, and would also misattribute cost.
-- ---------------------------------------------------------------------------

ALTER TABLE outreach_messages DROP CONSTRAINT IF EXISTS outreach_generator_check;

ALTER TABLE outreach_messages
  ADD CONSTRAINT outreach_generator_check
  CHECK (generator IN ('gateway', 'groq', 'claude', 'deterministic'));
