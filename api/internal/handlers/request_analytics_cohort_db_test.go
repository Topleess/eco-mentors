package handlers

import (
	"context"
	"encoding/json"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestRequestAnalyticsFunnelUsesOnlyFullHistoryCohort(t *testing.T) {
	u, _ := url.Parse(os.Getenv(dbtest.URLEnv))
	if u == nil || u.Host != "127.0.0.1:5546" || u.Path != "/openmentor_analytics_test" {
		t.Skip("isolated analytics database required")
	}
	p := dbtest.Pool(t)
	ctx := context.Background()
	for _, q := range []string{`INSERT INTO client_requests(status,created_at) SELECT 'pending',history_started_at-interval '1 day' FROM request_analytics_metadata RETURNING id::text`, `INSERT INTO client_requests(status) VALUES ('pending') RETURNING id::text`} {
		var id string
		if err := p.QueryRow(ctx, q).Scan(&id); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = p.Exec(ctx, `DELETE FROM client_requests WHERE id=$1`, id) })
	}
	now := time.Now().In(time.FixedZone("MSK", 10800))
	a, b, _ := requestAnalyticsRange(now.AddDate(0, 0, -7).Format(time.DateOnly), now.Format(time.DateOnly))
	raw, err := readRequestAnalytics(ctx, p, a, b)
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		HistoryCoverage struct{ Eligible, Total int }
		Funnel          []struct {
			Status string
			Count  int
		}
	}
	if err = json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	if out.HistoryCoverage.Eligible != 1 || out.HistoryCoverage.Total != 2 {
		t.Fatalf("invalid test coverage: %s", raw)
	}
	if out.Funnel[0].Count != out.HistoryCoverage.Eligible {
		t.Fatalf("funnel starts with %d requests, but only %d have full history", out.Funnel[0].Count, out.HistoryCoverage.Eligible)
	}
}
