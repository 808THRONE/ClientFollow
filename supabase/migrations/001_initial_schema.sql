-- ClientFollow Migration 001: Initial Schema
-- Multi-tenant schema with organizations, members, encrypted integrations, leads, playbooks, runs, and messages.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    industry TEXT CHECK (industry IN ('dentist', 'agency', 'photographer', 'lawyer', 'home_services', 'other')),
    plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'growth', 'pro')),
    active_leads_limit INT NOT NULL DEFAULT 30,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id);

-- 2. ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id) in Supabase
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);

-- 3. CHANNEL INTEGRATIONS
CREATE TABLE IF NOT EXISTS channel_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('gmail', 'whatsapp')),
    account_identifier TEXT NOT NULL,
    encrypted_access_token BYTEA,
    encrypted_refresh_token BYTEA,
    token_iv BYTEA NOT NULL,
    token_auth_tag BYTEA NOT NULL,
    kms_key_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired', 'error')),
    last_synced_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, channel_type, account_identifier)
);

CREATE INDEX IF NOT EXISTS idx_channel_integrations_org ON channel_integrations(org_id);

-- 4. LEADS
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'whatsapp', 'webhook', 'manual')),
    status TEXT NOT NULL DEFAULT 'new_lead' CHECK (status IN ('new_lead', 'contacted', 'replied', 'booked', 'lost', 'queued_over_quota')),
    detected_service TEXT,
    detected_urgency TEXT DEFAULT 'medium' CHECK (detected_urgency IN ('low', 'medium', 'high')),
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('neutral', 'positive', 'objection', 'unsubscribed')),
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approval_pending BOOLEAN NOT NULL DEFAULT FALSE,
    external_thread_id TEXT,
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_external_thread ON leads(external_thread_id);

-- 5. SEQUENCE PLAYBOOKS
CREATE TABLE IF NOT EXISTS sequence_playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    steps JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_org ON sequence_playbooks(org_id);

-- 6. FOLLOW-UP RUNS
CREATE TABLE IF NOT EXISTS follow_up_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    playbook_id UUID REFERENCES sequence_playbooks(id) ON DELETE SET NULL,
    inngest_run_id TEXT,
    current_step INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused_for_approval', 'completed', 'cancelled_by_reply', 'cancelled_by_booking')),
    next_touch_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_runs_lead ON follow_up_runs(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_runs_status ON follow_up_runs(status);

-- 7. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    channel TEXT NOT NULL CHECK (channel IN ('gmail', 'whatsapp', 'sms')),
    external_message_id TEXT,
    content_snippet_encrypted BYTEA NOT NULL,
    snippet_iv BYTEA NOT NULL,
    snippet_auth_tag BYTEA NOT NULL,
    kms_key_id TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);

-- ROW LEVEL SECURITY
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
