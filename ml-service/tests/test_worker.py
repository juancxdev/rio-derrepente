import json
from types import SimpleNamespace
from app.infrastructure.worker import MAX_RETRIES, callback

class Channel:
    def __init__(self): self.acks = []; self.nacks = []; self.published = []
    def basic_ack(self, **kwargs): self.acks.append(kwargs)
    def basic_nack(self, **kwargs): self.nacks.append(kwargs)
    def basic_publish(self, **kwargs): self.published.append(kwargs)

EVENT = {"event_type":"daily-closure","tenant_id":"tenant-1","site_id":"site-1","visit_record_id":7,"prediction_date":"2026-10-21"}

def test_daily_closure_contract_invokes_generation_for_tenant_and_site():
    channel = Channel(); received = []
    callback(channel, SimpleNamespace(delivery_tag=4), SimpleNamespace(headers={}), json.dumps(EVENT), lambda *args: received.append(args))
    assert received == [("tenant-1", "site-1", __import__("datetime").date(2026, 10, 21))]
    assert channel.acks == [{"delivery_tag": 4}]

def test_failed_callback_retries_then_dead_letters_without_requeue_loop():
    channel = Channel(); method = SimpleNamespace(delivery_tag=4)
    callback(channel, method, SimpleNamespace(headers={}), json.dumps(EVENT), lambda *_: (_ for _ in ()).throw(RuntimeError("down")))
    assert channel.published[0]["properties"].headers["x-retry-count"] == 1
    callback(channel, method, SimpleNamespace(headers={"x-retry-count": MAX_RETRIES}), json.dumps(EVENT), lambda *_: (_ for _ in ()).throw(RuntimeError("down")))
    assert channel.nacks == [{"delivery_tag": 4, "requeue": False}]
