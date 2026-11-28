package worker

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/pkg/email"
)

type acceptanceRepository interface {
	ClaimAcceptanceNotification(context.Context, string) (time.Time, error)
	FinishAcceptanceNotification(context.Context, string, time.Time, bool) (bool, error)
	ListPendingAcceptanceNotifications(context.Context) ([]string, error)
}

func (h *Handlers) RequestAccepted(c *gin.Context) {
	id := c.Query("requestId")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requestId is required"})
		return
	}
	sent, err := h.deliverAcceptance(c.Request.Context(), id)
	_ = sent
	if errors.Is(err, errAcceptanceNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

var errAcceptanceNotFound = errors.New("request not found")

func (h *Handlers) deliverAcceptance(ctx context.Context, id string) (bool, error) {
	repo, ok := h.repo.(acceptanceRepository)
	if !ok {
		return false, errors.New("acceptance repository unavailable")
	}
	request, err := h.repo.GetJobRequestWithMentorName(ctx, id)
	if err != nil {
		return false, err
	}
	if request == nil {
		return false, errAcceptanceNotFound
	}
	if strings.TrimSpace(request.AcceptedContact) == "" {
		return false, nil
	}
	claim, err := repo.ClaimAcceptanceNotification(ctx, id)
	if err != nil || claim.IsZero() {
		return false, err
	}
	sendCtx, cancel := context.WithTimeout(ctx, time.Minute)
	err = h.sendEmail(sendCtx, "request-accepted", email.Message{TemplateName: "request-accepted", Recipient: request.Email, Props: map[string]interface{}{"first_name": request.Name, "mentor_name": request.MentorName, "mentor_contact": request.AcceptedContact}})
	cancel()
	// Finish even if the HTTP request was canceled; stale leases recover DB failures.
	finishCtx, finishCancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer finishCancel()
	applied, finishErr := repo.FinishAcceptanceNotification(finishCtx, id, claim, err == nil)
	if finishErr != nil {
		return false, finishErr
	}
	if !applied {
		return false, errors.New("acceptance claim lost")
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (h *Handlers) RetryAcceptanceNotifications(ctx context.Context) (JobSummary, error) {
	summary := JobSummary{Job: "retry-acceptance-notifications"}
	if h.skipRequestRetry() {
		summary.Skipped = true
		summary.SkipReason = skipReasonNonProduction
		return summary, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	repo, ok := h.repo.(acceptanceRepository)
	if !ok {
		return summary, errors.New("acceptance repository unavailable")
	}
	ids, err := repo.ListPendingAcceptanceNotifications(ctx)
	if err != nil {
		return summary, err
	}
	summary.MentorsMatched = len(ids)
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return summary, err
		}
		sent, err := h.deliverAcceptance(ctx, id)
		if err != nil {
			summary.EmailFailures++
			continue
		}
		if sent {
			summary.EmailsSent++
		}
	}
	if summary.EmailFailures > 0 {
		return summary, errors.New("acceptance notification retries failed")
	}
	return summary, nil
}
