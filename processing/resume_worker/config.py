from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _integer(name: str, default: int, minimum: int = 1) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value >= minimum else default


@dataclass(frozen=True)
class Settings:
    repository_root: Path
    storage_root: Path
    temporary_root: Path
    mysql_url: str
    redis_url: str
    maximum_bytes: int
    maximum_pages: int
    chunk_pages: int
    render_dpi: int
    timeout_seconds: int
    lease_seconds: int
    heartbeat_seconds: int
    maximum_retries: int
    ai_provider: str
    gemini_api_key: str
    gemini_model: str
    gemini_max_retries: int
    gemini_pro_enabled: bool
    libreoffice_binary: str
    gemini_fallback_model: str = ""
    gemini_vision_timeout_ms: int = 25_000
    gemini_vision_budget_ms: int | None = None
    gemini_vision_fallback_model: str = ""

    @classmethod
    def load(cls) -> "Settings":
        root = Path(__file__).resolve().parents[2]
        load_dotenv(root / "apps" / "web" / ".env.local")
        return cls(
            repository_root=root,
            storage_root=Path(os.getenv("RESUME_LOCAL_STORAGE_ROOT", root / ".local" / "resumes")).resolve(),
            temporary_root=Path(os.getenv("RESUME_TEMP_ROOT", root / ".local" / "resume-temp")).resolve(),
            mysql_url=os.getenv("RESUME_MYSQL_URL", "mysql://successpro:successpro@127.0.0.1:3306/successpro_local"),
            redis_url=os.getenv("RESUME_REDIS_URL", "redis://127.0.0.1:6379"),
            maximum_bytes=_integer("RESUME_MAX_FILE_SIZE_MB", 20) * 1024 * 1024,
            maximum_pages=_integer("RESUME_MAX_PAGES", 25),
            chunk_pages=_integer("RESUME_CHUNK_PAGES", 5),
            render_dpi=min(150, max(120, _integer("RESUME_RENDER_DPI", 144))),
            timeout_seconds=_integer("RESUME_PROCESSING_TIMEOUT_SECONDS", 900),
            lease_seconds=_integer("RESUME_JOB_LEASE_SECONDS", 90),
            heartbeat_seconds=_integer("RESUME_HEARTBEAT_SECONDS", 20),
            maximum_retries=_integer("RESUME_MAX_RETRIES", 3),
            ai_provider=os.getenv("RESUME_AI_PROVIDER", "mock").strip().lower(),
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            gemini_model=os.getenv("GEMINI_MODEL", ""),
            gemini_fallback_model=os.getenv("GEMINI_FALLBACK_MODEL", "").strip(),
            gemini_vision_fallback_model=os.getenv("GEMINI_VISION_FALLBACK_MODEL", "").strip(),
            gemini_max_retries=_integer("GEMINI_MAX_RETRIES", 1, 0),
            gemini_pro_enabled=os.getenv("GEMINI_PRO_ENABLED", "false").lower() == "true",
            libreoffice_binary=os.getenv("LIBREOFFICE_BINARY", "soffice"),
        )


REJECTION_MESSAGE = "Please upload a digital PDF or DOCX containing selectable text."

