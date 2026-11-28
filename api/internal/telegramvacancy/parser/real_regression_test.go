package parser

import "testing"

func TestHybridRegime(t *testing.T) {
	v := Parse(Message{Text: "🌿 Менеджер в Компания\n✔️ Что предлагают?\n▫️Гибридный режим работы (4 дня из офиса, 1 день из дома)."})
	if v.WorkFormat != "hybrid" {
		t.Fatalf("work format = %q, want hybrid", v.WorkFormat)
	}
}

func TestNoGuessedEmploymentOrWorkFormat(t *testing.T) {
	v := Parse(Message{Text: "🌿 Эколог в Компания\n✔️ Что предлагают?\n▫️График работы 5/2 с 9:00 до 18:00\n▫️Новый офис рядом с метро"})
	if v.Employment != "" || v.WorkFormat != "" {
		t.Fatalf("guessed fields: %+v", v)
	}
}
