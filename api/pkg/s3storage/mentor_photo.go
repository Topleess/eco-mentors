package s3storage

import (
	"context"
	"errors"
	"io"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

var ErrMentorPhotoNotFound = errors.New("mentor photo not found")

const s3NoSuchKey = "NoSuchKey"

func (s *StorageClient) ReadMentorPhoto(ctx context.Context, id string) ([]byte, error) {
	if s == nil || s.s3Client == nil {
		return nil, ErrResearchStorageUnavailable
	}
	if !ValidResearchCoverID(id) {
		return nil, errors.New("invalid mentor ID")
	}
	out, err := s.s3Client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucketName), Key: aws.String(id + "/full")})
	if err != nil {
		var e smithy.APIError
		if errors.As(err, &e) && (e.ErrorCode() == s3NoSuchKey || e.ErrorCode() == "NotFound") {
			return nil, ErrMentorPhotoNotFound
		}
		return nil, err
	}
	defer out.Body.Close()
	data, err := io.ReadAll(io.LimitReader(out.Body, MaxImageBytes+1))
	if err != nil {
		return nil, err
	}
	if err := ValidateImage(data, http.DetectContentType(data)); err != nil {
		return nil, err
	}
	return data, nil
}
