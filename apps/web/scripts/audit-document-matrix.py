#!/usr/bin/env python3
"""Audit every PDF in the release document matrix."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
MATRIX_ROOT = WORKSPACE_ROOT / "tmp" / "pdfs" / "release-matrix"
PAGE_SIZES = {"a4": (595.28, 841.89), "letter": (612.0, 792.0)}


def embedded_font_findings(reader: PdfReader) -> list[str]:
    findings: list[str] = []
    seen = 0
    for page in reader.pages:
        resources = page.get("/Resources") or {}
        for name, reference in (resources.get("/Font") or {}).items():
            seen += 1
            font = reference.get_object()
            descriptor = font.get("/FontDescriptor")
            if descriptor is None:
                descendants = font.get("/DescendantFonts") or []
                if descendants:
                    descriptor = descendants[0].get_object().get("/FontDescriptor")
            descriptor = descriptor.get_object() if descriptor else None
            if not descriptor or not any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")):
                findings.append(f"font resource {name} is not embedded")
    if not seen:
        findings.append("no font resources detected")
    return sorted(set(findings))


def image_count(reader: PdfReader) -> int:
    total = 0
    for page in reader.pages:
        resources = page.get("/Resources") or {}
        for reference in (resources.get("/XObject") or {}).values():
            if reference.get_object().get("/Subtype") == "/Image":
                total += 1
    return total


def audit(entry: dict[str, object]) -> dict[str, object]:
    path = MATRIX_ROOT / str(entry["file"])
    findings: list[str] = []
    if not path.exists():
        return {"file": path.name, "passed": False, "findings": ["file missing"]}

    reader = PdfReader(str(path))
    findings.extend(embedded_font_findings(reader))
    images = image_count(reader)
    if bool(entry["photoExpected"]) and images == 0:
        findings.append("expected portrait image is missing")
    if not bool(entry["photoExpected"]) and images:
        findings.append("unexpected image detected")

    page_expectation = entry["expectedPages"]
    assert isinstance(page_expectation, dict)
    if not int(page_expectation["minimum"]) <= len(reader.pages) <= int(page_expectation["maximum"]):
        findings.append(f"page count {len(reader.pages)} outside expected range")

    expected_width, expected_height = PAGE_SIZES[str(entry["pageSize"])]
    with pdfplumber.open(str(path)) as pdf:
        all_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        if str(entry["fullName"]) not in all_text:
            findings.append("candidate name is missing")
        for expected_text in entry.get("expectedTexts", []):
            if str(expected_text) not in all_text:
                findings.append(f"expected resume content is missing: {expected_text}")
        if "\ufffd" in all_text or "□" in all_text:
            findings.append("missing or substituted glyph detected")

        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            section_headings = {"PROFESSIONAL PROFILE", "PROFESSIONAL SUMMARY", "CORE SKILLS", "PROFESSIONAL EXPERIENCE", "SELECTED PROJECTS", "EDUCATION", "CERTIFICATIONS", "AWARDS & ACHIEVEMENTS", "LANGUAGES", "PROFESSIONAL LINKS", "PUBLICATIONS", "VOLUNTEER EXPERIENCE"}
            visible_lines = [line.strip() for line in text.splitlines() if line.strip()]
            if str(entry["kind"]) == "resume" and visible_lines and visible_lines[-1].upper() in section_headings:
                findings.append(f"page {page_number} ends with an orphaned section heading: {visible_lines[-1]}")
            body = "\n".join(line for line in text.splitlines() if " | " not in line).strip()
            if len(body) < 80:
                findings.append(f"page {page_number} is blank or nearly blank")
            if abs(float(page.width) - expected_width) > 0.5 or abs(float(page.height) - expected_height) > 0.5:
                findings.append(f"page {page_number} has the wrong paper dimensions")
            for char in page.chars:
                if float(char["x0"]) < 0 or float(char["x1"]) > float(page.width) or float(char["top"]) < 0 or float(char["bottom"]) > float(page.height):
                    findings.append(f"page {page_number} has out-of-bounds text")
                    break

        sizes = {round(float(char.get("size", 0)), 1) for page in pdf.pages for char in page.chars if char.get("text", "").strip()}
        if not any(8.0 <= size <= 9.0 for size in sizes):
            findings.append(f"no 8–9 pt content text detected; sizes were {sorted(sizes)}")
        if round(float(entry["namePt"]), 1) not in sizes:
            findings.append(f"expected {entry['namePt']} pt name size not detected")
        if str(entry["kind"]) == "resume" and round(float(entry["sectionHeadingPt"]), 1) not in sizes:
            findings.append(f"expected {entry['sectionHeadingPt']} pt section heading size not detected")

    return {"file": path.name, "pages": len(reader.pages), "images": images, "passed": not findings, "findings": findings}


def main() -> None:
    manifest = json.loads((MATRIX_ROOT / "matrix-manifest.json").read_text())
    reports = [audit(entry) for entry in manifest]
    output = {"files": len(reports), "passed": sum(bool(item["passed"]) for item in reports), "reports": reports}
    (MATRIX_ROOT / "audit-report.json").write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"files": output["files"], "passed": output["passed"], "failed": len(reports) - int(output["passed"])}, indent=2))
    if not all(bool(report["passed"]) for report in reports):
        for report in reports:
            if not report["passed"]:
                print(f"{report['file']}: {', '.join(report['findings'])}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
