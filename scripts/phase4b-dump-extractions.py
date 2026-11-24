"""Phase 4B: Dump full extracted text, pages, and document signals for domain audit."""
import json
import sys
from pathlib import Path

root = Path(r"D:\successpro-app-vscode")
sys.path.insert(0, str(root / "processing"))

from resume_worker.extraction import extract_pdf, document_signals
from resume_worker.visual import analyse_pdf_pages
from resume_worker.config import Settings

fixtures_dir = root / ".local/phase4b/fixtures"
out_dir = root / ".local/phase4b/audit_results"
out_dir.mkdir(parents=True, exist_ok=True)

settings = Settings.load()

full_extractions = {}
for pdf_file in sorted(fixtures_dir.glob("*.pdf")):
    name = pdf_file.stem
    pages, render_pdf = extract_pdf(pdf_file, settings)
    text = "\n\n".join(p.text for p in pages)
    temp_dir = out_dir / f"temp_{name}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    design, page_images = analyse_pdf_pages(render_pdf, temp_dir, settings.render_dpi)
    signals = document_signals(pages, image_only=False, design=design, gemini_visual={})
    
    full_extractions[name] = {
        "text": text,
        "pageCount": len(pages),
        "pages": [{"page": p.page, "text": p.text} for p in pages],
        "signals": signals
    }

(out_dir / "full_extractions.json").write_text(json.dumps(full_extractions, indent=2), encoding="utf-8")
print(f"Dumped full extractions for {len(full_extractions)} fixtures to {out_dir / 'full_extractions.json'}")
