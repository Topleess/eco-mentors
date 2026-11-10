package imageclass

import (
	"testing"

	"github.com/openmentor-io/openmentor/api/test/imagefixture"
	"github.com/stretchr/testify/require"
)

func TestValidateBytesRejectsTruncatedPixels(t *testing.T) {
	data := imagefixture.PhotoPNG(t, 40, 40)
	require.NoError(t, CheckBounds(data[:40]))
	require.Error(t, ValidateBytes(t.Context(), data[:40]))
	require.NoError(t, ValidateBytes(t.Context(), data))
}
