-- ClientFollow Migration 003: Tenant RLS Policies & Notification Settings
-- Adds notification_preferences to organizations and implements multi-tenant RLS policies.

-- 1. ADD NOTIFICATION PREFERENCES COLUMN TO ORGANIZATIONS
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "emailAlerts": true,
  "smsAlerts": false,
  "whatsAppAlerts": false,
  "digestFrequency": "daily"
}'::JSONB;

-- 2. ENSURE UNIQUE CONSTRAINT ON SEQUENCE PLAYBOOKS (org_id + industry)
ALTER TABLE sequence_playbooks
DROP CONSTRAINT IF EXISTS uq_playbooks_org_industry;

ALTER TABLE sequence_playbooks
ADD CONSTRAINT uq_playbooks_org_industry UNIQUE (org_id, industry);

-- 3. TENANT ISOLATION HELPER FUNCTION
CREATE OR REPLACE FUNCTION current_user_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM organization_members WHERE user_id = auth.uid();
$$;

-- 4. ROW LEVEL SECURITY POLICIES

-- Organizations
DROP POLICY IF EXISTS org_select_policy ON organizations;
CREATE POLICY org_select_policy ON organizations
  FOR SELECT
  USING (id IN (SELECT org_id FROM current_user_org_ids()));

DROP POLICY IF EXISTS org_update_policy ON organizations;
CREATE POLICY org_update_policy ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Organization Members
DROP POLICY IF EXISTS org_members_policy ON organization_members;
CREATE POLICY org_members_policy ON organization_members
  FOR ALL
  USING (org_id IN (SELECT org_id FROM current_user_org_ids()));

-- Channel Integrations (Encrypted credentials)
DROP POLICY IF EXISTS channel_integrations_policy ON channel_integrations;
CREATE POLICY channel_integrations_policy ON channel_integrations
  FOR ALL
  USING (org_id IN (SELECT org_id FROM current_user_org_ids()));

-- Leads
DROP POLICY IF EXISTS leads_tenant_policy ON leads;
CREATE POLICY leads_tenant_policy ON leads
  FOR ALL
  USING (org_id IN (SELECT org_id FROM current_user_org_ids()));

-- Sequence Playbooks
DROP POLICY IF EXISTS playbooks_tenant_policy ON sequence_playbooks;
CREATE POLICY playbooks_tenant_policy ON sequence_playbooks
  FOR ALL
  USING (org_id IN (SELECT org_id FROM current_user_org_ids()));

-- Follow Up Runs
DROP POLICY IF EXISTS runs_tenant_policy ON follow_up_runs;
CREATE POLICY runs_tenant_policy ON follow_up_runs
  FOR ALL
  USING (org_id IN (SELECT org_id FROM current_user_org_ids()));

-- Messages
DROP POLICY IF EXISTS messages_tenant_policy ON messages;
CREATE POLICY messages_tenant_policy ON messages
  FOR ALL
  USING (org_id IN (SELECT org_id FROM current_user_org_ids()));
