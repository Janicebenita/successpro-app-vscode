import unittest
import fitz
from resume_worker.extraction import extract_column_aware_text
from resume_worker.models import PageExtraction
from resume_worker.structured import normalize_profile_chunk
class Phase3IntegrationTests(unittest.TestCase):
    def test_column_order_preserves_all_content(self):
        doc=fitz.open();page=doc.new_page()
        for i in range(8):
            page.insert_text((40,100+i*25),"LEFT section line "+str(i))
            page.insert_text((280,100+i*25),"RIGHT experience line "+str(i))
        text=extract_column_aware_text(page)
        self.assertLess(text.index("LEFT section line 7"),text.index("RIGHT experience line 0"))
        for i in range(8):self.assertIn("LEFT section line "+str(i),text);self.assertIn("RIGHT experience line "+str(i),text)
        doc.close()
    def test_list_object_shapes_and_evidence(self):
        pages=[PageExtraction(page=1,width=600,height=800,text="Jane built APIs using SQL",meaningful_characters=20)]
        field={"name":"experience","value":"built APIs using SQL","pages":[1],"evidence":["built APIs using SQL"]}
        for payload in ([field],{"fields":[field]},[{"fields":[field]}]):self.assertEqual(normalize_profile_chunk(payload,pages)["profile"]["experience"],field["value"])
        unsupported={**field,"value":"Invented employer"};r=normalize_profile_chunk({"fields":[unsupported]},pages)
        self.assertFalse(r["profile"]);self.assertTrue(r["warnings"])
        bad={**field,"pages":[2]};self.assertFalse(normalize_profile_chunk({"fields":[bad]},pages)["profile"])
        with self.assertRaises(ValueError):normalize_profile_chunk("bad shape",pages)
