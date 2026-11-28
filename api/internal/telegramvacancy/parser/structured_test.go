package parser

import "testing"

func TestStructuredHeadingAndIntroduction(t *testing.T) {
	text := "🌿 Эколог в Пример\n\nМы ищем коллегу.\n\n🔎 Какие задачи ждут?\n▫️Анализ\n\n✔️ Что предлагают?\n▫️Гибридный формат работы"
	got := Parse(Message{Text: text})
	if got.Title != "Эколог" || got.Company != "Пример" || got.Introduction != "Мы ищем коллегу." || got.WorkFormat != "hybrid" || got.OriginalText != text {
		t.Fatalf("structured extraction: %+v", got)
	}
}

func TestExplicitSalary(t *testing.T) {
	v := Parse(Message{Text: "🌿 Эколог в Пример\n✔️ Что предлагают?\n▫️Оплата: 180 000 рублей в месяц"})
	if v.SalaryMin == nil || *v.SalaryMin != 180000 || v.SalaryMax == nil || *v.SalaryMax != 180000 {
		t.Fatal("explicit RUB salary not parsed")
	}
}
