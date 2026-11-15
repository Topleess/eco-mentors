package config

import (
	"strings"
	"testing"
)

func TestEmailRequiresExplicitSender(t *testing.T) {
	for _, tc := range []struct{ name, env, endpoint string }{
		{"production", "production", ""},
		{"postbox staging", "staging", "https://postbox.example.test"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &Config{Server: ServerConfig{AppEnv: tc.env}, Email: EmailConfig{
				SESRegion: "test", SESAccessKeyID: "fake", SESSecretAccessKey: "fake",
				SESEndpoint: tc.endpoint, ModeratorsEmail: "mods@example.test",
			}}
			if err := cfg.validateEmailConfig(); err == nil || !strings.Contains(err.Error(), "SES_FROM_EMAIL") {
				t.Fatalf("expected explicit sender requirement, got %v", err)
			}
		})
	}
}
func TestEmailIdentityValidation(t *testing.T) {
	for _, tc := range []struct {
		name, from, display, moderators string
		wantError                       bool
	}{
		{"valid", "hello@eco.example", "Менторы ЭкоКарьеры", "mods@eco.example", false},
		{"missing name", "hello@eco.example", "", "mods@eco.example", true},
		{"display address", "Name <hello@eco.example>", "Eco", "mods@eco.example", true},
		{"invalid", "not-an-email", "Eco", "mods@eco.example", true},
		{"sender header", "hello@eco.example\r\nBcc:x@example.test", "Eco", "mods@eco.example", true},
		{"name header", "hello@eco.example", "Eco\r\nBcc:x@example.test", "mods@eco.example", true},
		{"upstream sender", "hello@OPENMENTOR.IO", "Eco", "mods@eco.example", true},
		{"upstream moderators", "hello@eco.example", "Eco", "moderators@openmentor.io", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &Config{Server: ServerConfig{AppEnv: "production"}, Email: EmailConfig{
				SESRegion: "test", SESAccessKeyID: "fake", SESSecretAccessKey: "fake",
				SESFromEmail: tc.from, SESFromName: tc.display, ModeratorsEmail: tc.moderators,
			}}
			if err := cfg.validateEmailConfig(); (err != nil) != tc.wantError {
				t.Fatalf("error = %v, want error %v", err, tc.wantError)
			}
		})
	}
}

func TestEmailDevelopmentLegacyDefaults(t *testing.T) {
	cfg := &Config{Server: ServerConfig{AppEnv: "development"}, Email: EmailConfig{ModeratorsEmail: "moderators@openmentor.io"}}
	if err := cfg.validateEmailConfig(); err != nil {
		t.Fatal(err)
	}
	cfg.Email.SESFromEmail = "hello@eco.example"
	if err := cfg.validateEmailConfig(); err == nil {
		t.Fatal("partial identity must fail even in development")
	}
}
func TestLoadEmailIdentity(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("SES_FROM_EMAIL", "hello@eco.example")
	t.Setenv("SES_FROM_NAME", "Менторы ЭкоКарьеры")
	cfg := load()
	if cfg.Email.SESFromEmail != "hello@eco.example" || cfg.Email.SESFromName != "Менторы ЭкоКарьеры" {
		t.Fatal("sender identity env vars not loaded")
	}
}
