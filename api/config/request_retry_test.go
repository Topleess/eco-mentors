package config

import "testing"

func TestRequestEmailRetryConfig(t *testing.T) {
	t.Setenv("WORKER_CRON_ENABLED", "false")
	t.Setenv("WORKER_REQUEST_EMAIL_RETRY_ENABLED", "false")
	cfg := load()
	if cfg.Worker.CronEnabled || cfg.Worker.RequestEmailRetryEnabled {
		t.Fatal("both flags must be false")
	}
	t.Setenv("WORKER_REQUEST_EMAIL_RETRY_ENABLED", "true")
	cfg = load()
	if cfg.Worker.CronEnabled || !cfg.Worker.RequestEmailRetryEnabled {
		t.Fatal("retry flag must be independent")
	}
}
