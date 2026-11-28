package handlers

import "testing"

func TestReparseCandidateExtractsWithoutChangingSource(t *testing.T) {
	raw := "Инженер в Компания\nВступление\nКакие задачи ждут?\nПисать код"
	result := telegramReparseCandidate(raw, "city")
	if result["title"] != "Инженер" || result["company"] != "Компания" || result["rawText"] != raw || result["cityId"] != "city" {
		t.Fatalf("unexpected candidate: %#v", result)
	}
}
