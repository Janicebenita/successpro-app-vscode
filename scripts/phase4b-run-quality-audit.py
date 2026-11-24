"""Phase 4B: Execute quality audit across synthetic fixtures without candidate database mutations."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
import fitz

root = Path(r"D:\successpro-app-vscode")
sys.path.insert(0, str(root / "processing"))

from resume_worker.extraction import extract_pdf, document_signals, validate_native_text
from resume_worker.visual import analyse_pdf_pages
from resume_worker.config import Settings

fixtures_dir = root / ".local/phase4b/fixtures"
out_dir = root / ".local/phase4b/audit_results"
out_dir.mkdir(parents=True, exist_ok=True)

settings = Settings.load()

# Step A: Test Native Extraction on All 4 PDF Fixtures
print("=== 1. Testing Native Extraction and Layout Detection ===")
extraction_results = {}
for pdf_file in sorted(fixtures_dir.glob("*.pdf")):
    name = pdf_file.stem
    print(f"\nProcessing {name}...")
    pages, render_pdf = extract_pdf(pdf_file, settings)
    text = "\n\n".join(p.text for p in pages)
    temp_dir = out_dir / f"temp_{name}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    design, page_images = analyse_pdf_pages(render_pdf, temp_dir, settings.render_dpi)
    signals = document_signals(pages, image_only=False, design=design, gemini_visual={})
    
    res = {
        "pageCount": len(pages),
        "charCount": len(text),
        "multiColumn": signals.get("multiColumn"),
        "excessiveWhitespace": signals.get("excessiveWhitespace"),
        "inconsistentMargins": signals.get("inconsistentMargins"),
        "excessiveColor": signals.get("excessiveColor"),
        "fontCount": signals.get("fontCount"),
        "sampleText": text[:300]
    }
    extraction_results[name] = res
    print(f"  Pages: {len(pages)}, Characters: {len(text)}, multiColumn: {res['multiColumn']}, excessiveWhitespace: {res['excessiveWhitespace']}")

(out_dir / "extraction_results.json").write_text(json.dumps(extraction_results, indent=2))

# Step B: Node-based Domain Assessment Verification
print("\n=== 2. Running Node-Based Domain & Scoring Verification ===")
node_audit_script = root / "scripts/phase4b-node-audit.mjs"
node_script_content = """import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeResume } from "@successpro/domain";
import { 
  buildWorkbookReview, 
  projectWorkbookReview 
} from "../apps/web/src/lib/successpro-v2-review.js";
import { 
  validateEmploymentDates, 
  validateSourceEvidence, 
  severityForRating 
} from "@successpro/domain/src/successpro-v2/index.js";
import { renderReviewReport } from "../apps/web/src/lib/review-report-renderer.jsx";

const fixturesDir = resolve(".local/phase4b/fixtures");
const outDir = resolve(".local/phase4b/audit_results");

const jdText = readFileSync(resolve(fixturesDir, "target_job_description.txt"), "utf8");

const cases = [
  { name: "poor_singlecol_nodates_nocontact", withJd: false },
  { name: "average_twocol_multipage_overlaps", withJd: true },
  { name: "strong_singlecol_twopage_metrics", withJd: true },
  { name: "edge_unsupported_metrics_reversed_dates", withJd: false }
];

const results = {};

for (const c of cases) {
  const txtPath = resolve(fixturesDir, `${c.name}.pdf`);
  // read text from python extraction
  const extractions = JSON.parse(readFileSync(resolve(outDir, "extraction_results.json"), "utf8"));
  // Let's analyze
  console.log(`Auditing ${c.name} (withJd: ${c.withJd})...`);
}
"""

print("[OK] Extraction phase completed successfully.")
