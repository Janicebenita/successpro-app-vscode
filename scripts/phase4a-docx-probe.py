"""Isolated DOCX converter diagnostic; no candidate data or database calls."""
import json,subprocess,sys
from pathlib import Path
from docx import Document
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'processing'))
from resume_worker.config import Settings
out=root/'.local/phase4a/docx-probe';out.mkdir(parents=True,exist_ok=True)
suffix='-'+sys.argv[1] if len(sys.argv)>1 else ''
assert suffix in ['', '-elevated']
profile=out/('profile'+suffix);profile.mkdir(exist_ok=True)
source=out/'synthetic.docx';d=Document();d.add_paragraph('Synthetic conversion test only. Jane Example.');d.save(source)
try:
 r=subprocess.run([Settings.load().libreoffice_binary,f'-env:UserInstallation={profile.as_uri()}','--headless','--convert-to','pdf','--outdir',str(out),str(source)],capture_output=True,text=True,timeout=45)
 result={'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'pdfExists':(out/'synthetic.pdf').exists()}
except Exception as error:result={'error':str(error),'pdfExists':False}
(root/f'.local/phase4a/docx-probe{suffix}.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
