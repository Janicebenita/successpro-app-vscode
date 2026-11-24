import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import fitz

from resume_worker.ai import vision_ocr_page
from resume_worker.config import Settings
from resume_worker.extraction import NativeTextError
from resume_worker.worker import Worker


class OcrContentIntegrityTests(unittest.TestCase):
    def test_missing_key_raises_instead_of_returning_template_text(self):
        with patch('resume_worker.ai.genai.Client') as client:
            with self.assertRaisesRegex(RuntimeError, 'OCR is unavailable'):
                vision_ocr_page(b'page', replace(Settings.load(), gemini_api_key=''))
            client.assert_not_called()

    def test_provider_error_is_not_returned_as_resume_text(self):
        client = Mock()
        client.models.generate_content.side_effect = RuntimeError('503 UNAVAILABLE')
        with patch('resume_worker.ai.genai.Client', return_value=client):
            with self.assertRaisesRegex(RuntimeError, 'OCR failed'):
                vision_ocr_page(b'page', replace(Settings.load(), gemini_api_key='test-key'))

    def test_success_preserves_source_wording(self):
        client = Mock()
        text = 'Alex Example\nDesigner\nalex@example.com\n2019–2024'
        client.models.generate_content.return_value = SimpleNamespace(text=text)
        with patch('resume_worker.ai.genai.Client', return_value=client):
            self.assertEqual(vision_ocr_page(b'page', replace(Settings.load(), gemini_api_key='test-key')), text)

    def test_empty_response_fails(self):
        client = Mock()
        client.models.generate_content.return_value = SimpleNamespace(text='')
        with patch('resume_worker.ai.genai.Client', return_value=client):
            with self.assertRaises(RuntimeError):
                vision_ocr_page(b'page', replace(Settings.load(), gemini_api_key='test-key'))

    def test_scanned_pdf_without_ocr_is_not_saved_as_review_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'scan.pdf'
            doc = fitz.open()
            doc.new_page()
            doc.save(source)
            doc.close()
            worker = Worker.__new__(Worker)
            worker.settings = replace(Settings.load(), storage_root=root, gemini_api_key='')
            worker.database = Mock()
            worker.runtime = {}
            with self.assertRaisesRegex(NativeTextError, 'scanned PDF could not be read'):
                worker.process({'id': 'isolated-test', 'original_path': str(source)}, root)
            worker.database.save_extraction.assert_not_called()
            worker.database.awaiting_review.assert_not_called()


if __name__ == '__main__':
    unittest.main()
