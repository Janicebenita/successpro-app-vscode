from __future__ import annotations

import html
import logging
import re
import shutil
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

LOGGER = logging.getLogger("resume-native")

import fitz
import phonenumbers
from dateutil import parser as date_parser
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

from .config import REJECTION_MESSAGE, Settings
from .models import BoundingBox, EvidenceValue, ExtractedProfile, PageExtraction, TextSpan

EMAIL = re.compile(r"(?<![\w.+-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![\w.-])", re.I)
URL = re.compile(r"\b(?:https?://|www\.)[^\s<>]+", re.I)
DATE = re.compile(r"\b(?:(?:19|20)\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ .,-]+(?:19|20)?\d{2}|\d{1,2}[/-]\d{1,2}[/-](?:19|20)?\d{2})\b", re.I)
HEADING_WORDS = {"summary", "profile", "experience", "education", "skills", "projects", "certifications", "awards", "languages", "interests", "publications"}


class NativeTextError(ValueError):
    pass


def meaningful(value: str) -> str:
    return "".join(character for character in value if character.isalnum())


def extract_column_aware_text(page: fitz.Page) -> str:
    units=[]
    for block in page.get_text("dict").get("blocks",[]):
        if block.get("type")!=0:continue
        for line in block.get("lines",[]):
            spans=line.get("spans",[])
            if not spans:continue
            # Split lines that the PDF engine combined across a wide gutter.
            groups=[];current=[]
            for span in spans:
                if current and span["bbox"][0]-current[-1]["bbox"][2]>page.rect.width*0.045:
                    groups.append(current);current=[]
                current.append(span)
            if current:groups.append(current)
            for group in groups:
                parts=[]
                for index,span in enumerate(group):
                    value=span.get("text","")
                    if index and parts and value and not parts[-1].endswith(" ") and not value.startswith(" "):
                        previous=group[index-1]
                        gap=span["bbox"][0]-previous["bbox"][2]
                        protected=bool(re.search(r"@|https?://|www\.",parts[-1]+value,re.I))
                        if gap>max(1,float(span.get("size",10))*.15) and not protected:parts.append(" ")
                    parts.append(value)
                text="".join(parts).strip()
                if text:units.append((min(t["bbox"][0] for t in group),min(t["bbox"][1] for t in group),max(t["bbox"][2] for t in group),max(t["bbox"][3] for t in group),text,max(float(t.get("size",0)) for t in group)))
    if not units:return ""
    candidates=[];width=page.rect.width
    for cut in range(int(width*.20),int(width*.80),2):
        left=[u for u in units if u[2]<=cut];right=[u for u in units if u[0]>=cut];cross=[u for u in units if u[0]<cut<u[2]]
        if len(left)<4 or len(right)<4:continue
        overlap=min(max(u[3] for u in left),max(u[3] for u in right))-max(min(u[1] for u in left),min(u[1] for u in right))
        if overlap<page.rect.height*.2:continue
        gutter=min(u[0] for u in right)-max(u[2] for u in left)
        candidates.append((len(cross),-gutter,cut,left,right,cross))
    page._successpro_reading_order_ambiguous = False
    page._successpro_reading_order = {"method":"row_order","column_count":1,"visual_verification_required":False}
    for cross_count,_,cut,left,right,cross in sorted(candidates,key=lambda c:(c[0],c[1])):
        if cross_count<=max(3,len(units)*.08):
            top=min(min(u[1] for u in left),min(u[1] for u in right))
            headers=[u for u in cross if u[3]<=top+18]
            rest=[u for u in cross if u not in headers]
            section = re.compile(r"^(?:profile|summary|professional experience|experience|education|skills|contact|projects)$",re.I)
            section_tops=[u[1] for u in left+right if section.fullmatch(u[4].strip())]
            header_end=min(section_tops) if section_tops else top
            # Isolate visible identity/title above body sections, even when inside the main column.
            extra=[u for u in left+right if u[3]<header_end and u[1]<page.rect.height*.25]
            headers+=extra
            left=[u for u in left if u not in extra];right=[u for u in right if u not in extra]
            headers=sorted(headers,key=lambda u:(u[1],u[0]))
            name_candidates=[u for u in headers if 2<=len(u[4].split())<=5 and not re.search(r"@|https?://|\d",u[4]) and not section.fullmatch(u[4])]
            if name_candidates:
                name=max(name_candidates,key=lambda u:u[5])
                headers=[name]+[u for u in headers if u!=name]
            main_pattern=re.compile(r"^(?:profile|summary|professional experience|experience|work experience)$",re.I)
            main_right=sum(bool(main_pattern.fullmatch(u[4].strip())) for u in right)>sum(bool(main_pattern.fullmatch(u[4].strip())) for u in left)
            def columns(region):
                a=sorted([u for u in region if u[2]<=cut],key=lambda u:(u[1],u[0]))
                b=sorted([u for u in region if u[0]>=cut],key=lambda u:(u[1],u[0]))
                return b+a if main_right else a+b
            if all(u[2]-u[0]>width*.55 for u in rest):
                order=list(headers);remaining=left+right
                for separator in sorted(rest,key=lambda u:(u[1],u[0])):
                    before=[u for u in remaining if u[1]<separator[1]-2]
                    order+=columns(before)+[separator]
                    remaining=[u for u in remaining if u not in before]
                order+=columns(remaining)
                page._successpro_reading_order={"method":"header_then_column_bands","column_count":2,"main_column":"right" if main_right else "left","gutter_x":cut,"visual_verification_required":True}
                return "\n".join(u[4] for u in order)
    if candidates and min(c[0] for c in candidates)<=max(3,len(units)*.08):page._successpro_reading_order_ambiguous=True
    return "\n".join(u[4] for u in sorted(units,key=lambda u:(round(u[1]/3),u[0])))


