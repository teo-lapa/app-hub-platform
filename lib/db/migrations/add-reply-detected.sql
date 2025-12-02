-- Migration: Add reply_detected column to email_messages
-- Date: 2025-12-02
-- Description: Track when a reply has been detected in the Gmail thread

-- Add reply_detected column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'email_messages' AND column_name = 'reply_detected'
    ) THEN
        ALTER TABLE email_messages ADD COLUMN reply_detected BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create index for filtering replied emails
CREATE INDEX IF NOT EXISTS idx_emails_reply_detected ON email_messages(reply_detected) WHERE reply_detected = true;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'email_messages' AND column_name = 'reply_detected';
