import os
import sys
import json

sys.path.insert(0, "D:/successpro-app-vscode/processing")
from resume_worker.config import Settings
from resume_worker.ai import provider, evaluate_visual_design_gemini, validate_analysis
from resume_worker.extraction import extract_pdf, identify_profile
from resume_worker.visual import analyse_pdf_pages
from pathlib import Path

# Load settings and force gemini
s = Settings.load()
os.environ["RESUME_AI_PROVIDER"] = "gemini"
s = Settings.load()

print(f"Provider: {s.ai_provider}, Model: {s.gemini_model}, Key set: {bool(s.gemini_api_key)}")

pdf_path = Path("D:/successpro-app-vscode/.local/phase4b/fixtures/poor_singlecol_nodates_nocontact.pdf")
pages, render_pdf = extract_pdf(pdf_path, s)
deterministic = identify_profile(pages)

print(f"Pages extracted: {len(pages)}, text length: {len(pages[0].text)}")

analysis_prov = provider(s)
print(f"Instantiated provider: {analysis_prov.name}")

try:
    chunk_res = analysis_prov.analyse_chunk(pages, deterministic)
    print("analyse_chunk SUCCESS!")
    print("Keys returned:", list(chunk_res.keys()))
    print("Profile:", chunk_res.get("profile"))
    print("Warnings:", chunk_res.get("warnings"))
    errors = validate_analysis(chunk_res if hasattr(chunk_res, "profile") else None, pages)
    print("validate_analysis errors:", errors)
except Exception as e:
    import traceback
    traceback.print_exc()
