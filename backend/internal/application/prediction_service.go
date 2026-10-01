package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/predictions"
)

type GetPredictionService struct{ predictions PredictionRepository }

func NewGetPredictionService(predictions PredictionRepository) GetPredictionService {
	return GetPredictionService{predictions: predictions}
}
func (s GetPredictionService) Execute(ctx context.Context, siteID uuid.UUID, date time.Time) (predictions.Prediction, error) {
	return s.predictions.FindByDate(ctx, siteID, date)
}
