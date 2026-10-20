import json
import logging
import os
import threading
from datetime import date
import pika
from app.application.service import generate

QUEUE = "daily-closure"
DEAD_LETTER_QUEUE = "daily-closure.dead"
MAX_RETRIES = 3
logger = logging.getLogger(__name__)

def callback(ch, method, properties, body, generate_fn=generate):
    try:
        event = json.loads(body)
        generate_fn(event["tenant_id"], event["site_id"], date.fromisoformat(event["prediction_date"]))
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info("prediction_generated", extra={"visit_record_id": event["visit_record_id"], "tenant_id": event["tenant_id"]})
    except Exception:
        retries = (getattr(properties, "headers", None) or {}).get("x-retry-count", 0)
        logger.exception("prediction_job_failed", extra={"retry_count": retries})
        if retries >= MAX_RETRIES:
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return
        headers = dict(getattr(properties, "headers", None) or {})
        headers["x-retry-count"] = retries + 1
        ch.basic_publish(exchange="", routing_key=QUEUE, body=body, properties=pika.BasicProperties(delivery_mode=2, content_type="application/json", headers=headers))
        ch.basic_ack(delivery_tag=method.delivery_tag)

def _consume() -> None:
    params = pika.URLParameters(os.environ["RABBITMQ_URL"])
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue=DEAD_LETTER_QUEUE, durable=True)
    channel.queue_declare(queue=QUEUE, durable=True, arguments={"x-dead-letter-exchange": "", "x-dead-letter-routing-key": DEAD_LETTER_QUEUE})
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE, on_message_callback=callback)
    channel.start_consuming()

def start() -> threading.Thread:
    thread = threading.Thread(target=_consume, daemon=True, name="ml-worker")
    thread.start()
    return thread

