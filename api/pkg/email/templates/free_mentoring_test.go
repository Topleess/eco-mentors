package templates

import (
	"strings"
	"testing"
)

func TestTransactionalTemplatesDoNotPromotePaidMentoring(t *testing.T) {
	for _, name := range Names() {
		tpl, err := GetTemplate(name)
		if err != nil {
			t.Fatal(err)
		}
		for _, body := range []string{tpl.Subject, tpl.HTML, tpl.Text} {
			for _, forbidden := range []string{"{{request_price}}", "указанная стоимость", "стоимость пересчитана", "устанавливаете стоимость", "оплату напрямую", "о заявках и оплате", "о заявках, оплате"} {
				if strings.Contains(strings.ToLower(body), forbidden) {
					t.Errorf("%s contains paid mentoring copy %q", name, forbidden)
				}
			}
		}
	}
}
