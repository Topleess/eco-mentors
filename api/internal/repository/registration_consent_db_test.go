package repository

import (
	"context"
	"testing"
	"time"

	"github.com/openmentor-io/openmentor/api/test/dbtest"
	"github.com/stretchr/testify/require"
)

func TestCreateMentorPersistsRegistrationConsent(t *testing.T) {
	pool := dbtest.Pool(t)
	repo := NewMentorRepository(pool, nil)
	ctx := context.Background()
	consent := time.Now().UTC().Truncate(time.Microsecond)
	id, _, _, err := repo.CreateMentor(ctx, map[string]interface{}{"name": "Consent Test", "status": "draft", "registration_consented_at": consent}, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM mentors WHERE id=$1`, id) })
	var stored time.Time
	require.NoError(t, pool.QueryRow(ctx, `SELECT registration_consented_at FROM mentors WHERE id=$1`, id).Scan(&stored))
	require.True(t, consent.Equal(stored), "wanted %v got %v", consent, stored)
}
