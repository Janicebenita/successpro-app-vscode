from __future__ import annotations

import json
import logging
import shutil
import signal
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from .ai import chunks, evaluate_visual_design_with_fallback, merge_analysis, provider, validate_analysis, vision_ocr_page
from .config import REJECTION_MESSAGE, Settings
from .database import JobDatabase
from .extraction import NativeTextError, document_signals, extract_docx, extract_pdf, identify_profile, is_image_only, validate_native_text
from .runtime_identity import identity
from .models import ExtractionResult
from .queue import ReliableQueue
from .visual import analyse_pdf_pages

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("resume-native")


def _inside(child: Path, parent: Path) -> bool:
    try: child.resolve().relative_to(parent.resolve()); return True
    except ValueError: return False


def cleanup_abandoned(root: Path, older_than_seconds: int) -> None:
    root.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - older_than_seconds
    for entry in root.iterdir():
        if entry.is_dir() and _inside(entry, root) and (older_than_seconds <= 0 or entry.stat().st_mtime <= cutoff):
            shutil.rmtree(entry, ignore_errors=True)


class Heartbeat:
    def __init__(self, database: JobDatabase, queue: ReliableQueue, job_id: str, worker_id: str, settings: Settings):
        self.database, self.queue, self.job_id, self.worker_id, self.settings = database, queue, job_id, worker_id, settings
        self.stop_event = threading.Event(); self.thread = threading.Thread(target=self.run, daemon=True)

    def run(self) -> None:
        while not self.stop_event.wait(self.settings.heartbeat_seconds):
            if not self.database.heartbeat(self.job_id, self.worker_id, self.settings.lease_seconds): return
            if not self.queue.extend_lock(self.job_id, self.worker_id, self.settings.lease_seconds): return

    def __enter__(self) -> "Heartbeat": self.thread.start(); return self
    def __exit__(self, *_args: Any) -> None: self.stop_event.set(); self.thread.join(timeout=2)


