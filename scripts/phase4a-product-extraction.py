"""Exercise real local extractors/renderers against synthetic fixtures, without queue/DB/AI access."""
import hashlib,json,sys
from dataclasses import replace
from pathlib import Path
import fitz
from docx import Document
root=Path(__file__).resolve().parents[1];sys.path[:0]=[str(root/'processing'),str(root/'processing/tests')]
from resume_worker.config import Settings
from resume_worker.extraction import extract_pdf,extract_docx,identify_profile,validate_native_text
from test_phase4a_extraction import page_fixture
out=root/'.local/phase4a/product-acceptance';fixtures=out/'fixtures';fixtures.mkdir(parents=True,exist_ok=True)
settings=replace(Settings.load(),ai_provider='mock',gemini_api_key='',temporary_root=fixtures)
scenarios={
 'single-column':{},'two-column':{'columns':True},'multi-page':{'count':2},
 'missing-dates':{'replace':('Jan 2020 - Dec 2022','Dates not supplied')},
 'overlapping-roles':{'extra':['Analyst at Beta Jan 2021 - Dec 2022']},
 'concurrent-roles':{'extra':['Part-time consultant at Beta Jan 2021 - Dec 2022']},
 'contradictory-dates':{'replace':('Jan 2020 - Dec 2022','Jan 2022 - Dec 2020')},
 'repeated-headings':{'extra':['SKILLS','SKILLS','SKILLS']},
 'misleading-metrics':{'extra':['Claimed achievement: increased revenue by 999%.']},
 'no-contact':{},'unusual-layout':{'columns':True,'mixed':True},'incomplete':{'incomplete':True}}
results=[]
for name,options in scenarios.items():
 doc=fitz.open()
 if options.get('incomplete'):
  p=doc.new_page();p.insert_text((40,50),'PROFILE')
 else:
  for _ in range(options.get('count',1)):
   p=page_fixture(doc,options.get('columns',False),options.get('mixed',False))
   if options.get('replace'):
    old,new=options['replace']
    for rect in p.search_for(old):p.add_redact_annot(rect)
    p.apply_redactions();p.insert_text((40,410),new)
   for i,text in enumerate(options.get('extra',[])):p.insert_text((40,540+i*20),text,fontsize=10)
 path=fixtures/(name+'.pdf');doc.save(path);doc.close()
 pages,_=extract_pdf(path,settings);profile=identify_profile(pages)
 text='\n\n'.join(p.text for p in pages)
 expected=['PROFILE'] if options.get('incomplete') else ['Jane Example','Senior Software Engineer','Prepared service reports.']
 present=all(term in text for term in expected)
 if name=='two-column':present=present and text.index('Jane Example')<text.index('CONTACT')
 if name=='multi-page':present=present and len(pages)==2
 doc=fitz.open(path)
 if name=='two-column':doc[0].get_pixmap(matrix=fitz.Matrix(1,1)).save(out/'two-column-source.png')
 doc.close()
 results.append({'case':name,'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mode':'direct production extractor, not uploaded/queued','extractionVerdict':'PASS' if present else 'FAIL','expectedSourceTerms':expected,'text':text,'profile':profile.model_dump(mode='json'),'pages':[p.model_dump(mode='json') for p in pages],'insufficientPages':validate_native_text(pages),'assessmentStatus':'BLOCKED — dedicated QA DB and paid AI unavailable'})
doc=Document();doc.add_heading('Jane Example',0);doc.add_paragraph('Senior Software Engineer');doc.add_paragraph('jane@example.com');doc.add_heading('EXPERIENCE',1);doc.add_paragraph('Engineer at Acme Jan 2020 - Dec 2022');doc.add_paragraph('Prepared weekly service reports and supported customer requests. '*5)
path=fixtures/'valid.docx';doc.save(path)
try:
 conversion=fixtures/'docx-conversion';conversion.mkdir(exist_ok=True)
 pages,pdf=extract_docx(path,conversion,settings);text='\n\n'.join(p.text for p in pages)
 results.append({'case':'valid-docx','mode':'production DOCX/LibreOffice extraction','extractionVerdict':'PASS' if 'Jane Example' in text and 'Prepared weekly service reports' in text else 'FAIL','text':text,'convertedPdf':str(pdf.relative_to(root)),'assessmentStatus':'BLOCKED'})
except Exception as error:results.append({'case':'valid-docx','extractionVerdict':'FAIL','error':str(error),'assessmentStatus':'BLOCKED'})
(fixtures/'invalid.pdf').write_text('Synthetic invalid file, not a PDF.',encoding='utf-8')
(fixtures/'empty.pdf').write_bytes(b'')
(out/'extraction-scenarios.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps([{'case':r['case'],'extractionVerdict':r['extractionVerdict']} for r in results]))
