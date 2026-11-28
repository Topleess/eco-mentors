# Mentorship request email verification gaps

The isolated worker tests use synthetic recipients, a fake email sender, and a disposable PostgreSQL database. They do not prove that a real provider accepts a message, delivers it to the intended inbox, or renders it correctly. A future controlled check requires a provider sandbox and inboxes owned by the test operator; do not send to production or unowned recipients.

Known reliability gaps, reproduced by `api/internal/worker/request_delivery_regression_test.go`:

- The new-request watcher consumes its request claim before sending three separate messages. A failed mentor notification is not sent on a replay, even though the endpoint originally returns 503. Retrying all three without individual delivery state would duplicate the successful messages.
- Replaying a decline notification sends the mentee the same message again. The trigger is asynchronous; a failed trigger also has no demonstrated durable retry for decline.

Acceptance has a database-backed lease and retry path; a successful fake send followed by a database failure, process crash, or ambiguous provider response still cannot prove exactly-once delivery. Provider-side idempotency or reconciliation is required to resolve that ambiguity. No full HTTP submission-to-inbox end-to-end verification has been established by these worker-only tests.
