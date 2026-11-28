package parser

import (
	"encoding/json"
	"os"
	"testing"
)

func value(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

// Optional local acceptance test; the private capture is never copied into the repository.
func TestLocalCapture(t *testing.T) {
	path := os.Getenv("TELEGRAM_VACANCY_CAPTURE")
	if path == "" {
		t.Skip("local capture not supplied")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var updates []struct {
		ChannelPost Message `json:"channel_post"`
	}
	if err = json.Unmarshal(data, &updates); err != nil {
		t.Fatal(err)
	}
	if len(updates) != 4 {
		t.Fatalf("expected four captured updates, got %d", len(updates))
	}
	wantTitles := []string{"Ведущий специалист по ESG", "Менеджер по вопросам устойчивого развития и социальной ответственности бизнеса", "Ведущий специалист по экологии и охране окружающей среды (ESG)", "Стажер, Группа устойчивого развития, ESG"}
	wantCompanies := []string{"СберСити", "HEINEKEN", "Федеральную пассажирскую компанию (АО ФПК)", "Б1 (B1)"}
	wantCities := []string{"Москва", "", "Москва", "Москва"}
	wantFormats := []string{"", "hybrid", "", ""}
	for i, u := range updates {
		v := Parse(u.ChannelPost)
		if v.Title != wantTitles[i] || v.Company != wantCompanies[i] || v.City != wantCities[i] || v.WorkFormat != wantFormats[i] || v.Employment != "" {
			t.Errorf("capture %d unexpected structured output: title=%q company=%q city=%q format=%q employment=%q", i, v.Title, v.Company, v.City, v.WorkFormat, v.Employment)
		}
		t.Logf("capture %d: title=%q company=%q city=%q workFormat=%q employment=%q salary=%q salaryMin=%v salaryMax=%v introRunes=%d taskRunes=%d requirementRunes=%d benefitRunes=%d", i+1, v.Title, v.Company, v.City, v.WorkFormat, v.Employment, v.Salary, value(v.SalaryMin), value(v.SalaryMax), len([]rune(v.Introduction)), len([]rune(v.Tasks)), len([]rune(v.Requirements)), len([]rune(v.Benefits)))
		if v.Heading == "" || v.Tasks == "" || v.Requirements == "" || v.Benefits == "" || v.SourceURL == "" || len(v.PhotoFileIDs) == 0 {
			t.Errorf("capture %d lacks expected fields", i)
		}
		if i == 1 && v.City != "" {
			t.Errorf("capture %d: city was inferred", i)
		}
		if i == 2 && (v.City != "Москва" || v.Salary == "") {
			t.Errorf("capture %d: explicit city or salary missing", i)
		}
	}
}
