package worker

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/openmentor-io/openmentor/api/config"
	"github.com/openmentor-io/openmentor/api/pkg/email"
)

func TestRetryLiveOptInGateMatrix(t *testing.T) {
	for _, appEnv := range []string{"production", "staging", "development", ""} {
		for _, retry := range []bool{false, true} {
			for _, live := range []bool{false, true} {
				for _, override := range []string{"", "  ", "sandbox@example.test"} {
					cfg := &config.Config{}
					cfg.Server.AppEnv = appEnv
					cfg.Worker.RequestEmailRetryEnabled = retry
					cfg.Worker.RequestEmailLiveRecipients = live
					cfg.Email.DevEmailOverride = override
					env := newJobsTestEnv()
					h := NewHandlers(env.repo, env.sender, nil, cfg)
					wantSkip := appEnv != "production" && override != "sandbox@example.test" && (!retry || !live)
					for _, run := range []func(context.Context) (JobSummary, error){h.RetryRequestDeliveries, h.RetryAcceptanceNotifications} {
						summary, err := run(context.Background())
						if err != nil || summary.Skipped != wantSkip {
							t.Errorf("env=%q retry=%v live=%v override=%q skip=%v want=%v err=%v", appEnv, retry, live, override, summary.Skipped, wantSkip, err)
						}
					}
					if appEnv != "production" && override != "sandbox@example.test" && !h.skipNonProduction() {
						t.Error("live opt-in must not unlock other jobs")
					}
				}
			}
		}
	}
}

// captureSES observes the actual sender's SES payload without a network call.
type captureSES struct{ recipients []string }

func (s *captureSES) SendEmail(_ context.Context, in *sesv2.SendEmailInput, _ ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
	s.recipients = append(s.recipients, in.Destination.ToAddresses...)
	return &sesv2.SendEmailOutput{MessageId: aws.String("test")}, nil
}
func TestRetryLiveRecipientRouting(t *testing.T) {
	for _, tc := range []struct {
		name, override, want string
		retry, live          bool
	}{
		{"blocked", "", "", true, false},
		{"missing scheduler", "", "", false, true},
		{"live", "", "person@example.test", true, true},
		{"override wins", "sandbox@example.test", "sandbox@example.test", true, true},
		{"override without live", "sandbox@example.test", "sandbox@example.test", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := newJobsTestEnv()
			env.repo.requestsWithMentor["id"] = &JobRequest{ID: "id", Email: "person@example.test", Name: "Test", MentorName: "Mentor", AcceptedContact: "contact"}
			cfg := &config.Config{}
			cfg.Server.AppEnv = "staging"
			cfg.Email.DevEmailOverride = tc.override
			cfg.Worker.RequestEmailRetryEnabled = tc.retry
			cfg.Worker.RequestEmailLiveRecipients = tc.live
			client := &captureSES{}
			h := NewHandlers(env.repo, email.NewSenderWithClient(client, "staging", tc.override), nil, cfg)
			_, err := h.RetryAcceptanceNotifications(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			if tc.want == "" {
				if len(client.recipients) != 0 {
					t.Fatalf("unexpected send: %v", client.recipients)
				}
				return
			}
			if len(client.recipients) != 1 || client.recipients[0] != tc.want {
				t.Fatalf("recipients=%v want=%q", client.recipients, tc.want)
			}
		})
	}
}
