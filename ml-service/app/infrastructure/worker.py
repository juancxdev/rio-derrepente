import json
import logging
import os
import threading
from datetime import date
import pika
from app.application.service import generate

QUEUE = "visit-record-created"
logger = logging.getLogger(__name__)

def _consume() -> None:
    params = pika.URLParameters(os.environ["RABBITMQ_URL"])
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue=QUEUE, durable=True)
    def callback(ch, method, _properties, body):
        try:
            event = json.loads(body)
            generate(event["site_id"], date.fromisoformat(event["prediction_date"]))
            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.info("prediction_generated", extra={"visit_record_id": event["visit_record_id"]})
        except Exception:
            logger.exception("prediction_job_failed")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE, on_message_callback=callback)
    channel.start_consuming()

def start() -> threading.Thread:
    thread = threading.Thread(target=_consume, daemon=True, name="ml-worker")
    thread.start()
    return thread

