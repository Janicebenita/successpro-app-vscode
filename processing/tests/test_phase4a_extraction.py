import tempfile
import unittest
from pathlib import Path
import fitz
from resume_worker.ai import MockProvider
from resume_worker.config import Settings
from resume_worker.extraction import extract_pdf, identify_profile, document_signals

def page_fixture(doc, columns=False, mixed=False):
    page=doc.new_page()
    page.insert_text((250 if columns else 40,45),"Jane Example",fontsize=22)
    page.insert_text((250 if columns else 40,70),"Senior Software Engineer",fontsize=12)
    if columns:
        for i,text in enumerate(["CONTACT","jane@example.com","https://jane.dev/work","SKILLS","Python","SQL","EDUCATION","BSc Computing","2020"]):page.insert_text((40,110+i*28),text,fontsize=10)
    for i,text in enumerate(["PROFILE","Built reliable service platforms.","EXPERIENCE","Engineer at Acme","Jan 2020 - Dec 2022","Prepared service reports.","Managed support tools.","Delivered client updates."]):page.insert_text((250 if columns else 40,110+i*28),text,fontsize=10)
    if mixed:page.insert_text((40,480),"FULL WIDTH PROJECT HISTORY AND ADDITIONAL CONTRIBUTIONS FOR REVIEW",fontsize=11)
    return page

class Phase4AExtractionTests(unittest.TestCase):
    def extract(self,columns=False,mixed=False,count=1):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"synthetic.pdf"
            doc=fitz.open()
            for _ in range(count):page_fixture(doc,columns,mixed)
            doc.save(path);doc.close()
            pages,_=extract_pdf(path,Settings.load())
            return pages

    def test_single_column_identity_and_explicit_title(self):
        pages=self.extract();profile=identify_profile(pages)
        self.assertEqual(profile.name.value,"Jane Example")
        self.assertEqual(profile.professional_title.value,"Senior Software Engineer")
        self.assertTrue(pages[0].original_text)

    def test_explicit_title_reaches_native_analysis_profile(self):
        pages=self.extract();profile=identify_profile(pages)
        result=MockProvider().analyse_chunk(pages,profile)
        self.assertEqual(result["profile"]["headline"],"Senior Software Engineer")
        self.assertEqual(result["evidence"]["headline"],[1])

    def test_two_column_main_header_precedes_sidebar(self):
        pages=self.extract(columns=True);text=pages[0].text
        self.assertLess(text.index("Jane Example"),text.index("CONTACT"))
        self.assertLess(text.index("Engineer at Acme"),text.index("SKILLS"))
        self.assertIn("jane@example.com",text);self.assertIn("https://jane.dev/work",text)
        self.assertIn("column_order_requires_visual_verification",pages[0].warnings)
        self.assertTrue(document_signals(pages)["multiColumn"])

    def test_multipage_and_mixed_layout_preserve_content_and_original(self):
        for mixed in (False,True):
            pages=self.extract(columns=True,mixed=mixed,count=2)
            self.assertEqual(len(pages),2)
            for p in pages:
                self.assertIn("Jan 2020 - Dec 2022",p.text)
                self.assertIn("jane@example.com",p.original_text)
                self.assertTrue(p.spans);self.assertTrue(p.reading_order)
                if mixed:self.assertIn("FULL WIDTH PROJECT HISTORY",p.text)

    def test_absent_title_is_not_invented(self):
        pages=self.extract();pages[0].text="Jane Example\nEXPERIENCE\nEngineer at Acme"
        self.assertIsNone(identify_profile(pages).professional_title)

    def test_concatenated_name_is_flagged_not_guessed(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"joined.pdf";doc=fitz.open();p=doc.new_page();p.insert_text((40,50),"JaneExample",fontsize=22);doc.save(path);doc.close()
            pages,_=extract_pdf(path,Settings.load())
            self.assertIn("possible_concatenated_name_or_spacing",pages[0].warnings)
            self.assertIsNone(identify_profile(pages).name)
