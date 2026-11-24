from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float


class TextSpan(BaseModel):
    text: str
    page: int
    bbox: BoundingBox | None = None
    font_name: str | None = None
    font_size: float | None = None
    color: int | str | None = None
    bold: bool = False
    italic: bool = False
    underline: bool = False
    alignment: str | None = None
    style_name: str | None = None


class PageExtraction(BaseModel):
    page: int
    width: float
    height: float
    text: str
    original_text: str = ""
    reading_order: dict[str, Any] = Field(default_factory=dict)
    words: list[dict[str, Any]] = Field(default_factory=list)
    blocks: list[dict[str, Any]] = Field(default_factory=list)
    spans: list[TextSpan] = Field(default_factory=list)
    meaningful_characters: int = 0
    warnings: list[str] = Field(default_factory=list)


class DesignMetrics(BaseModel):
    page: int
    margin_left_ratio: float
    margin_right_ratio: float
    margin_top_ratio: float
    margin_bottom_ratio: float
    whitespace_ratio: float
    content_density: float
    column_count: int
    alignment_variance: float
    indentation_variance: float
    component_overlap_ratio: float
    visual_balance: float
    contrast_ratio: float
    spacing_variance: float
    warnings: list[str] = Field(default_factory=list)


class VisualCriterion(BaseModel):
    code: Literal["V01", "V02", "V03", "V04", "V05", "V06"]
    rating: int = Field(ge=0, le=5, strict=True)
    confidence: float = Field(ge=0, le=1)
    pages: list[int] = Field(default_factory=list)
    evidence: str = Field(min_length=1, max_length=500)
    recommendation: str = Field(min_length=1, max_length=500)
    anchorText: str = ""
    anchorJustification: str = ""
    nextAnchorGap: str = ""


class VisualPageFinding(BaseModel):
    page: int = Field(ge=1)
    score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    observations: list[str] = Field(default_factory=list, max_length=8)
    warnings: list[str] = Field(default_factory=list, max_length=8)


class VisualDesignAssessment(BaseModel):
    critique: str = Field(min_length=1, max_length=800)
    criteria: list[VisualCriterion] = Field(min_length=6, max_length=6)
    pages: list[VisualPageFinding]


class EvidenceValue(BaseModel):
    value: str
    pages: list[int]
    evidence: list[str]


class ExtractedProfile(BaseModel):
    name: EvidenceValue | None = None
    professional_title: EvidenceValue | None = None
    warnings: list[str] = Field(default_factory=list)
    emails: list[EvidenceValue] = Field(default_factory=list)
    phones: list[EvidenceValue] = Field(default_factory=list)
    urls: list[EvidenceValue] = Field(default_factory=list)
    dates: list[EvidenceValue] = Field(default_factory=list)
    headings: list[EvidenceValue] = Field(default_factory=list)
    sections: list[dict[str, Any]] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    schema_version: int = 1
    kind: Literal["pdf", "docx"]
    page_count: int
    text: str
    pages: list[PageExtraction]
    design: list[DesignMetrics]
    profile: ExtractedProfile
    insufficient_text_pages: list[int]
    warnings: list[str] = Field(default_factory=list)
    signals: dict[str, Any] = Field(default_factory=dict)
    runtime: dict[str, Any] = Field(default_factory=dict)
    provider_metadata: dict[str, Any] = Field(default_factory=dict)


class AnalysisResult(BaseModel):
    schema_version: int = 1
    provider: str
    profile: dict[str, Any]
    evidence: dict[str, list[int]]
    warnings: list[str] = Field(default_factory=list)
    chunks_completed: list[int] = Field(default_factory=list)