def _safe_page_text(page: fitz.Page) -> PageExtraction:
    raw = page.get_text("dict", sort=True)
    spans: list[TextSpan] = []
    block_output: list[dict[str, Any]] = []
    for block_index, block in enumerate(raw.get("blocks", [])):
        if block.get("type") != 0:
            continue
        block_text: list[str] = []
        block_box = block.get("bbox")
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = str(span.get("text", ""))
                if not text:
                    continue
                flags = int(span.get("flags", 0))
                box = span.get("bbox")
                spans.append(TextSpan(
                    text=text,
                    page=page.number + 1,
                    bbox=BoundingBox(x0=box[0], y0=box[1], x1=box[2], y1=box[3]) if box else None,
                    font_name=span.get("font"),
                    font_size=round(float(span.get("size", 0)), 2),
                    color=int(span.get("color", 0)),
                    bold=bool(flags & 16) or "bold" in str(span.get("font", "")).lower(),
                    italic=bool(flags & 2) or "italic" in str(span.get("font", "")).lower(),
                ))
                block_text.append(text)
        if block_text:
            block_output.append({"index": block_index, "bbox": list(block_box) if block_box else None, "text": " ".join(block_text)})
    words = [{"text": word[4], "bbox": [word[0], word[1], word[2], word[3]], "block": word[5], "line": word[6], "word": word[7]} for word in page.get_text("words", sort=True)]
    text = extract_column_aware_text(page)
    rectangle = page.rect
    warnings=["reading_order_ambiguous"] if getattr(page,"_successpro_reading_order_ambiguous",False) else []
    order=getattr(page,"_successpro_reading_order",{})
    if order.get("visual_verification_required"):warnings.append("column_order_requires_visual_verification")
    if re.search(r"\b[A-Z][a-z]{2,}[A-Z][a-z]{2,}\b",text[:300]):warnings.append("possible_concatenated_name_or_spacing")
    lines_on_page = [
        (''.join(s.get('text', '') for s in l.get('spans', [])).strip(), l['bbox'])
        for b in raw.get('blocks', []) if b.get('type') == 0
        for l in b.get('lines', [])
        if ''.join(s.get('text', '') for s in l.get('spans', [])).strip()
    ]
    for i in range(len(lines_on_page)):
        for j in range(i + 1, len(lines_on_page)):
            la, lb = lines_on_page[i], lines_on_page[j]
            if min(la[1][2], lb[1][2]) - max(la[1][0], lb[1][0]) > 30:
                if la[1][1] <= lb[1][1]:
                    v_overlap = la[1][3] - lb[1][1]
                    if v_overlap > 2.0:
                        warnings.append("text_collision_detected")
                        warnings.append(f"text_collision: '{la[0][:25]}' overlaps '{lb[0][:25]}' by {round(v_overlap, 1)}pt")
                        break
                elif lb[1][3] - la[1][1] > 2.0:
                    v_overlap = lb[1][3] - la[1][1]
                    warnings.append("text_collision_detected")
                    warnings.append(f"text_collision: '{lb[0][:25]}' overlaps '{la[0][:25]}' by {round(v_overlap, 1)}pt")
                    break
        if "text_collision_detected" in warnings:
            break
    return PageExtraction(page=page.number + 1, width=rectangle.width, height=rectangle.height, text=text, original_text=page.get_text("text",sort=False), reading_order=order, words=words, blocks=block_output, spans=spans, meaningful_characters=len(meaningful(text)), warnings=warnings)


