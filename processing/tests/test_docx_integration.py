from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from docx import Document

from resume_worker.config import Settings
from resume_worker.extraction import extract_docx, validate_native_text
from resume_worker.visual import analyse_pdf_pages


class DocxIntegrationTests(unittest.TestCase):
    def test_docx_conversion_extraction_and_visual_metrics(self):
        settings = Settings.load()
        with tempfile.TemporaryDirectory(dir=settings.temporary_root) as directory:
            temporary = Path(directory)
            source = temporary / "synthetic-resume.docx"
            document = Document()
            document.add_heading("Jane Example", 0)
            document.add_paragraph("jane@example.com | +1 202 555 0147 | https://example.com")
            document.add_heading("Experience", 1)
            document.add_paragraph("Software engineer building reliable local document processing systems. " * 8)
            document.save(source)
            pages, converted = extract_docx(source, temporary, settings)
            self.assertTrue(converted.exists())
            self.assertEqual(validate_native_text(pages), [])
            metrics, _ = analyse_pdf_pages(converted, temporary, settings.render_dpi)
            self.assertEqual(len(metrics), len(pages))
            self.assertFalse(list(temporary.glob("page-*.png")))


if __name__ == "__main__":
    unittest.main()
