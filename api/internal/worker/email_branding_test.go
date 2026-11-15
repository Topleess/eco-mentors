package worker

import (
	"context"
	"strings"
	"testing"

	"github.com/openmentor-io/openmentor/api/config"
	"github.com/openmentor-io/openmentor/api/pkg/email"
	"github.com/openmentor-io/openmentor/api/pkg/email/templates"
)

func TestEmailBrandUsesConfiguredBaseURL(t *testing.T) {
	env := newJobsTestEnvWithConfig(func(cfg *config.Config) { cfg.Server.BaseURL = "https://client.example/" })
	props := map[string]interface{}{"mentor_name": "Имя", "base_url": "https://wrong.example"}
	err := env.handlers.sendEmail(context.Background(), "test", email.Message{TemplateName: "profile-deactivated", Recipient: "mentor@example.com", Props: props})
	if err != nil {
		t.Fatal(err)
	}
	msg := env.sender.attempts[0]
	got, err := templates.Render(msg.TemplateName, msg.Props)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got.HTML, `src="https://client.example/brand/logo/svg/logo-horizontal.svg"`) {
		t.Error("configured brand URL missing")
	}
	if !strings.Contains(got.Text, "https://client.example/mentor/login") {
		t.Error("configured login URL missing")
	}
	if props["base_url"] != "https://wrong.example" {
		t.Error("caller-owned props mutated")
	}
}

func TestEmailFragmentsUseRussianCopy(t *testing.T) {
	if got := daysWording(21); got != "21 день" {
		t.Errorf("daysWording = %q", got)
	}
	if got, _ := describePendingRequest(JobReminderRequest{Name: "Имя", DaysAgo: 2}); !strings.Contains(got, "ожидает ответа") {
		t.Errorf("pending copy = %q", got)
	}
	for _, got := range []string{string(buildDeclineInfoHTML("no_time", "текст")), buildDeclineInfoText("no_time", "текст")} {
		if !strings.Contains(got, "Причина:") || !strings.Contains(got, "Комментарий:") || !strings.Contains(got, "Сейчас нет времени") {
			t.Errorf("decline copy = %q", got)
		}
	}
}