def extract_pdf(path: Path, settings: Settings) -> tuple[list[PageExtraction], Path]:
    try:
        document = fitz.open(path)
    except Exception as error:
        raise NativeTextError(REJECTION_MESSAGE) from error
    try:
        if document.needs_pass:
            raise NativeTextError(REJECTION_MESSAGE)
        if document.page_count < 1 or document.page_count > settings.maximum_pages:
            raise NativeTextError(f"Please upload a resume with {settings.maximum_pages} pages or fewer.")
        pages = [_safe_page_text(page) for page in document]
        return pages, path
    finally:
        document.close()


def _alignment(value: Any) -> str | None:
    return {WD_ALIGN_PARAGRAPH.LEFT: "left", WD_ALIGN_PARAGRAPH.CENTER: "center", WD_ALIGN_PARAGRAPH.RIGHT: "right", WD_ALIGN_PARAGRAPH.JUSTIFY: "justify"}.get(value)


def _run_value(run: Any, attr: str, style: Any) -> Any:
    direct = getattr(run.font, attr)
    if direct is not None:
        return direct
    return getattr(getattr(style, "font", None), attr, None)


def convert_docx_to_pdf(path: Path, output_directory: Path, settings: Settings) -> Path:
    executable = shutil.which(settings.libreoffice_binary)
    if not executable:
        raise RuntimeError("LibreOffice is required locally to validate DOCX page count and visual layout.")
    profile = output_directory / "libreoffice-profile"
    profile.mkdir(exist_ok=True)
    
    # Normalize empty paragraphs and trailing whitespace to prevent LibreOffice headless line-height ballooning
    target_path = path
    try:
        from docx.shared import Pt
        doc = Document(path)
        modified = False
        for p in doc.paragraphs:
            if not p.text.strip():
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = Pt(3)
                for r in p.runs:
                    r.font.size = Pt(3)
                modified = True
        if modified:
            normalized_path = output_directory / f"normalized_{path.name}"
            doc.save(normalized_path)
            target_path = normalized_path
    except Exception:
        target_path = path

    result = subprocess.run([executable, f"-env:UserInstallation={profile.as_uri()}", "--headless", "--convert-to", "pdf", "--outdir", str(output_directory), str(target_path)], capture_output=True, text=True, timeout=120, check=False)
    converted = output_directory / f"{target_path.stem}.pdf"
    if result.returncode != 0 or not converted.exists():
        raise NativeTextError(REJECTION_MESSAGE)
    return converted


