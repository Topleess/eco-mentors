package email

import (
	"net/mail"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
)

func TestConfiguredSenderIdentity(t *testing.T) {
	sender := NewSender(Config{Region: "test", AccessKeyID: "fake", SecretAccessKey: "fake", AppEnv: "staging", FromEmail: "hello@eco.example", FromName: "Менторы ЭкоКарьеры"})
	input, err := sender.BuildSendEmailInput(Message{TemplateName: "mentor-login", Recipient: "mentor@example.test", Props: map[string]interface{}{
		"mentor_name": "Test", "login_url": "https://eco.example/mentor/auth/callback?token=fake", "base_url": "https://eco.example",
	}})
	if err != nil {
		t.Fatal(err)
	}
	from, err := mail.ParseAddress(aws.ToString(input.FromEmailAddress))
	if err != nil {
		t.Fatal(err)
	}
	if from.Address != "hello@eco.example" || from.Name != "Менторы ЭкоКарьеры" {
		t.Fatalf("unexpected From: %v", from)
	}
	if !strings.Contains(aws.ToString(input.FromEmailAddress), "=?utf-8?") {
		t.Fatal("Cyrillic display name must be MIME encoded")
	}
	for _, body := range []string{aws.ToString(input.Content.Simple.Body.Html.Data), aws.ToString(input.Content.Simple.Body.Text.Data)} {
		if strings.Contains(body, "openmentor.io") || !strings.Contains(body, "https://eco.example/mentor/auth/callback?token=fake") {
			t.Fatal("login links must use configured site")
		}
	}
}
