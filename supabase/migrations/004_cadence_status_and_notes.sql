-- ClientFollow Migration 004: Cadence status truthfulness + operator notes
-- Adds cancellation-by-rejection statuses to follow_up_runs and a notes column to leads.

ALTER TABLE public.follow_up_runs
    DROP CONSTRAINT IF EXISTS follow_up_runs_status_check;

ALTER TABLE public.follow_up_runs
    ADD CONSTRAINT follow_up_runs_status_check
    CHECK (status IN (
        'running',
        'paused_for_approval',
        'completed',
        'cancelled',
        'cancelled_by_reply',
        'cancelled_by_booking',
        'cancelled_by_rejection'
    ));

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS notes TEXT;
