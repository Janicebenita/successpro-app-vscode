#!/usr/bin/env python3
"""Fail-fast preflight for SuccessPro resume and cover-letter golden PDFs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
PDF_ROOT = WORKSPACE_ROOT / "output" / "pdf"
TEMPLATES = {
    "clarity": {"name": 14.0, "heading": 9.5, "photo": False},
    "signature": {"name": 14.0, "heading": 9.7, "photo": True},
    "momentum": {"name": 13.5, "heading": 9.5, "photo": True},
    "editorial": {"name": 13.5, "heading": 9.5, "photo": False},
}


def round_sizes(chars):
    return sorted({round(float(char.get("size", 0)), 1) for char in chars if char.get("text", "").strip()})


def text_font_sizes(page, target):
    words = page.extract_words(extra_attrs=["size"], keep_blank_chars=False)
    target_words = target.split()
    for index in range(len(words) - len(target_words) + 1):
        if [word["text"] for word in words[index : index + len(target_words)]] == target_words:
            return sorted({round(float(word["size"]), 1) for word in words[index : index + len(target_words)]})
    return []


def internal_vertical_gap(page):
    # A fixed page footer is not part of the flowing letter/resume content.
    words = [word for word in page.extract_words() if float(word["top"]) < float(page.height) - 30]
    if not words:
        return 1.0
    lines = []
    for word in words:
        top, bottom = float(word["top"]), float(word["bottom"])
        if not lines or top - lines[-1][1] > 2.0:
            lines.append([top, bottom])
        else:
            lines[-1][1] = max(lines[-1][1], bottom)
    gaps = [max(0.0, lines[index + 1][0] - lines[index][1]) for index in range(len(lines) - 1)]
    return round((max(gaps) if gaps else 0.0) / float(page.height), 4)


def embedded_fonts(reader):
    font_count = 0
    unembedded = []
    for page in reader.pages:
        resources = page.get("/Resources") or {}
        fonts = resources.get("/Font") or {}
        for name, reference in fonts.items():
            font_count += 1
            font = reference.get_object()
            descriptor = font.get("/FontDescriptor")
            if descriptor is None:
                descendants = font.get("/DescendantFonts") or []
                if descendants:
                    descriptor = descendants[0].get_object().get("/FontDescriptor")
            descriptor = descriptor.get_object() if descriptor else None
            if not descriptor or not any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")):
                unembedded.append(str(name))
    return font_count, sorted(set(unembedded))


def image_count(reader):
    total = 0
    for page in reader.pages:
        resources = page.get("/Resources") or {}
        objects = resources.get("/XObject") or {}
        for reference in objects.values():
            if reference.get_object().get("/Subtype") == "/Image":
                total += 1
    return total


def audit(pdf_path, template_id, document_kind):
    expected = TEMPLATES[template_id]
    findings = []
    reader = PdfReader(str(pdf_path))
    font_count, unembedded = embedded_fonts(reader)
    images = image_count(reader)
    metadata = " ".join(str(value) for value in (reader.metadata or {}).values()).lower()
    if unembedded or font_count == 0:
        findings.append(f"fonts not embedded: {', '.join(unembedded) or 'none detected'}")
    if any(term in metadata for term in ("rubric", "prompt", "model", "internal")):
        findings.append("internal processing metadata exposed")
    if expected["photo"] and images < 1:
        findings.append("optional-photo fixture did not embed its portrait")
    if not expected["photo"] and template_id == "clarity" and images:
        findings.append("ATS-first Clarity fixture unexpectedly contains an image")

    with pdfplumber.open(str(pdf_path)) as pdf:
        if not pdf.pages:
            findings.append("PDF has no pages")
        if document_kind == "cover-letter" and len(pdf.pages) != 1:
            findings.append("cover letter is not exactly one page")
        all_text = "\n".join((page.extract_text() or "") for page in pdf.pages)
        required = ["Aarav Mehta", "Vice President, Product"] if document_kind == "cover-letter" else ["Aarav Mehta", "PROFESSIONAL EXPERIENCE", "EDUCATION"]
        for value in required:
            if value not in all_text:
                findings.append(f"required text missing: {value}")
        if "\ufffd" in all_text or "□" in all_text:
            findings.append("missing or substituted glyph detected")

        name_sizes = text_font_sizes(pdf.pages[0], "Aarav Mehta")
        # Catch inherited line-height regressions even when all text is present.
        words = pdf.pages[0].extract_words()
        name_words = [word for word in words if word["text"] in ("Aarav", "Mehta") and float(word["top"]) < 60]
        headline_words = [word for word in words if word["text"] == "Product" and float(word["top"]) < 70]
        if name_words and headline_words and min(float(word["top"]) for word in headline_words) <= max(float(word["bottom"]) for word in name_words):
            findings.append("name and headline overlap")
        if expected["name"] not in name_sizes:
            findings.append(f"name font is {name_sizes}, expected {expected['name']} pt")
        if document_kind == "resume":
            heading_sizes = text_font_sizes(pdf.pages[0], "PROFESSIONAL EXPERIENCE")
            if expected["heading"] not in heading_sizes:
                findings.append(f"section heading font is {heading_sizes}, expected {expected['heading']} pt")

        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if len(text.strip()) < 40:
                findings.append(f"page {page_number} is blank or nearly blank")
            if abs(float(page.width) - 595.28) > 0.5 or abs(float(page.height) - 841.89) > 0.5:
                findings.append(f"page {page_number} is not A4")
            for char in page.chars:
                if float(char["x0"]) < 0 or float(char["x1"]) > float(page.width) or float(char["top"]) < 0 or float(char["bottom"]) > float(page.height):
                    findings.append(f"page {page_number} has out-of-bounds text")
                    break
            gap = internal_vertical_gap(page)
            if gap > 0.18:
                findings.append(f"page {page_number} has an unexplained internal vertical gap of {gap:.1%}")

        sizes = round_sizes([char for page in pdf.pages for char in page.chars])
        if 8.0 not in sizes:
            findings.append(f"8 pt body text not detected; sizes were {sizes}")

    return {
        "file": pdf_path.name,
        "pages": len(reader.pages),
        "fontResources": font_count,
        "images": images,
        "passed": not findings,
        "findings": findings,
    }


def main():
    reports = []
    for template_id in TEMPLATES:
        for kind in ("resume", "cover-letter"):
            pdf_path = PDF_ROOT / f"successpro-{template_id}-{kind}.pdf"
            if not pdf_path.exists():
                reports.append({"file": pdf_path.name, "passed": False, "findings": ["file missing"]})
                continue
            reports.append(audit(pdf_path, template_id, kind))
    print(json.dumps(reports, indent=2))
    if not all(report["passed"] for report in reports):
        sys.exit(1)


if __name__ == "__main__":
    main()
