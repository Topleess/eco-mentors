package worker

import "testing"

func TestRetrySchedulerIsIndependentAndNeverDuplicatesJobs(t *testing.T) {
	env := newJobsTestEnv()
	for _, tc := range []struct {
		cron, retry bool
		want        int
	}{{false, false, 0}, {false, true, 2}, {true, false, len(env.handlers.CronJobs())}, {true, true, len(env.handlers.CronJobs())}} {
		scheduler, err := NewCronForFlags(env.handlers, tc.cron, tc.retry)
		if err != nil {
			t.Fatal(err)
		}
		if got := len(scheduler.Entries()); got != tc.want {
			t.Errorf("cron=%v retry=%v: got %d entries, want %d", tc.cron, tc.retry, got, tc.want)
		}
	}
}
