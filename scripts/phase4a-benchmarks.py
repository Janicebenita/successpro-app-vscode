"""Generate synthetic fixtures and an honest blocked live-run ledger. No AI or DB access."""
import hashlib
import json
from pathlib import Path
import fitz
root=Path(__file__).resolve().parents[1]
out=root/'.local/phase4a/benchmarks';out.mkdir(parents=True,exist_ok=True)
texts={
 'poor': 'SYNTHETIC BENCHMARK ONLY\nPROFILE\nI am great at everything. Looking for any job.\nEXPERIENCE\nDid stuff at companies. Helped people.\nSKILLS\nComputers. Teamwork.\nEDUCATION\nStudied things.',
 'mid': 'SYNTHETIC BENCHMARK ONLY\nAlex Example\nOperations Analyst\nalex@example.com\nPROFILE\nOperations analyst supporting service teams and recurring reporting.\nEXPERIENCE\nAnalyst at Example Services Jan 2020 - Dec 2022\nPrepared weekly service reports and supported customer issue triage.\nReviewed recurring issues with the service team.\nSKILLS\nSpreadsheets and service reporting.\nEDUCATION\nBSc Operations, Example College. Completed.',
 'strong': 'SYNTHETIC BENCHMARK ONLY\nAlex Example\nOperations Analyst\nalex@example.com\nPROFILE\nOperations analyst who builds service reporting and resolves recurring service issues using documented operational evidence.\nEXPERIENCE\nOperations Analyst at Example Services Jan 2023 - Oct 2026\nDesigned weekly service reports using SQL and spreadsheet checks for the support team.\nOwned reconciliation of ticket records and documented exception handling, reducing repeated reconciliation work by 20% within the reporting process.\nWorked with service leads to investigate recurring issues and introduced a shared resolution checklist adopted by 3 teams.\nAnalyst at Sample Operations Jan 2020 - Dec 2022\nPrepared service reports, validated source records and documented handover steps for recurring analysis.\nSKILLS\nSQL: reporting queries and reconciliation. Spreadsheets: exception checks. Service analysis: issue triage and documented resolution.\nEDUCATION\nBSc Operations, Example College. Completed.'}
ledger=[]
for name,text in texts.items():
 path=out/(name+'.txt');path.write_text(text,encoding='utf-8')
 doc=fitz.open();p=doc.new_page();p.insert_textbox(fitz.Rect(45,45,550,790),text,fontsize=11);pdf=out/(name+'.pdf');doc.save(pdf);doc.close()
 ledger.append({'id':name,'source':'purpose-written synthetic fixture, no real candidate','sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'initialHypothesis':{'poor':'25–40','mid':'55–70','strong':'85+'}[name],'humanReview':'UNAVAILABLE — hypotheses only, not reference ratings','classification':'exploratory','runs':[{'run':i,'status':'BLOCKED','reason':'Paid Gemini calls not approved; no suitable stored response snapshots supplied','ratings':None,'score':None,'provider':None,'model':None,'promptVersion':'successpro-v2-workbook-evidence-phase3-v5-editorial-v3-phase4a-v1','settings':None,'validationStatus':'not_run','fallbackStatus':'not_run','timestamp':None} for i in range(1,6)],'statistics':{'mean':None,'minimum':None,'maximum':None,'standardDeviation':None,'perCriterionVariation':None,'ratingChanges':None},'ranking':'NOT MEASURED'})
(out/'results.json').write_text(json.dumps({'status':'BLOCKED','note':'No score, variation, human reference or calibration success is fabricated. Synthetic writing quality labels require independent anchor review before validation. Earlier CVs were not reused because authorization/anonymization was not established.','benchmarks':ledger},indent=2,ensure_ascii=False),encoding='utf-8')
print('Created three synthetic fixtures; all fifteen paid live runs BLOCKED.')
