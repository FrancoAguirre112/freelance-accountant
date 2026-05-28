-- Adds the Slack incoming-webhook URL column to the user record.
-- NULL = the user opted out (no reminders sent).
ALTER TABLE "user" ADD COLUMN slackWebhookUrl TEXT;
