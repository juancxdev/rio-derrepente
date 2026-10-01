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
	u, err := url.Parse(o.BaseURL)
	if err != nil {
		return Forecast{}, err
	}
	q := u.Query()
	q.Set("latitude", fmt.Sprint(latitude))
	q.Set("longitude", fmt.Sprint(longitude))
	q.Set("daily", "temperature_2m_max,precipitation_sum,precipitation_probability_max,weather_code")
	q.Set("timezone", "America/Lima")
	q.Set("start_date", target.Format("2006-01-02"))
	q.Set("end_date", target.Format("2006-01-02"))
	u.RawQuery = q.Encode()
	client := o.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return Forecast{}, err
	}
	res, err := client.Do(req)
	if err != nil {
		return Forecast{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return Forecast{}, fmt.Errorf("open-meteo status %d", res.StatusCode)
	}
	var body response
	if err = json.NewDecoder(res.Body).Decode(&body); err != nil {
		return Forecast{}, err
	}
	if len(body.Daily.Time) != 1 || len(body.Daily.Temperature) != 1 || len(body.Daily.Precipitation) != 1 || len(body.Daily.Probability) != 1 || len(body.Daily.Code) != 1 {
		return Forecast{}, fmt.Errorf("unexpected open-meteo daily response")
	}
	return Forecast{Date: target, TemperatureMax: body.Daily.Temperature[0], PrecipitationMM: body.Daily.Precipitation[0], PrecipitationProbability: body.Daily.Probability[0], WeatherCode: body.Daily.Code[0]}, nil
}
