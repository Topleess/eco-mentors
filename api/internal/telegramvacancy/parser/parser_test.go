package parser

import "testing"

func TestHeadingAndOriginal(t *testing.T) {
	m := Message{Caption: "🌿 Аналитик\n\n🔎 Какие задачи ждут?\n▫️Анализ"}
	got := Parse(m)
	if got.Heading != "Аналитик" || got.OriginalText != m.Caption || got.Tasks != "▫️Анализ" {
		t.Fatalf("unexpected: %+v", got)
	}
}
