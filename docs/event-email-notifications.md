# Event email notifications

Available places are reserved for the earliest waitlisted parents, ordered by their original joining time. Each parent must sign in and explicitly accept or decline. Opening an email link does not change participation. Each new offer divides the time remaining until joining closes by the number of parents still awaiting a place (WAITLISTED plus OFFERED, including the recipient), capped at 12 hours. Closing means the earlier of the joining deadline and event start (the end of an all-day event). For example, 24 hours and 6 parents gives 4 hours; 6 hours and 12 parents gives 30 minutes; 3 days and 2 parents gives 12 hours. The exact deadline is saved immediately before the first email attempt and appears in both email and app. Sent deadlines and retry deadlines remain fixed even if the queue changes; subsequent offers use fresh counts and remaining time. Declined and expired offers release the place to the next parent. Offers whose delivery has not started release after 24 hours or the event cutoff so email configuration problems cannot hold capacity indefinitely.

Cancelling a published event queues individual emails for accepted, waitlisted and offered parents, excluding the organizer and withdrawn/declined/expired participants. The email includes the organizer's cancellation reason. Repeated cancellation requests do not enqueue duplicate emails. Existing in-app cancellation alerts remain available.

## Deployment configuration

1. Apply the checked-in Prisma migration through the existing deployment workflow.
2. Set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` and optionally `BREVO_SENDER_NAME` in each Vercel environment that should send email. Configure `APP_URL` with the production application URL. Preview builds use their deployment URL.
3. Generate a random secret and set the same value in Vercel as `CRON_SECRET` and GitHub repository Actions secrets as `DORMDASH_NOTIFICATION_CRON_SECRET`. Never put this value in client-side variables.
4. The `Process event email notifications` workflow runs hourly against the latest successful `production` GitHub deployment. It can also be manually run with target `test`. GitHub scheduled workflows run from the default branch and may be delayed. This does not require a paid Vercel cron service.

Mutations attempt immediate email delivery. The hourly worker expires offers and retries queued messages. A worker invocation checks 25 events and sends up to 20 queued emails, with additional work retained for subsequent runs. Offer acceptance enforces the deadline immediately, even before the worker runs. The next parent may wait until the next hourly worker run after a deadline expires; use a more frequent scheduler if short offer windows require faster turnover. At higher volume, invoke the protected POST `/api/jobs/event-notifications` more often using an external scheduler with `Authorization: Bearer <CRON_SECRET>`.

Delivery uses a durable database outbox, leases, retry backoff and Brevo idempotency keys. Brevo deduplicates keys for a limited period; a crash after sending can still cause a duplicate email outside that window. Participation changes remain idempotent. Cancellation or acceptance during an in-flight provider request may leave an obsolete email in someone's inbox; the signed-in response checks current state and rejects obsolete offers.

Production and preview require their own database migration and email configuration. Local tests mock the provider and do not send real emails.
