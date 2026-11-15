package turnstile

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type smartClient struct {
	body   string
	code   int
	called bool
	t      *testing.T
}

func (c *smartClient) Do(r *http.Request) (*http.Response, error) {
	c.called = true
	if r.URL.String() != "https://smartcaptcha.cloud.yandex.ru/validate" {
		c.t.Errorf("wrong provider endpoint: %s", r.URL)
	}
	_ = r.ParseForm()
	if r.Form.Get("token") != "test-token" || r.Form.Get("secret") != "test-secret" || r.Form.Get("response") != "" {
		c.t.Error("wrong verification fields")
	}
	return &http.Response{StatusCode: c.code, Body: io.NopCloser(strings.NewReader(c.body))}, nil
}
func (c *smartClient) Post(string, string, io.Reader) (*http.Response, error) { panic("unused") }
func (c *smartClient) Get(string) (*http.Response, error)                     { panic("unused") }
func TestSmartCaptchaVerification(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		code       int
		ok         bool
	}{
		{"valid", `{"status":"ok","host":"eco-mentors.ru"}`, 200, true},
		{"wrong host", `{"status":"ok","host":"other.ru"}`, 200, false},
		{"empty host", `{"status":"ok","host":""}`, 200, false},
		{"invalid token", `{"status":"failed"}`, 200, false},
		{"outage", `{"status":"ok","host":"eco-mentors.ru"}`, 503, false},
		{"bad json", `not json`, 200, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := &smartClient{body: tc.body, code: tc.code, t: t}
			v := NewVerifier(Options{Provider: "smartcaptcha", SecretKey: "test-secret", ExpectedHostname: "eco-mentors.ru"}, c)
			if err := v.Verify(context.Background(), "test-token"); (err == nil) != tc.ok {
				t.Fatalf("success=%v want=%v", err == nil, tc.ok)
			}
		})
	}
}
