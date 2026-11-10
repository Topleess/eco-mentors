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

func TestRequestAnalyticsDatabase(t *testing.T) {
	u, err := url.Parse(os.Getenv(dbtest.URLEnv))
	if err != nil || u.Host != "127.0.0.1:5546" || u.Path != "/openmentor_analytics_test" {
		t.Skip("requires new isolated openmentor_analytics_test on 5546")
	}
	p := dbtest.Pool(t)
	ctx := context.Background()
	a, b, _ := requestAnalyticsRange("2026-01-01", "2026-01-03")
	raw, err := readRequestAnalytics(ctx, p, a, b)
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Daily           []struct{ Created int }
		Summary         struct{ Created, Attention int }
		HistoryCoverage struct{ Eligible, Total int }
	}
	if err = json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Daily) != 3 || out.Summary.Created != 0 {
		t.Fatalf("empty: %s", raw)
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var id string
	if err = tx.QueryRow(ctx, `INSERT INTO client_requests(status) VALUES ('pending') RETURNING id::text`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	var n int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM request_status_events WHERE request_id=$1`, id).Scan(&n); err != nil || n != 1 {
		t.Fatalf("atomic insert: %d %v", n, err)
	}
	if _, err = tx.Exec(ctx, `UPDATE client_requests SET status='pending' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, `UPDATE client_requests SET status='done' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM request_status_events WHERE request_id=$1`, id).Scan(&n); err != nil || n != 2 {
		t.Fatalf("transition: %d %v", n, err)
	}
	if err = tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if err = p.QueryRow(ctx, `SELECT count(*) FROM request_status_events WHERE request_id=$1`, id).Scan(&n); err != nil || n != 0 {
		t.Fatalf("rollback: %d %v", n, err)
	}
	// Backdated imports are deliberately outside complete-history eligibility.
	if err = p.QueryRow(ctx, `INSERT INTO client_requests(status,created_at) VALUES ('pending','2026-01-01 21:00:00+00') RETURNING id::text`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = p.Exec(ctx, `DELETE FROM client_requests WHERE id=$1`, id) })
	raw, err = readRequestAnalytics(ctx, p, a, b)
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	if out.Daily[0].Created != 0 || out.Daily[1].Created != 1 || out.Summary.Attention != 1 || out.HistoryCoverage.Total != 1 || out.HistoryCoverage.Eligible != 0 {
		t.Fatalf("timezone/legacy/overdue: %s", raw)
	}
	_, _ = p.Exec(ctx, `UPDATE client_requests SET status='done' WHERE id=$1`, id)
	today := time.Now().In(a.Location()).Format(time.DateOnly)
	x, y, _ := requestAnalyticsRange(today, today)
	raw, err = readRequestAnalytics(ctx, p, x, y)
	if err != nil {
		t.Fatal(err)
	}
	var events struct {
		Daily   []struct{ Done int }
		Summary struct{ Created int }
	}
	if err = json.Unmarshal(raw, &events); err != nil {
		t.Fatal(err)
	}
	if events.Daily[0].Done != 1 || events.Summary.Created != 0 {
		t.Fatalf("event vs creation cohort: %s", raw)
	}
}

func TestRequestAnalyticsIdentityAndDurations(t *testing.T) {
	u, _ := url.Parse(os.Getenv(dbtest.URLEnv))
	if u == nil || u.Host != "127.0.0.1:5546" || u.Path != "/openmentor_analytics_test" {
		t.Skip("isolated database required")
	}
	p := dbtest.Pool(t)
	ctx := context.Background()
	for _, role := range []string{"om_api", "om_worker"} {
		tx, err := p.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = tx.Exec(ctx, "SET LOCAL ROLE "+role); err != nil {
			t.Fatal(err)
		}
		var id string
		if err = tx.QueryRow(ctx, `INSERT INTO client_requests(status) VALUES ('pending') RETURNING id::text`).Scan(&id); err != nil {
			t.Fatal(err)
		}
		for _, status := range []string{"contacted", "working", "done"} {
			if _, err = tx.Exec(ctx, `UPDATE client_requests SET status=$2 WHERE id=$1`, id, status); err != nil {
				t.Fatal(err)
			}
		}
		var n int
		if err = tx.QueryRow(ctx, `SELECT count(*) FROM request_status_events WHERE request_id=$1`, id).Scan(&n); err != nil || n != 4 {
			t.Fatalf("%s events=%d error=%v", role, n, err)
		}
		if _, err = tx.Exec(ctx, `DELETE FROM client_requests WHERE id=$1`, id); err != nil {
			t.Fatal(err)
		}
		if err = tx.QueryRow(ctx, `SELECT count(*) FROM request_status_events WHERE request_id=$1`, id).Scan(&n); err != nil || n != 0 {
			t.Fatal("cascade failed", err)
		}
		if _, err = tx.Exec(ctx, `UPDATE request_status_events SET status='pending'`); err == nil {
			t.Fatal("direct history mutation allowed")
		}
		_ = tx.Rollback(ctx)
	}
	var id string
	if err := p.QueryRow(ctx, `INSERT INTO client_requests(status) VALUES ('pending') RETURNING id::text`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = p.Exec(ctx, `DELETE FROM client_requests WHERE id=$1`, id) })
	for _, status := range []string{"contacted", "working", "done"} {
		if _, err := p.Exec(ctx, `UPDATE client_requests SET status=$2 WHERE id=$1`, id, status); err != nil {
			t.Fatal(err)
		}
	}
	today := time.Now().In(time.FixedZone("MSK", 10800)).Format(time.DateOnly)
	a, b, _ := requestAnalyticsRange(today, today)
	raw, err := readRequestAnalytics(ctx, p, a, b)
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		HistoryCoverage struct{ Eligible int }
		Durations       []struct {
			Stage       string
			SampleCount int
			MedianHours *float64
		}
		Funnel []struct {
			Status string
			Count  int
		}
	}
	if err = json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	if out.HistoryCoverage.Eligible != 1 {
		t.Fatalf("eligible: %s", raw)
	}
	for _, d := range out.Durations {
		if d.SampleCount != 1 || d.MedianHours == nil {
			t.Fatalf("duration %s: %s", d.Stage, raw)
		}
	}
	for _, f := range out.Funnel {
		if (f.Status == "pending" || f.Status == "contacted" || f.Status == "working" || f.Status == "done") && f.Count != 1 {
			t.Fatalf("funnel: %s", raw)
		}
	}
}
