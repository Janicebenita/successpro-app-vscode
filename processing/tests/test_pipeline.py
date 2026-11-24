from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from dataclasses import replace
from unittest.mock import Mock, patch

import fitz
import numpy as np

from resume_worker.ai import chunks, evaluate_visual_design_gemini, evaluate_visual_design_with_fallback, merge_analysis, validate_analysis
from resume_worker.config import Settings
from resume_worker.extraction import document_signals, extract_pdf, identify_profile, validate_native_text
from resume_worker.models import DesignMetrics, PageExtraction
from resume_worker.visual import _metrics, analyse_pdf_pages
from resume_worker.worker import cleanup_abandoned


class PipelineTests(unittest.TestCase):
    def test_two_page_pdf_extracts_fonts_boxes_and_contacts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "resume.pdf"
            document = fitz.open()
            text = "Jane Example jane@example.com +1 202 555 0147 https://example.com EXPERIENCE 2020 " * 4
            for _ in range(2):
                page = document.new_page(); page.insert_text((72, 72), text, fontname="helv", fontsize=11)
            document.save(path); document.close()
            pages, _ = extract_pdf(path, Settings.load())
            self.assertEqual(len(pages), 2); self.assertTrue(pages[0].spans[0].bbox); self.assertEqual(validate_native_text(pages), [])
            profile = identify_profile(pages); self.assertTrue(profile.emails); self.assertTrue(profile.urls)

    def test_blank_trailing_page_is_preserved_for_v05_without_discarding_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "blank-trailing-page.pdf"
            with fitz.open() as document:
                page = document.new_page()
                page.insert_text((72, 72), "Candidate resume with a readable work history and supporting skills.", fontsize=11)
                document.new_page()
                document.save(path)
            pages, rendered = extract_pdf(path, Settings.load())
            design, images = analyse_pdf_pages(rendered, Path(directory), 120)
            self.assertEqual([page.page for page in pages], [1, 2])
            self.assertEqual(len(images), 2)
            self.assertEqual(design[1].content_density, 0)
            self.assertIn("blank_rendered_page", design[1].warnings)
            self.assertTrue(document_signals(pages, design=design)["extractionReliable"])

    def test_vision_fallback_receives_the_same_rendered_pages_and_layout_metrics(self):
        settings = replace(Settings.load(), gemini_model="primary", gemini_fallback_model="backup", gemini_vision_fallback_model="")
        pages = [b"page one", b"page two"]
        metrics = [_metrics(np.full((32, 32, 3), 255, dtype=np.uint8), 1)]
        with patch("resume_worker.ai.evaluate_visual_design_gemini", side_effect=[
            {"score": None, "warnings": ["503"]},
            {"score": 80, "provider_metadata": {"validation": "passed"}, "criteria": [{}] * 6},
        ]) as evaluate:
            result = evaluate_visual_design_with_fallback(pages, metrics, settings)
        self.assertEqual(result["score"], 80)
        self.assertTrue(result["provider_metadata"]["fallback"])
        self.assertEqual([call.args[2].gemini_model for call in evaluate.call_args_list], ["primary", "backup"])
        self.assertEqual([call.args[2].gemini_vision_timeout_ms for call in evaluate.call_args_list], [25_000, 90_000])
        self.assertEqual(evaluate.call_args_list[1].args[2].gemini_vision_budget_ms, 185_000)
        self.assertEqual(evaluate.call_args_list[1].args[2].gemini_max_retries, 1)
        self.assertTrue(all(call.args[0] is pages and call.args[1] is metrics for call in evaluate.call_args_list))

    def test_vision_uses_dedicated_backup_model_when_configured(self):
        settings = replace(Settings.load(), gemini_model="primary", gemini_fallback_model="content-backup", gemini_vision_fallback_model="vision-backup")
        with patch("resume_worker.ai.evaluate_visual_design_gemini", side_effect=[
            {"score": None}, {"score": 70, "provider_metadata": {"validation": "passed"}},
        ]) as evaluate:
            result = evaluate_visual_design_with_fallback([b"page"], [], settings)

        self.assertEqual(evaluate.call_args.args[2].gemini_model, "vision-backup")
        self.assertTrue(result["provider_metadata"]["fallback"])

    def test_vision_retries_provider_deadline_exceeded(self):
        settings = replace(Settings.load(), gemini_api_key="test", gemini_max_retries=1)
        deadline_error = RuntimeError("504 DEADLINE_EXCEEDED")
        client = Mock()
        client.models.generate_content.side_effect = [deadline_error, RuntimeError("400 INVALID_ARGUMENT")]

        with patch("resume_worker.ai.genai.Client", return_value=client), patch("resume_worker.ai.time.sleep"):
            result = evaluate_visual_design_gemini([b"page"], [], settings)

        self.assertEqual(client.models.generate_content.call_count, 2)
        self.assertEqual(result["warnings"], ["400 INVALID_ARGUMENT"])

    def test_25_pages_chunk_and_validate_evidence(self):
        pages = [PageExtraction(page=index, width=600, height=800, text=f"Page {index} Alice Example", meaningful_characters=20) for index in range(1, 26)]
        self.assertEqual([len(item) for item in chunks(pages, 5)], [5, 5, 5, 5, 5])
        result = merge_analysis([{"profile": {"name": "Alice Example"}, "evidence": {"name": [1]}, "warnings": []}], "mock")
        self.assertEqual(validate_analysis(result, pages), [])

    def test_abandoned_cleanup_stays_under_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); abandoned = root / "resume-old"; abandoned.mkdir(); cleanup_abandoned(root, 0)
            self.assertFalse(abandoned.exists())

    def test_visual_density_uses_content_bounds_not_black_pixel_ratio(self):
        image = np.full((1000, 800, 3), 255, dtype=np.uint8)
        image[80:920, 70:730] = 250
        image[100:900:24, 90:710] = 0
        metrics = _metrics(image, 1)
        self.assertGreater(metrics.content_density, 0.60)
        self.assertLess(metrics.content_density, 0.90)

    def test_document_signals_detect_cross_page_margin_inconsistency(self):
        common = dict(margin_top_ratio=0.08, margin_bottom_ratio=0.08, whitespace_ratio=0.3, content_density=0.7, column_count=1, alignment_variance=0.1, indentation_variance=0.1, component_overlap_ratio=0.1, visual_balance=0.9, contrast_ratio=0.8, spacing_variance=0.1)
        design = [
            DesignMetrics(page=1, margin_left_ratio=0.08, margin_right_ratio=0.08, **common),
            DesignMetrics(page=2, margin_left_ratio=0.17, margin_right_ratio=0.08, **common),
        ]
        pages = [PageExtraction(page=1, width=600, height=800, text="Resume page one", meaningful_characters=15), PageExtraction(page=2, width=600, height=800, text="Resume page two", meaningful_characters=15)]
        signals = document_signals(pages, design=design)
        self.assertTrue(signals["hasVisualEvidence"])
        self.assertTrue(signals["inconsistentMargins"])
        self.assertIn("inconsistent_margins", signals["designWarnings"])


if __name__ == "__main__": unittest.main()
