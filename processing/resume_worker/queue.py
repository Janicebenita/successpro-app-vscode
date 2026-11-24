from __future__ import annotations

import json
import time
from typing import Any

import redis


READY = "resume:native:ready"
PROCESSING = "resume:native:processing"
RETRY = "resume:native:retry"
DEAD = "resume:native:dead"


class ReliableQueue:
    def __init__(self, url: str):
        self.client = redis.Redis.from_url(url, decode_responses=True)

    def promote_retries(self) -> None:
        now = time.time()
        for payload in self.client.zrangebyscore(RETRY, 0, now, start=0, num=100):
            with self.client.pipeline() as pipe:
                pipe.zrem(RETRY, payload); pipe.lpush(READY, payload); pipe.execute()

    def reserve(self, timeout: int = 5) -> tuple[str, dict[str, Any]] | None:
        payload = self.client.brpoplpush(READY, PROCESSING, timeout=timeout)
        if not payload: return None
        return payload, json.loads(payload)

    def acquire_lock(self, job_id: str, worker_id: str, ttl_seconds: int) -> bool:
        return bool(self.client.set(f"resume:native:lock:{job_id}", worker_id, nx=True, ex=ttl_seconds))

    def extend_lock(self, job_id: str, worker_id: str, ttl_seconds: int) -> bool:
        script = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('expire',KEYS[1],ARGV[2]) else return 0 end"
        return bool(self.client.eval(script, 1, f"resume:native:lock:{job_id}", worker_id, ttl_seconds))

    def release_lock(self, job_id: str, worker_id: str) -> None:
        script = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end"
        self.client.eval(script, 1, f"resume:native:lock:{job_id}", worker_id)

    def acknowledge(self, payload: str, job_id: str) -> None:
        with self.client.pipeline() as pipe:
            pipe.lrem(PROCESSING, 1, payload); pipe.delete(f"resume:native:enqueued:{job_id}"); pipe.execute()

    def retry(self, payload: str, attempt: int) -> None:
        delay = min(300, (2 ** max(0, attempt - 1)) * 5)
        with self.client.pipeline() as pipe:
            pipe.lrem(PROCESSING, 1, payload); pipe.zadd(RETRY, {payload: time.time() + delay}); pipe.execute()

    def dead_letter(self, payload: str) -> None:
        with self.client.pipeline() as pipe:
            pipe.lrem(PROCESSING, 1, payload); pipe.lpush(DEAD, payload); pipe.execute()

    def recover_orphans(self) -> int:
        """Return to READY any in-flight message whose worker lock has expired.

        A worker that is closed or crashes mid-job leaves its message in PROCESSING
        forever (BRPOPLPUSH never gives it back), so the job stays "processing" and the
        upload screen waits at 94% until its 15-minute timeout.
        """
        recovered = 0
        for payload in self.client.lrange(PROCESSING, 0, -1):
            try: job_id = str(json.loads(payload).get("jobId", ""))
            except (ValueError, AttributeError): job_id = ""
            if job_id and self.client.exists(f"resume:native:lock:{job_id}"): continue
            with self.client.pipeline() as pipe:
                pipe.lrem(PROCESSING, 1, payload)
                if job_id: pipe.rpush(READY, payload)
                else: pipe.lpush(DEAD, payload)
                pipe.execute()
            recovered += 1
        return recovered
