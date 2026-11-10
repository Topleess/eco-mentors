package imageclass

import (
	"bytes"
	"context"
	"image"
)

// ValidateBytes fully decodes without classifying, sharing the profile decode budget.
func ValidateBytes(ctx context.Context, data []byte) error {
	if err := CheckBounds(data); err != nil {
		return err
	}
	if err := acquireDecodeSlot(ctx); err != nil {
		return err
	}
	defer releaseDecodeSlot()
	_, _, err := image.Decode(bytes.NewReader(data))
	return err
}
