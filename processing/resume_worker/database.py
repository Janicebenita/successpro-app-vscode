from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator
from urllib.parse import unquote, urlparse

import mysql.connector
from mysql.connector.pooling import MySQLConnectionPool


class JobDatabase:
    def __init__(self, mysql_url: str):
        parsed = urlparse(mysql_url)
        self.pool = MySQLConnectionPool(pool_name="resume_native", pool_size=5, host=parsed.hostname or "127.0.0.1", port=parsed.port or 3306, user=unquote(parsed.username or "successpro"), password=unquote(parsed.password or "successpro"), database=parsed.path.lstrip("/") or "successpro_local", autocommit=False)

    @contextmanager
    def connection(self) -> Iterator[Any]:
        connection = self.pool.get_connection()
        try: yield connection
        finally: connection.close()

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self.connection() as connection:
            cursor = connection.cursor(dictionary=True)
            cursor.execute("SELECT * FROM resume_processing_jobs WHERE id = %s", (job_id,))
            return cursor.fetchone()

    def claim(self, job_id: str, worker_id: str, lease_seconds: int) -> dict[str, Any] | None:
        with self.connection() as connection:
            cursor = connection.cursor(dictionary=True)
            cursor.execute("UPDATE resume_processing_jobs SET status='processing', attempt_count=attempt_count+1, lease_owner=%s, lease_expires_at=DATE_ADD(NOW(6), INTERVAL %s SECOND), heartbeat_at=NOW(6), started_at=COALESCE(started_at,NOW(6)), error_message=NULL WHERE id=%s AND status IN ('queued','processing') AND (lease_expires_at IS NULL OR lease_expires_at < NOW(6) OR lease_owner=%s)", (worker_id, lease_seconds, job_id, worker_id))
            if cursor.rowcount != 1:
                connection.rollback(); return None
            cursor.execute("SELECT * FROM resume_processing_jobs WHERE id=%s", (job_id,))
            row = cursor.fetchone(); connection.commit(); return row

    def heartbeat(self, job_id: str, worker_id: str, lease_seconds: int) -> bool:
        with self.connection() as connection:
            cursor = connection.cursor()
            cursor.execute("UPDATE resume_processing_jobs SET heartbeat_at=NOW(6), lease_expires_at=DATE_ADD(NOW(6), INTERVAL %s SECOND) WHERE id=%s AND lease_owner=%s AND status='processing'", (lease_seconds, job_id, worker_id))
            connection.commit(); return cursor.rowcount == 1

    def checkpoint(self, job_id: str, *, page: int | None = None, chunk: int | None = None) -> None:
        updates: list[str] = []; values: list[Any] = []
        if page is not None: updates.append("page_checkpoint=GREATEST(page_checkpoint,%s)"); values.append(page)
        if chunk is not None: updates.append("chunk_checkpoint=GREATEST(chunk_checkpoint,%s)"); values.append(chunk)
        if not updates: return
        with self.connection() as connection:
            cursor = connection.cursor(); cursor.execute(f"UPDATE resume_processing_jobs SET {','.join(updates)} WHERE id=%s", (*values, job_id)); connection.commit()

    def save_extraction(self, job_id: str, result: dict[str, Any]) -> None:
        with self.connection() as connection:
            cursor = connection.cursor(); cursor.execute("UPDATE resume_processing_jobs SET extracted_result=%s, page_count=%s WHERE id=%s", (json.dumps(result), result["page_count"], job_id)); connection.commit()

    def awaiting_review(self, job_id: str, analysis: dict[str, Any], error_message: str | None = None) -> None:
        with self.connection() as connection:
            cursor = connection.cursor(); cursor.execute("UPDATE resume_processing_jobs SET ai_result=%s, status=IF(confirmed_result IS NULL, 'awaiting_review', 'completed'), error_message=%s, lease_owner=NULL, lease_expires_at=NULL, completed_at=NOW(6) WHERE id=%s", (json.dumps(analysis), error_message, job_id)); connection.commit()

    def retry(self, job_id: str, message: str) -> None:
        with self.connection() as connection:
            cursor = connection.cursor(); cursor.execute("UPDATE resume_processing_jobs SET status='queued', error_message=%s, lease_owner=NULL, lease_expires_at=NULL WHERE id=%s", (message[:2000], job_id)); connection.commit()

    def fail(self, job_id: str, message: str, dead_letter: bool) -> None:
        with self.connection() as connection:
            cursor = connection.cursor(); cursor.execute("UPDATE resume_processing_jobs SET status=%s, error_message=%s, lease_owner=NULL, lease_expires_at=NULL, completed_at=NOW(6) WHERE id=%s", ("dead_letter" if dead_letter else "failed", message[:2000], job_id)); connection.commit()