class Worker:
    def __init__(self, settings: Settings):
        self.settings = settings; self.database = JobDatabase(settings.mysql_url); self.queue = ReliableQueue(settings.redis_url); self.worker_id = f"{uuid.uuid4()}"; self.stopping = False; self.runtime = identity(); LOGGER.info("WORKER_RUNTIME %s", json.dumps(self.runtime))

    def process(self, job: dict[str, Any], temporary_directory: Path) -> None:
        original = Path(job["original_path"]).resolve()
        LOGGER.info("PROCESSING_ORIGINAL: %s (exists=%s, inside=%s, storage_root=%s)", original, original.is_file(), _inside(original, self.settings.storage_root), self.settings.storage_root)
        if not _inside(original, self.settings.storage_root) or not original.is_file(): raise NativeTextError(REJECTION_MESSAGE)
        if original.stat().st_size > self.settings.maximum_bytes: raise NativeTextError(f"Resume files must be {self.settings.maximum_bytes // 1024 // 1024} MB or smaller.")
        suffix = original.suffix.lower()
        if suffix == ".pdf": pages, render_pdf = extract_pdf(original, self.settings); kind = "pdf"
        elif suffix == ".docx": pages, render_pdf = extract_docx(original, temporary_directory, self.settings); kind = "docx"
        else: raise NativeTextError(REJECTION_MESSAGE)
        image_only = is_image_only(pages)
        if image_only:
            try:
                import fitz
                doc = fitz.open(render_pdf)
                for idx, page in enumerate(pages):
                    if idx < doc.page_count:
                        pix = doc[idx].get_pixmap(dpi=self.settings.render_dpi)
                        ocr_text = vision_ocr_page(pix.tobytes("png"), self.settings)
                        if ocr_text:
                            page.text = ocr_text
                            page.meaningful_characters = len(ocr_text)
                doc.close()
            except Exception as ocr_err:
                LOGGER.warning("Vision OCR execution error: %s", ocr_err)
        insufficient = validate_native_text(pages)
        if image_only and insufficient:
            raise NativeTextError("This scanned PDF could not be read. OCR is unavailable or returned insufficient text. Retry when Gemini is available, upload a PDF with selectable text, or paste the actual resume text.")
        design, page_images = analyse_pdf_pages(render_pdf, temporary_directory, self.settings.render_dpi)
        if design and len(design) == len(pages):
            for metric, page in zip(design, pages):
                if "text_collision_detected" in page.warnings and "text_collision_detected" not in metric.warnings:
                    metric.warnings.append("text_collision_detected")
            blank_pages = {metric.page for metric in design if "blank_rendered_page" in metric.warnings}
            insufficient = [page for page in insufficient if page not in blank_pages]
        gemini_visual: dict[str, Any] = {}
        if page_images and self.settings.ai_provider == "gemini":
            try:
                gemini_visual = evaluate_visual_design_with_fallback(page_images, design, self.settings)
                LOGGER.info("Gemini Vision evaluation completed: score=%s", gemini_visual.get("score"))
            except Exception as vis_err:
                LOGGER.warning("Gemini Vision evaluation failed: %s", vis_err)
        for page in pages: self.database.checkpoint(job["id"], page=page.page)
        deterministic = identify_profile(pages)
        signals = document_signals(pages, image_only=image_only, design=design, gemini_visual=gemini_visual)
        signals["extractionReliable"] = signals["extractionReliable"] and not insufficient and not any("reading_order_ambiguous" in p.warnings for p in pages)
        extraction = ExtractionResult(runtime=self.runtime, provider_metadata=gemini_visual.get("provider_metadata", {}),kind=kind, page_count=len(pages), text="\n\n".join(page.text for page in pages), pages=pages, design=design, profile=deterministic, insufficient_text_pages=insufficient, warnings=list(dict.fromkeys([warning for metric in design for warning in metric.warnings]+[warning for page in pages for warning in page.warnings]+deterministic.warnings)), signals=signals)
        extraction_payload = extraction.model_dump(mode="json")
        self.database.save_extraction(job["id"], extraction_payload)
        profile_data = {
            "name": deterministic.name.value if deterministic.name else "",
            "email": next((e.value for e in deterministic.emails), "") if deterministic.emails else "",
            "phone": next((p.value for p in deterministic.phones), "") if deterministic.phones else "",
            "headline": deterministic.professional_title.value if deterministic.professional_title else "",
        }
        quick_result = {
            "profile": profile_data,
            "evidence": {
                "name": deterministic.name.pages if deterministic.name else [],
                "email": [p for e in deterministic.emails for p in e.pages],
                "phone": [p for ph in deterministic.phones for p in ph.pages],
                "headline": deterministic.professional_title.pages if deterministic.professional_title else [],
            },
            "warnings": [],
            "provider_calls": [gemini_visual.get("provider_metadata", {})] if gemini_visual else []
        }
        self.database.awaiting_review(job["id"], quick_result, None)
        LOGGER.info("JOB_READY_FOR_REVIEW %s (instant pipeline in %s pages)", job["id"], len(pages))

    def recover_orphans(self) -> None:
        try:
            recovered = self.queue.recover_orphans()
            if recovered: LOGGER.warning("RECOVERED_ORPHANED_JOBS %s", recovered)
        except Exception as error:
            LOGGER.warning("Orphan recovery failed: %s", error)

    def run_once(self) -> bool:
        self.queue.promote_retries(); reserved = self.queue.reserve()
        if not reserved: return False
        payload, message = reserved; job_id = str(message.get("jobId", ""))
        if not job_id: self.queue.dead_letter(payload); return True
        if not self.queue.acquire_lock(job_id, self.worker_id, self.settings.lease_seconds): self.queue.retry(payload, 1); return True
        temporary_directory: Path | None = None
        try:
            job = self.database.claim(job_id, self.worker_id, self.settings.lease_seconds)
            if not job: self.queue.acknowledge(payload, job_id); return True
            temporary_directory = Path(tempfile.mkdtemp(prefix=f"resume-{job_id}-", dir=self.settings.temporary_root)).resolve()
            if not _inside(temporary_directory, self.settings.temporary_root): raise RuntimeError("Unsafe temporary directory")
            with Heartbeat(self.database, self.queue, job_id, self.worker_id, self.settings): self.process(job, temporary_directory)
            self.queue.acknowledge(payload, job_id)
        except NativeTextError as error:
            self.database.fail(job_id, str(error), dead_letter=False); self.queue.acknowledge(payload, job_id)
        except Exception as error:
            LOGGER.exception("Processing failed for %s", job_id); job = self.database.get(job_id); attempt = int(job["attempt_count"]) if job else self.settings.maximum_retries
            if attempt < self.settings.maximum_retries: self.database.retry(job_id, str(error)); self.queue.retry(payload, attempt)
            else: self.database.fail(job_id, str(error), dead_letter=True); self.queue.dead_letter(payload)
        finally:
            if temporary_directory and _inside(temporary_directory, self.settings.temporary_root): shutil.rmtree(temporary_directory, ignore_errors=True)
            self.queue.release_lock(job_id, self.worker_id)
        return True

    def run(self) -> None:
        self.settings.temporary_root.mkdir(parents=True, exist_ok=True); cleanup_abandoned(self.settings.temporary_root, self.settings.timeout_seconds * 2)
        self.recover_orphans(); last_recovery = time.monotonic()
        while not self.stopping:
            if time.monotonic() - last_recovery >= 60:
                self.recover_orphans(); last_recovery = time.monotonic()
            handled = self.run_once()
            if not handled:
                time.sleep(1)


def main() -> None:
    settings = Settings.load()
    if settings.ai_provider not in {"mock", "gemini"}: raise SystemExit("RESUME_AI_PROVIDER must be mock or gemini")
    if settings.gemini_pro_enabled: raise SystemExit("GEMINI_PRO_ENABLED must remain false")
    worker = Worker(settings)
    signal.signal(signal.SIGINT, lambda *_args: setattr(worker, "stopping", True)); signal.signal(signal.SIGTERM, lambda *_args: setattr(worker, "stopping", True))
    worker.run()


if __name__ == "__main__": main()