def extract_docx(path: Path, temp_directory: Path, settings: Settings) -> tuple[list[PageExtraction], Path]:
    try:
        document = Document(path)
    except Exception as error:
        raise NativeTextError(REJECTION_MESSAGE) from error
    logical_spans: list[TextSpan] = []
    logical_text: list[str] = []
    for paragraph in document.paragraphs:
        paragraph_text = paragraph.text.strip()
        if paragraph_text:
            logical_text.append(paragraph_text)
        paragraph_style = paragraph.style
        for run in paragraph.runs:
            if not run.text:
                continue
            color = _run_value(run, "color", paragraph_style)
            rgb = getattr(color, "rgb", None) if color else None
            size = _run_value(run, "size", paragraph_style)
            logical_spans.append(TextSpan(text=run.text, page=0, font_name=_run_value(run, "name", paragraph_style), font_size=round(float(size.pt), 2) if size else None, color=str(rgb) if rgb else None, bold=bool(_run_value(run, "bold", paragraph_style)), italic=bool(_run_value(run, "italic", paragraph_style)), underline=bool(_run_value(run, "underline", paragraph_style)), alignment=_alignment(paragraph.alignment), style_name=paragraph_style.name if paragraph_style else None))
    for table in document.tables:
        for row in table.rows:
            logical_text.append(" | ".join(cell.text.strip() for cell in row.cells if cell.text.strip()))
    native_text = "\n".join(logical_text)
    if len(meaningful(native_text)) < 80:
        raise NativeTextError(REJECTION_MESSAGE)
    try:
        converted = convert_docx_to_pdf(path, temp_directory, settings)
        visual_pages, _ = extract_pdf(converted, settings)
        if visual_pages:
            visual_pages[0].spans.extend(logical_spans)
        return visual_pages, converted
    except Exception as error:
        LOGGER.warning("DOCX LibreOffice PDF conversion unavailable: %s. Using logical text fallback.", error)
        synthetic_page = PageExtraction(
            page=1,
            width=612.0,
            height=792.0,
            text=native_text,
            original_text=native_text,
            reading_order={"method": "logical_doc_order", "column_count": 1, "visual_verification_required": False},
            words=[{"text": w, "bbox": [0, 0, 0, 0], "block": 0, "line": 0, "word": idx} for idx, w in enumerate(native_text.split())],
            blocks=[{"index": 0, "bbox": [0, 0, 612, 792], "text": native_text}],
            spans=logical_spans,
            meaningful_characters=len(meaningful(native_text)),
            warnings=[],
        )
        return [synthetic_page], path


def is_image_only(pages: list[PageExtraction]) -> bool:
    combined = "\n".join(page.text for page in pages)
    words = re.findall(r"\b[\w'-]+\b", combined, re.UNICODE)
    return len(meaningful(combined)) < 60 or len(words) < 15


def validate_native_text(pages: list[PageExtraction]) -> list[int]:
    insufficient = [page.page for page in pages if page.meaningful_characters < 20]
    return insufficient


def _evidence(value: str, page: PageExtraction) -> EvidenceValue:
    return EvidenceValue(value=value, pages=[page.page], evidence=[value])


