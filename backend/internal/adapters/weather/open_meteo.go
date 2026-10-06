package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// OpenMeteo is an outbound adapter. It deliberately has no dependency on the domain.
type OpenMeteo struct {
	BaseURL string
	Client  *http.Client
}
type Forecast struct {
	Date                                                      time.Time
	TemperatureMax, PrecipitationMM, PrecipitationProbability float64
	WeatherCode                                               int
}
type response struct {
	Daily struct {
		Time          []string  `json:"time"`
		Temperature   []float64 `json:"temperature_2m_max"`
		Precipitation []float64 `json:"precipitation_sum"`
		Probability   []float64 `json:"precipitation_probability_max"`
		Code          []int     `json:"weather_code"`
	} `json:"daily"`
}

func (o OpenMeteo) Forecast(ctx context.Context, latitude, longitude float64, target time.Time) (Forecast, error) {
	forecasts, err := o.Forecasts(ctx, latitude, longitude, target, 1)
	if err != nil {
		return Forecast{}, err
	}
	return forecasts[0], nil
}

// Forecasts fetches daily data in the destination's local timezone. Keeping
// this concern in the outbound adapter prevents HTTP handlers from encoding
// provider-specific query parameters.
func (o OpenMeteo) Forecasts(ctx context.Context, latitude, longitude float64, start time.Time, days int) ([]Forecast, error) {
	if days < 1 || days > 7 {
		return nil, fmt.Errorf("forecast days must be between 1 and 7")
	}
	u, err := url.Parse(o.BaseURL)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("latitude", fmt.Sprint(latitude))
	q.Set("longitude", fmt.Sprint(longitude))
	q.Set("daily", "temperature_2m_max,precipitation_sum,precipitation_probability_max,weather_code")
	q.Set("timezone", "America/Lima")
	q.Set("start_date", start.Format("2006-01-02"))
	q.Set("end_date", start.AddDate(0, 0, days-1).Format("2006-01-02"))
	u.RawQuery = q.Encode()
	client := o.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("open-meteo status %d", res.StatusCode)
	}
	var body response
	if err = json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}
	if len(body.Daily.Time) != days || len(body.Daily.Temperature) != days || len(body.Daily.Precipitation) != days || len(body.Daily.Probability) != days || len(body.Daily.Code) != days {
		return nil, fmt.Errorf("unexpected open-meteo daily response")
	}
	forecasts := make([]Forecast, days)
	for i := range forecasts {
		date, parseErr := time.Parse("2006-01-02", body.Daily.Time[i])
		if parseErr != nil {
			return nil, fmt.Errorf("invalid Open-Meteo date: %w", parseErr)
		}
		forecasts[i] = Forecast{Date: date, TemperatureMax: body.Daily.Temperature[i], PrecipitationMM: body.Daily.Precipitation[i], PrecipitationProbability: body.Daily.Probability[i], WeatherCode: body.Daily.Code[i]}
	}
	return forecasts, nil
}
