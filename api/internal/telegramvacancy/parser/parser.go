// Package parser extracts conservative vacancy drafts from Telegram messages.
package parser

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf16"
)

type Entity struct {
	Type   string `json:"type"`
	Offset int    `json:"offset"`
	Length int    `json:"length"`
	URL    string `json:"url"`
}
type Photo struct {
	FileID string `json:"file_id"`
}
type Message struct {
	Text            string   `json:"text"`
	Caption         string   `json:"caption"`
	Entities        []Entity `json:"entities"`
	CaptionEntities []Entity `json:"caption_entities"`
	Photo           []Photo  `json:"photo"`
}
type Vacancy struct {
	OriginalText, Heading, Tasks, Requirements, Benefits, Salary, City, SourceURL string
	Title, Company, Introduction, WorkFormat, Employment                          string
	PhotoFileIDs                                                                  []string
	SalaryMin, SalaryMax                                                          *int64
}

// Parse never infers a city or salary from unlabelled prose.
const workFormatHybrid = "hybrid"

//nolint:gocyclo // Parsing keeps ordered heuristics together.
func Parse(m Message) Vacancy {
	text, entities := m.Text, m.Entities
	if text == "" {
		text, entities = m.Caption, m.CaptionEntities
	}
	v := Vacancy{OriginalText: text}
	section := ""
	var tasks, requirements, benefits, intro []string
	for _, line := range strings.Split(text, "\n") {
		s := strings.TrimSpace(line)
		if v.Heading == "" && s != "" {
			v.Heading = strings.TrimSpace(strings.TrimPrefix(s, "🌿"))
			v.Title = v.Heading
			if pos := strings.LastIndex(v.Heading, " в "); pos > 0 && pos+len(" в ") < len(v.Heading) {
				v.Title = strings.TrimSpace(v.Heading[:pos])
				v.Company = strings.TrimSpace(v.Heading[pos+len(" в "):])
			}
			continue
		}
		switch {
		case strings.Contains(s, "Какие задачи ждут?"):
			section = "tasks"
			continue
		case strings.Contains(s, "Кто идеальный кандидат?"):
			section = "requirements"
			continue
		case strings.Contains(s, "Что предлагают?"):
			section = "benefits"
			continue
		}
		clean := strings.TrimSpace(strings.TrimLeft(s, "▫✔🖼️ "))
		if strings.HasPrefix(clean, "Локализация:") {
			x := strings.TrimSpace(strings.TrimPrefix(clean, "Локализация:"))
			v.City = strings.TrimSpace(strings.Split(x, ",")[0])
			section = "done"
			continue
		}
		if strings.HasPrefix(clean, "Оплата:") {
			v.Salary = strings.TrimSpace(strings.TrimPrefix(clean, "Оплата:"))
		}
		if strings.HasPrefix(s, "Подробнее по ссылке") || strings.HasPrefix(s, "#") {
			section = "done"
			continue
		}
		switch section {
		case "":
			intro = append(intro, line)
		case "tasks":
			tasks = append(tasks, line)
		case "requirements":
			requirements = append(requirements, line)
		case "benefits":
			benefits = append(benefits, line)
		}
	}
	v.Introduction = strings.TrimSpace(strings.Join(intro, "\n"))
	v.Tasks = strings.TrimSpace(strings.Join(tasks, "\n"))
	v.Requirements = strings.TrimSpace(strings.Join(requirements, "\n"))
	v.Benefits = strings.TrimSpace(strings.Join(benefits, "\n"))
	v.SalaryMin, v.SalaryMax = parseSalary(v.Salary)
	lower := strings.ToLower(v.Benefits)
	if strings.Contains(lower, "гибридный формат") || strings.Contains(lower, "гибридный график") || strings.Contains(lower, "гибридный режим работы") {
		v.WorkFormat = workFormatHybrid
	} else if strings.Contains(lower, "удаленный формат") || strings.Contains(lower, "удалённый формат") {
		v.WorkFormat = "remote"
	} else if strings.Contains(lower, "офисный формат") {
		v.WorkFormat = "office"
	}
	if strings.Contains(lower, "полная занятость") {
		v.Employment = "fullTime"
	} else if strings.Contains(lower, "частичная занятость") {
		v.Employment = "partTime"
	}
	for _, e := range entities {
		if e.Type == "text_link" && e.URL != "" && validRange(text, e.Offset, e.Length) {
			v.SourceURL = e.URL
			break
		}
	}
	for _, p := range m.Photo {
		if p.FileID != "" {
			v.PhotoFileIDs = append(v.PhotoFileIDs, p.FileID)
		}
	}
	return v
}

func validRange(text string, offset, length int) bool {
	if offset < 0 || length <= 0 || offset > int(^uint(0)>>1)-length {
		return false
	}
	start, end := false, false
	pos := 0
	for _, r := range text {
		if pos == offset {
			start = true
		}
		if pos == offset+length {
			end = true
		}
		if r > 0xffff {
			pos += 2
		} else {
			pos++
		}
	}
	return (start || pos == offset) && (end || pos == offset+length)
}

// Format returns plain text bounded in UTF-16 units. maxUnits must match the
// destination's message or caption limit; a nonempty source URL is never cut.
func Format(v Vacancy, maxUnits int) (string, error) {
	var parts []string
	for _, p := range []struct{ label, value string }{{"", v.Heading}, {"Город", v.City}, {"Оплата", v.Salary}, {"Задачи", v.Tasks}, {"Требования", v.Requirements}, {"Условия", v.Benefits}} {
		if strings.TrimSpace(p.value) != "" {
			if p.label != "" {
				parts = append(parts, p.label+":\n"+p.value)
			} else {
				parts = append(parts, p.value)
			}
		}
	}
	body := strings.Join(parts, "\n\n")
	suffix := ""
	if v.SourceURL != "" {
		suffix = "\n\n" + v.SourceURL
		if body == "" {
			suffix = v.SourceURL
		}
	}
	units := func(s string) int { return len(utf16.Encode([]rune(s))) }
	if maxUnits <= 0 || units(suffix) > maxUnits {
		return "", errors.New("source URL exceeds text limit")
	}
	if units(body)+units(suffix) <= maxUnits {
		return body + suffix, nil
	}
	budget := maxUnits - units(suffix)
	if budget < 1 {
		return "", errors.New("no room for vacancy text")
	}
	var b strings.Builder
	used := 0
	for _, r := range body {
		n := 1
		if r > 0xffff {
			n = 2
		}
		if used+n > budget-1 {
			break
		}
		b.WriteRune(r)
		used += n
	}
	return strings.TrimRight(b.String(), " \n") + "…" + suffix, nil
}

var salaryPattern = regexp.MustCompile(`(?i)^([0-9][0-9 \x{00a0}]*)\s*(руб(?:лей|ля|ль|\.)?|₽)(?:\s|$)`)

func parseSalary(s string) (*int64, *int64) {
	m := salaryPattern.FindStringSubmatch(strings.TrimSpace(s))
	if len(m) == 0 {
		return nil, nil
	}
	digits := strings.ReplaceAll(strings.ReplaceAll(m[1], " ", ""), "\u00a0", "")
	n, err := strconv.ParseInt(digits, 10, 64)
	if err != nil || n <= 0 {
		return nil, nil
	}
	return &n, &n
}
