"""Verify original source/workbook hashes and pre-existing database row hashes."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'.local/phase4a'
before=json.loads((out/'source-before.json').read_text(encoding='utf-8'))
after={}
for base in ['apps/web/src','packages','processing/resume_worker','processing/tests']:
 for p in (root/base).rglob('*'):
  if p.is_file() and p.suffix in {'.ts','.tsx','.py','.json'} and 'node_modules' not in p.parts:
   after[p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
(out/'source-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8')
changed=[{'path':p,'before':digest,'after':after.get(p)} for p,digest in before.items() if after.get(p)!=digest]
added=[{'path':p,'sha256':digest} for p,digest in after.items() if p not in before]
protected=['packages/domain/src/successpro-v2/'+name for name in ['scoring-engine.ts','scoring-config.ts','parameter-registry.ts','rating-rubric.ts','rounding.ts','date-intervals.ts']]+['packages/domain/src/resume-scoring.ts','packages/domain/src/scoring-config.ts','processing/resume_worker/workbook_visual_rubric.json']
approved=['packages/domain/src/validation-framework/types.ts','apps/web/check-latest-job.ts','apps/web/src/lib/job-connectors.test.ts','apps/web/src/lib/ai/task-registry.ts']
workbook=Path(r'C:\Users\janic\Documents\Codex\2026-11-14\continue-successpro-v2-remediation-first-verify\outputs\PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx')
sha=hashlib.sha256(workbook.read_bytes()).hexdigest()
a=json.loads((out/'database-before.json').read_text());b=json.loads((out/'database-after.json').read_text())
database={t:{'originalRows':len(a[t]),'changedOriginalRows':sum(b[t].get(k)!=v for k,v in a[t].items()),'additionalRows':len(set(b[t])-set(a[t]))} for t in a}
result={'workbookSha256':sha,'workbookUnchanged':sha=='8a6794c75e8e323e0fa06678b1c3096cfeec17c32f084a046fa84143a52bea97','protectedScoringFiles':{p:before[p]==after.get(p) for p in protected},'previousRemediationFiles':{p:{'before':before.get(p),'after':after.get(p),'unchanged':before.get(p)==after.get(p)} for p in approved if p in before},'changed':changed,'added':added,'database':database}
(out/'preservation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'workbookUnchanged':result['workbookUnchanged'],'scoringFilesUnchanged':all(result['protectedScoringFiles'].values()),'changedSourceFiles':len(changed),'newSourceFiles':len(added),'database':database}))
assert result['workbookUnchanged'] and all(result['protectedScoringFiles'].values()) and all(v['changedOriginalRows']==0 for v in database.values())
