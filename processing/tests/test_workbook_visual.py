from __future__ import annotations
import json
import unittest
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import patch, Mock
from resume_worker.ai import evaluate_visual_design_gemini
from resume_worker.config import Settings
from resume_worker.extraction import document_signals
from resume_worker.models import PageExtraction

def assessment():
    return {"critique":"Synthetic visual inspection", "criteria":[{"code":f"V{i:02d}","rating":4,"confidence":0.9,"pages":[1,2],"evidence":"Observed on both page images","recommendation":"Limited visible shortfall","anchorText":"Strong evidence with a limited shortfall","anchorJustification":"Readable evidence on both pages with a small spacing issue","nextAnchorGap":"Correct the observed spacing"} for i in range(1,7)],"pages":[{"page":p,"score":80,"confidence":0.9,"observations":["Readable"],"warnings":[]} for p in (1,2)]}

class WorkbookVisualTests(unittest.TestCase):
    def run_visual(self, value, first_error=None):
        settings=replace(Settings.load(),gemini_api_key="synthetic-test-key",gemini_model="synthetic",gemini_max_retries=1)
        client=Mock()
        response=SimpleNamespace(text=json.dumps(value))
        client.models.generate_content.side_effect=[first_error,response] if first_error else [response]
        with patch("resume_worker.ai.genai.Client",return_value=client), patch("resume_worker.ai.time.sleep"):
            result=evaluate_visual_design_gemini([b"synthetic-page-1",b"synthetic-page-2"],[],settings)
        return result,client

    def test_workbook_codes_weights_and_retry(self):
        result,client=self.run_visual(assessment(),RuntimeError("429 RESOURCE_EXHAUSTED"))
        self.assertEqual(result["score"],80)
        self.assertEqual(client.models.generate_content.call_count,2)
        self.assertEqual({r["code"] for r in result["criteria"]},{f"V{i:02d}" for i in range(1,7)})

    def test_partial_pages_do_not_produce_a_score(self):
        value=assessment();value["pages"].pop()
        result,_=self.run_visual(value)
        self.assertIsNone(result["score"])
        self.assertTrue(result["warnings"])

    def test_missing_anchor_comparison_is_rejected(self):
        value=assessment();value["criteria"][0]["anchorText"]=""
        result,_=self.run_visual(value)
        self.assertIsNone(result["score"])

    def test_anchor_copy_does_not_certify_visual_evidence(self):
        value = assessment()
        criterion = value["criteria"][0]
        criterion["evidence"] = criterion["anchorText"].upper() + "."
        result, _ = self.run_visual(value)
        self.assertIsNone(result["score"])
        self.assertNotIn("V01", {row["code"] for row in result["criteria"]})

    def test_decimal_rating_and_legacy_rubric_are_rejected(self):
        for mutation in (2.5,"legacy"):
            value=assessment()
            if mutation=="legacy":value["criteria"][0]["code"]="visual_hierarchy"
            else:value["criteria"][0]["rating"]=mutation
            result,_=self.run_visual(value)
            self.assertIsNone(result["score"])

    def test_failed_ocr_and_missing_design_never_certify_evidence(self):
        page=PageExtraction(page=1,width=600,height=800,text="[Vision OCR error: unavailable]",meaningful_characters=30)
        result=document_signals([page],gemini_visual={"score":None,"warnings":["Vision unavailable"]})
        self.assertFalse(result["extractionReliable"])
        self.assertFalse(result["hasVisualEvidence"])
        self.assertIn("Vision unavailable",result["designWarnings"])
        self.assertNotIn("minimumFontSize",result)
