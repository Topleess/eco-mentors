package config

import (
	"reflect"
	"testing"
)

func TestLiveRecipientsRequiresExplicitOptIn(t *testing.T) {
	for _, tc := range []struct {
		value string
		want  bool
	}{{"", false}, {"false", false}, {"true", true}, {"invalid", false}} {
		t.Run(tc.value, func(t *testing.T) {
			t.Setenv("WORKER_REQUEST_EMAIL_LIVE_RECIPIENTS", tc.value)
			f := reflect.ValueOf(load().Worker).FieldByName("RequestEmailLiveRecipients")
			if !f.IsValid() || f.Kind() != reflect.Bool {
				t.Fatal("missing live recipients configuration")
			}
			if f.Bool() != tc.want {
				t.Fatalf("got %v want %v", f.Bool(), tc.want)
			}
		})
	}
}
