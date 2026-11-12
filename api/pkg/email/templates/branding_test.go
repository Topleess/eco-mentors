package templates

import (
	"regexp"
	"strings"
	"testing"
)

func TestTransactionalFactsMatchInBothBodies(t *testing.T) {
	facts := map[string][]string{
		"mentor-confirm-email":      {"24 часа"},
		"mentor-login":              {"15 минут", "один раз"},
		"new-mentor-approved":       {"без комиссии", "бесплатно"},
		"pending-requests-reminder": {"30 дней", "деактивируем", "снова активировать"},
		"profile-deleted":           {"окончательно стёрты", "приглашения оставить отзыв уже отменены", "как можно скорее", "восстановление невозможно"},
		"profile-restored":          {"скрыт из каталога", "заявками и отзывами"},
		"profile-migrated":          {"getmentor.dev", "английский", "доллары США", "скрыт из каталога"},
		"session-complete":          {"Отзывы публичны", "адрес почты не публикуется"},
	}
	for name, required := range facts {
		tpl, err := GetTemplate(name)
		if err != nil {
			t.Fatal(err)
		}
		for _, phrase := range required {
			for part, body := range map[string]string{"html": tpl.HTML, "text": tpl.Text} {
				if !strings.Contains(body, phrase) {
					t.Errorf("%s %s missing transactional fact %q", name, part, phrase)
				}
			}
		}
	}
}

func TestEcoCareerBranding(t *testing.T) {
	for _, name := range Names() {
		t.Run(name, func(t *testing.T) {
			tpl, err := GetTemplate(name)
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(tpl.HTML, `bgcolor="#70E852"`) && !strings.Contains(tpl.HTML, `color:#000000;font:bold 16px`) {
				t.Error("bright-green action must use black text")
			}
			for _, color := range []string{"#FFFFFF", "#000000", "#C9FFBF", "#247318"} {
				if !strings.Contains(tpl.HTML, color) {
					t.Errorf("missing email palette color %s", color)
				}
			}
			props := map[string]interface{}{}
			for _, key := range Placeholders(tpl) {
				props[key] = "значение-" + key
			}
			props["base_url"] = "https://client.example"
			got, err := Render(name, props)
			if err != nil {
				t.Fatal(err)
			}
			for part, body := range map[string]string{"subject": got.Subject, "html": got.HTML, "text": got.Text} {
				if strings.Contains(body, "OpenMentor") || strings.Contains(body, "openmentor.io") || strings.Contains(body, "tech community") {
					t.Errorf("%s retains upstream branding", part)
				}
				if !regexp.MustCompile(`[А-Яа-яЁё]`).MatchString(body) {
					t.Errorf("%s is not Russian", part)
				}
			}
			if !strings.Contains(got.HTML, `src="https://client.example/brand/logo/svg/logo-horizontal.svg"`) {
				t.Error("logo must use configured platform URL")
			}
			if !strings.Contains(got.HTML, `alt="Лаборатория ЭкоКарьеры"`) {
				t.Error("client logo accessible name missing")
			}
			for part, body := range map[string]string{"html": got.HTML, "text": got.Text} {
				if !strings.Contains(body, "Менторы ЭкоКарьеры") {
					t.Errorf("%s service name missing", part)
				}
			}
		})
	}
}
