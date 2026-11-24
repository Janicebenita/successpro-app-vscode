import sys
from pathlib import Path

# Add processing to path
sys.path.insert(0, str(Path(__file__).parent))

from resume_worker.visual import analyse_pdf_pages
from resume_worker.config import Settings
from resume_worker.extraction import document_signals, extract_pdf
# test visual analysis

pdf_files = list(Path(".data/resumes").glob("**/*.pdf"))
print(f"Found {len(pdf_files)} PDF files.")
if pdf_files:
    target_pdf = pdf_files[0]
    print(f"Testing visual analysis on: {target_pdf}")
    temp_dir = Path(".data/resume-temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    settings = Settings.load()
    pages, render_pdf = extract_pdf(target_pdf, settings)
    design, page_images = analyse_pdf_pages(render_pdf, temp_dir, 144)
    print(f"Pages: {len(pages)}")
    print(f"Design metrics: {len(design)}")
    print(f"Page images: {len(page_images)}")
    signals = document_signals(pages, image_only=False, design=design, gemini_visual={})
    print("Extracted signals:")
    for k, v in signals.items():
        if k != "geminiPageFindings":
            print(f"  {k}: {v}")
