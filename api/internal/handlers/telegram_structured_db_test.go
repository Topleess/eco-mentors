package handlers

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/openmentor-io/openmentor/api/internal/telegramvacancy/parser"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestTelegramStructuredImportPreservesEditedDraft(t *testing.T) {
	pool := dbtest.Pool(t)
	m := telegramImportMessage{Message: parser.Message{Text: "🌿 Эколог в Пример\n\nИщем коллегу.\n🔎 Какие задачи ждут?\n▫️Анализ\n✔️ Что предлагают?\n▫️Гибридный формат работы"}, MessageID: 9876501}
	m.Chat.ID = -99998765
	id, created, err := importTelegramMessage(t.Context(), pool, m)
	if err != nil || !created {
		t.Fatalf("import: created=%v err=%v", created, err)
	}
	defer pool.Exec(context.Background(), "DELETE FROM vacancies WHERE id=$1", id)
	var raw []byte
	if err = pool.QueryRow(t.Context(), "SELECT payload FROM vacancies WHERE id=$1", id).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var p map[string]any
	if err = json.Unmarshal(raw, &p); err != nil {
		t.Fatal(err)
	}
	if p["title"] != "Эколог" || p["company"] != "Пример" || p["description"] != "Ищем коллегу." || p["workFormat"] != "hybrid" {
		t.Fatalf("unexpected payload: %s", raw)
	}
	if _, err = pool.Exec(t.Context(), "UPDATE vacancies SET payload=jsonb_set(payload, '{company}', to_jsonb('Edited'::text)) WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	id2, created, err := importTelegramMessage(t.Context(), pool, m)
	if err != nil || created || id2 != id {
		t.Fatalf("duplicate: %v %v", created, err)
	}
	if err = pool.QueryRow(t.Context(), "SELECT payload FROM vacancies WHERE id=$1", id).Scan(&raw); err != nil || !strings.Contains(string(raw), "Edited") {
		t.Fatalf("edited payload lost: %s %v", raw, err)
	}
}
