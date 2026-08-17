-- ---------------------------------------------------------------------------
-- 0002_outreach : turning a ranked list into actual client acquisition
--
-- A shortlist is only worth what you do with it. This migration adds the two
-- things missing between "here is a good prospect" and "we are talking to
-- them": the outreach you generated, and the history of what happened next.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- outreach_messages : generated pitches, kept with the evidence they cite
--
-- Every message stores the audit findings it was built from, so a claim in an
-- email can always be traced back to something actually observed on the site.
-- Messages are never sent from here; this application drafts, it does not mail.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel        text NOT NULL DEFAULT 'email',
  language       text NOT NULL DEFAULT 'es',
  subject        text NOT NULL,
  body           text NOT NULL,
  -- The single strongest reason to make contact, chosen from the audit.
  angle          text,
  -- The issue codes / facts quoted, so nothing in the copy is unsourced.
  evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 'groq' when a model wrote it, 'deterministic' when the template did.
  generator      text NOT NULL DEFAULT 'deterministic',
  model          text,
  prompt_version integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_channel_check
    CHECK (channel IN ('email', 'whatsapp', 'call_script', 'linkedin')),
  CONSTRAINT outreach_language_check
    CHECK (language IN ('es', 'en')),
  CONSTRAINT outreach_generator_check
    CHECK (generator IN ('groq', 'claude', 'deterministic'))
);

CREATE INDEX IF NOT EXISTS outreach_messages_business_idx
  ON outreach_messages (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_messages_created_idx
  ON outreach_messages (created_at DESC);

-- ---------------------------------------------------------------------------
-- crm_activity : an append-only timeline per prospect
--
-- crm_status holds the current state; this holds how it got there. Rows are
-- never updated, so the history cannot be quietly rewritten.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  from_status text,
  to_status   text,
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_activity_kind_check CHECK (
    kind IN ('status_change', 'note', 'outreach_generated', 'outreach_sent', 'demo_generated')
  )
);

CREATE INDEX IF NOT EXISTS crm_activity_business_idx
  ON crm_activity (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_activity_created_idx
  ON crm_activity (created_at DESC);

-- ---------------------------------------------------------------------------
-- crm_status gains the two fields outreach actually needs to be followed up.
-- ---------------------------------------------------------------------------
ALTER TABLE crm_status ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE crm_status ADD COLUMN IF NOT EXISTS contact_channel   text;
