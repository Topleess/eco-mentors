package config

import "testing"

func TestCaptchaProviderValidation(t *testing.T) {
	for _, tc := range []struct {
		name, provider, key, host string
		ok                        bool
	}{
		{"legacy", "", "key", "", true},
		{"smart", "smartcaptcha", "key", "eco-mentors.ru", true},
		{"missing key", "smartcaptcha", "", "eco-mentors.ru", false},
		{"missing hostname", "smartcaptcha", "key", "", false},
		{"bad hostname", "smartcaptcha", "key", "https://eco-mentors.ru", false},
		{"unknown", "anything", "key", "eco-mentors.ru", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := Config{Turnstile: TurnstileConfig{Provider: tc.provider, SecretKey: tc.key, ExpectedHostname: tc.host}}
			if err := c.validateTurnstileConfig(); (err == nil) != tc.ok {
				t.Fatalf("success=%v want=%v", err == nil, tc.ok)
			}
		})
	}
}
