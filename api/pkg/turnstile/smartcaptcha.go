package turnstile

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (v *Verifier) verifySmartCaptcha(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" || v.opts.SecretKey == "" || v.opts.ExpectedHostname == "" {
		return fmt.Errorf("captcha configuration or token missing")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	data := url.Values{"secret": {v.opts.SecretKey}, "token": {token}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://smartcaptcha.cloud.yandex.ru/validate", strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("captcha request failed")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("captcha provider unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("captcha provider returned HTTP %d", resp.StatusCode)
	}
	var result struct {
		Status string `json:"status"`
		Host   string `json:"host"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16384)).Decode(&result); err != nil {
		return fmt.Errorf("captcha provider response invalid")
	}
	if result.Status != "ok" || !strings.EqualFold(result.Host, v.opts.ExpectedHostname) {
		return fmt.Errorf("captcha verification failed")
	}
	return nil
}
