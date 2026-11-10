package config

import "testing"

func TestValidateDemoAuthConfigRejectsProduction(t *testing.T) {
	cfg := &Config{
		Server:   ServerConfig{AppEnv: "production"},
		DemoAuth: DemoAuthConfig{Enabled: true, SessionTTLHours: 4},
	}
	if err := cfg.validateDemoAuthConfig(); err == nil {
		t.Fatal("validateDemoAuthConfig() = nil, want production rejection")
	}
}

func TestValidateDemoAuthConfigAllowsOnlyStagingOrDevelopment(t *testing.T) {
	for _, appEnv := range []string{"staging", "development"} {
		t.Run(appEnv, func(t *testing.T) {
			cfg := &Config{
				Server:   ServerConfig{AppEnv: appEnv},
				DemoAuth: DemoAuthConfig{Enabled: true, SessionTTLHours: 4},
				MentorSession: MentorSessionConfig{
					JWTSecret: "demo-signing-secret-that-is-long-enough-000000",
				},
			}
			if err := cfg.validateDemoAuthConfig(); err != nil {
				t.Fatalf("validateDemoAuthConfig() error = %v", err)
			}
		})
	}
}

func TestValidateDemoAuthConfigRequiresSigningSecret(t *testing.T) {
	cfg := &Config{
		Server:   ServerConfig{AppEnv: "staging"},
		DemoAuth: DemoAuthConfig{Enabled: true, SessionTTLHours: 4},
	}
	if err := cfg.validateDemoAuthConfig(); err == nil {
		t.Fatal("validateDemoAuthConfig() = nil, want missing JWT secret rejection")
	}
	cfg.MentorSession.JWTSecret = "demo-signing-secret-that-is-long-enough-000000"
	if err := cfg.validateDemoAuthConfig(); err != nil {
		t.Fatalf("validateDemoAuthConfig() error = %v", err)
	}
}

func TestValidateDemoAuthConfigBoundsSessionTTL(t *testing.T) {
	for _, ttl := range []int{0, 25} {
		cfg := &Config{
			Server:   ServerConfig{AppEnv: "staging"},
			DemoAuth: DemoAuthConfig{Enabled: true, SessionTTLHours: ttl},
			MentorSession: MentorSessionConfig{
				JWTSecret: "demo-signing-secret-that-is-long-enough-000000",
			},
		}
		if err := cfg.validateDemoAuthConfig(); err == nil {
			t.Errorf("validateDemoAuthConfig() with TTL %d = nil, want bounded TTL rejection", ttl)
		}
	}
}

func TestValidateDemoAuthConfigAllowsDisabledFlagInProduction(t *testing.T) {
	cfg := &Config{Server: ServerConfig{AppEnv: "production"}}
	if err := cfg.validateDemoAuthConfig(); err != nil {
		t.Fatalf("disabled demo auth should be safe in production: %v", err)
	}
}
