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

func TestRequestAnalyticsPrimaryFunnelAndLegacyStatus(t *testing.T) {
	u, _ := url.Parse(os.Getenv(dbtest.URLEnv))
	if u == nil || u.Host != "127.0.0.1:5546" || u.Path != "/openmentor_analytics_test" {
		t.Skip("isolated analytics database required")
	}
	p := dbtest.Pool(t)
	ctx := context.Background()
	var id string
	if err := p.QueryRow(ctx, `INSERT INTO client_requests(status) VALUES ('reschedule') RETURNING id::text`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = p.Exec(ctx, `DELETE FROM client_requests WHERE id=$1`, id) })
	today := time.Now().In(time.FixedZone("MSK", 10800)).Format(time.DateOnly)
	a, b, _ := requestAnalyticsRange(today, today)
	raw, err := readRequestAnalytics(ctx, p, a, b)
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Summary struct{ Active int }
		Funnel  []struct {
			Status string
			Count  int
		}
	}
	if err = json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	if out.Summary.Active != 0 {
		t.Fatalf("legacy reschedule is not an active mentor-inbox state: active=%d", out.Summary.Active)
	}
	expected := []string{"pending", "contacted", "working", "done"}
	if len(out.Funnel) != len(expected) {
		t.Fatalf("primary progression must have four stages, got %d", len(out.Funnel))
	}
	for i, s := range expected {
		if out.Funnel[i].Status != s {
			t.Fatalf("stage %d got %s want %s", i, out.Funnel[i].Status, s)
		}
	}
}
