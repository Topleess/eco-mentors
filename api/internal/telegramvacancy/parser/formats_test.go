package parser

import (
	"strings"
	"testing"
	"unicode/utf16"
)

func TestCapturedFormatsSanitized(t *testing.T) {
	cases := []struct{ heading, intro, salary, city string }{
		{"🌿 Специалист по экологии в Компании А", "", "", "Москва"},
		{"🌿 Менеджер по устойчивому развитию в Компании Б", "Компания работает в нескольких городах.", "", ""},
		{"🌿 Ведущий специалист в Компании В", "Мы ищем специалиста.", "180 000 рублей в месяц (оклад + премия)", "Москва"},
		{"🌿 Стажер группы ESG в Компании Г", "", "", "Москва"},
	}
	for _, tc := range cases {
		t.Run(tc.heading, func(t *testing.T) {
			loc := ""
			if tc.city != "" {
				loc = "\n\n🖼 Локализация: " + tc.city + ", метро, улица"
			}
			salary := ""
			if tc.salary != "" {
				salary = "\n\n▫️Оплата: " + tc.salary
			}
			text := tc.heading + "\n\n" + tc.intro + "\n🔎 Какие задачи ждут?\n▫️Изучать данные\n\n📝 Кто идеальный кандидат?\n▫️Опыт работы\n\n✔️ Что предлагают?\n▫️ДМС" + salary + loc + "\n\nПодробнее по ссылке\n\n#Вакансии"
			off := len(utf16.Encode([]rune(strings.Split(text, "ссылке")[0])))
			v := Parse(Message{Caption: text, CaptionEntities: []Entity{{Type: "text_link", Offset: off, Length: 6, URL: "https://example.org/job"}}, Photo: []Photo{{FileID: "photo-small"}, {FileID: "photo-large"}}})
			if v.OriginalText != text || v.Heading != strings.TrimPrefix(tc.heading, "🌿 ") || v.Tasks != "▫️Изучать данные" || v.Requirements != "▫️Опыт работы" || v.Benefits != "▫️ДМС"+salary || v.City != tc.city || v.Salary != tc.salary || v.SourceURL != "https://example.org/job" || strings.Join(v.PhotoFileIDs, ",") != "photo-small,photo-large" {
				t.Fatalf("unexpected draft: %+v", v)
			}
		})
	}
}

func TestEntityOffsetsValidateUTF16AndInputSelection(t *testing.T) {
	text := "🌿 Аналитик\n😀 Подробнее"
	good := len(utf16.Encode([]rune("🌿 Аналитик\n😀 ")))
	v := Parse(Message{Text: text, Caption: "ignored", Entities: []Entity{{Type: "text_link", Offset: 1, Length: 1, URL: "https://bad.example"}, {Type: "text_link", Offset: good, Length: 9, URL: "https://example.org"}}})
	if v.SourceURL != "https://example.org" || v.OriginalText != text {
		t.Fatalf("unexpected: %+v", v)
	}
}

func TestFormatPreservesLinkAndUTF16Limit(t *testing.T) {
	text, err := Format(Vacancy{Heading: "Аналитик", Tasks: strings.Repeat("😀", 3000), SourceURL: "https://example.org/job"}, 128)
	if err != nil || len(utf16.Encode([]rune(text))) > 128 || !strings.Contains(text, "https://example.org/job") || !strings.Contains(text, "Аналитик") {
		t.Fatalf("text=%q err=%v", text, err)
	}
	if _, err = Format(Vacancy{Heading: "A", SourceURL: "https://example.org/long"}, 5); err == nil {
		t.Fatal("expected error when link cannot fit")
	}
}