def identify_profile(pages: list[PageExtraction]) -> ExtractedProfile:
    emails: dict[str, EvidenceValue] = {}
    phones: dict[str, EvidenceValue] = {}
    urls: dict[str, EvidenceValue] = {}
    dates: dict[str, EvidenceValue] = {}
    headings: dict[str, EvidenceValue] = {}
    name: EvidenceValue | None = None
    professional_title: EvidenceValue | None = None
    profile_warnings: list[str] = []
    for page in pages:
        lines = [line.strip() for line in page.text.splitlines() if line.strip()]
        if page.page == 1 and lines:
            candidate = lines[0]
            if 1 < len(candidate.split()) <= 6 and not EMAIL.search(candidate) and len(candidate) < 100 and not re.search(r"\d|https?://|\b(?:experience|education|skills|summary|profile|contact)\b",candidate,re.I):
                name = _evidence(candidate, page)
                for title in lines[1:4]:
                    if re.search(r"@|https?://|\d",title) or title.lower() in HEADING_WORDS:break
                    if len(title)<100 and re.search(r"\b(?:engineer|analyst|manager|designer|developer|consultant|director|accountant|teacher|nurse|technician|specialist|officer|scientist|architect|coordinator|executive|administrator)\b",title,re.I):
                        professional_title=_evidence(title,page);break
            if "possible_concatenated_name_or_spacing" in page.warnings:profile_warnings.append("Possible concatenated name or malformed spacing; confirm against original page. No name was invented.")
        for match in EMAIL.finditer(page.text): emails.setdefault(match.group(0).lower(), _evidence(match.group(0), page))
        for match in URL.finditer(page.text): urls.setdefault(match.group(0).rstrip(".,);"), _evidence(match.group(0).rstrip(".,);"), page))
        for candidate in phonenumbers.PhoneNumberMatcher(page.text, None):
            if phonenumbers.is_possible_number(candidate.number):
                normalized = phonenumbers.format_number(candidate.number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
                phones.setdefault(normalized, _evidence(candidate.raw_string, page))
        for match in DATE.finditer(page.text):
            candidate = match.group(0)
            try: date_parser.parse(candidate, fuzzy=False, default=date_parser.parse("2000-01-01"))
            except (ValueError, OverflowError): continue
            dates.setdefault(candidate.lower(), _evidence(candidate, page))
        for line in lines:
            normalized = re.sub(r"[^a-z ]", "", line.lower()).strip()
            if normalized in HEADING_WORDS or (len(line) < 60 and line.isupper() and 1 <= len(line.split()) <= 6):
                headings.setdefault(normalized, _evidence(line, page))
    sections = [{"heading": item.value, "page": item.pages[0]} for item in headings.values()]
    return ExtractedProfile(name=name, professional_title=professional_title,warnings=profile_warnings, emails=list(emails.values()), phones=list(phones.values()), urls=list(urls.values()), dates=list(dates.values()), headings=list(headings.values()), sections=sections)


def document_signals(pages: list[PageExtraction], image_only: bool = False, design: list[Any] | None = None, gemini_visual: dict[str, Any] | None = None) -> dict[str, Any]:
    font_sizes = [span.font_size for page in pages for span in page.spans if span.font_size]
    fonts = Counter(span.font_name for page in pages for span in page.spans if span.font_name)
    all_warnings = [w for metric in (design or []) for w in getattr(metric, "warnings", [])] + [w for page in pages for w in page.warnings]
    left_margins = [float(getattr(metric, "margin_left_ratio", 0)) for metric in (design or [])]
    right_margins = [float(getattr(metric, "margin_right_ratio", 0)) for metric in (design or [])]
    inconsistent_margins = (
        (max(left_margins) - min(left_margins) > 0.05)
        or (max(right_margins) - min(right_margins) > 0.05)
    ) if left_margins and right_margins else False
    if inconsistent_margins: all_warnings.append("inconsistent_margins")
    max_cols = max([getattr(m, "column_count", 1) for m in (design or [])], default=1)
    blank_pages = {metric.page for metric in (design or []) if "blank_rendered_page" in metric.warnings}
    signals: dict[str, Any] = {
        "extractionReliable": bool(pages) and all(page.page in blank_pages or (page.text.strip() and "[Vision OCR error:" not in page.text and "[Scanned / Image Resume]" not in page.text) for page in pages),
        "imageOnly": image_only,
        "pageCount": len(pages),
        "fontCount": len(fonts),
        **({"minimumFontSize": min(font_sizes)} if font_sizes else {}),
        "hasVisualEvidence": bool(pages and design and len(design) == len(pages)),
        "multiColumn": max_cols > 1 or "complex_columns" in all_warnings or any(p.reading_order.get("column_count",1)>1 for p in pages),
        "tableHeavy": "table_heavy" in all_warnings,
        "crowdedLayout": "crowded_layout" in all_warnings,
        "excessiveWhitespace": "excessive_whitespace" in all_warnings,
        "inconsistentMargins": inconsistent_margins or "wide_side_margin" in all_warnings,
        "excessiveColor": "low_colour_contrast" in all_warnings,
        "smallText": any(fs < 9.0 for fs in font_sizes) if font_sizes else False,
        "textCollision": "text_collision_detected" in all_warnings,
        "designWarnings": all_warnings + (gemini_visual.get("warnings", []) if gemini_visual else []),
    }
    if gemini_visual:
        if isinstance(gemini_visual.get("score"), (int, float)):
            signals["geminiVisualScore"] = int(gemini_visual["score"])
        signals["geminiVisualCritique"] = str(gemini_visual.get("critique") or "")
        signals["geminiPageFindings"] = gemini_visual.get("pages") or []
        signals["geminiVisualConfidence"] = gemini_visual.get("confidence")
        signals["geminiVisualCriteria"] = gemini_visual.get("criteria") or []
    return signals

