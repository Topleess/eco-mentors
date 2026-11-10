package s3storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/imageclass"
	"github.com/openmentor-io/openmentor/api/pkg/metrics"
)

var researchCoverID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var ErrResearchCoverNotFound = errors.New("research cover not found")
var ErrResearchStorageUnavailable = errors.New("research storage unavailable")

func ValidResearchCoverID(id string) bool { return researchCoverID.MatchString(id) }

// ValidateResearchCover reuses photo limits but requires a complete pixel decode.
func ValidateResearchCover(ctx context.Context, data []byte, contentType string) error {
	if err := ValidateImage(data, contentType); err != nil {
		return err
	}
	if http.DetectContentType(data) != contentType {
		return errors.New("image content type mismatch")
	}
	return imageclass.ValidateBytes(ctx, data)
}

// UploadResearchCover writes an immutable object. Replaced and abandoned covers
// are retained; article save only changes its reference, not object ownership.
func (s *StorageClient) UploadResearchCover(ctx context.Context, data []byte, contentType string) (string, error) {
	if s == nil {
		return "", ErrResearchStorageUnavailable
	}
	if err := ValidateResearchCover(ctx, data, contentType); err != nil {
		return "", err
	}
	id := uuid.NewString()
	start := time.Now()
	_, err := s.s3Client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.bucketName), Key: aws.String("research-covers/" + id), Body: bytes.NewReader(data), ContentType: aws.String(contentType), IfNoneMatch: aws.String("*")})
	recordResearchStorage("uploadResearchCover", start, err)
	if err != nil {
		return "", fmt.Errorf("upload research cover: %w", err)
	}
	return id, nil
}

func (s *StorageClient) ReadResearchCover(ctx context.Context, id string) ([]byte, error) {
	if s == nil {
		return nil, ErrResearchStorageUnavailable
	}
	if !ValidResearchCoverID(id) {
		return nil, errors.New("invalid cover ID")
	}
	start := time.Now()
	out, err := s.s3Client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucketName), Key: aws.String("research-covers/" + id)})
	recordResearchStorage("readResearchCover", start, err)
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NoSuchKey" || apiErr.ErrorCode() == "NotFound") {
			return nil, ErrResearchCoverNotFound
		}
		return nil, err
	}
	defer func() { _ = out.Body.Close() }()
	data, err := io.ReadAll(io.LimitReader(out.Body, MaxImageBytes+1))
	if err != nil {
		return nil, err
	}
	if err := ValidateResearchCover(ctx, data, http.DetectContentType(data)); err != nil {
		return nil, err
	}
	return data, nil
}

func recordResearchStorage(operation string, start time.Time, err error) {
	outcome := "success"
	if err != nil {
		outcome = "error"
	}
	if metrics.S3StorageRequestTotal != nil {
		metrics.S3StorageRequestTotal.WithLabelValues(operation, outcome).Inc()
	}
	if metrics.S3StorageRequestDuration != nil {
		metrics.S3StorageRequestDuration.WithLabelValues(operation, outcome).Observe(metrics.MeasureDuration(start))
	}
}
