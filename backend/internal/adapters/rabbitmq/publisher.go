package rabbitmq

import (
	"context"
	"encoding/json"
	"time"

	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
	"github.com/rabbitmq/amqp091-go"
)

const Queue = "visit-record-created"

type Publisher struct {
	conn *amqp091.Connection
	ch   *amqp091.Channel
}
type event struct {
	EventType      string    `json:"event_type"`
	VisitRecordID  int64     `json:"visit_record_id"`
	SiteID         string    `json:"site_id"`
	PredictionDate string    `json:"prediction_date"`
	OccurredAt     time.Time `json:"occurred_at"`
}

func New(url string) (*Publisher, error) {
	c, err := amqp091.Dial(url)
	if err != nil {
		return nil, err
	}
	ch, err := c.Channel()
	if err != nil {
		c.Close()
		return nil, err
	}
	if _, err = ch.QueueDeclare(Queue, true, false, false, false, nil); err != nil {
		ch.Close()
		c.Close()
		return nil, err
	}
	return &Publisher{conn: c, ch: ch}, nil
}
func (p *Publisher) Close() {
	if p.ch != nil {
		p.ch.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}
}
func (p *Publisher) PublishVisitCreated(ctx context.Context, r visits.Record) error {
	b, err := json.Marshal(event{"VisitRecordCreated", r.ID, r.SiteID.String(), r.VisitDate.AddDate(0, 0, 1).Format("2006-01-02"), time.Now().UTC()})
	if err != nil {
		return err
	}
	return p.ch.PublishWithContext(ctx, "", Queue, false, false, amqp091.Publishing{DeliveryMode: amqp091.Persistent, ContentType: "application/json", Body: b})
}
