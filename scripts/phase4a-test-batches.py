"""Run every discovered Vitest file in bounded batches; do not conceal failed batches."""
import json
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1];web=root/'apps/web';out=root/'.local/phase4a/vitest-batched-final'
out.mkdir(parents=True,exist_ok=True)
files=sorted(str(p.relative_to(web)).replace('\\','/') for p in (web/'src').rglob('*') if p.name.endswith(('.test.ts','.test.tsx')))
results=[]
for offset in range(0,len(files),8):
 batch=files[offset:offset+8];log=out/f'vitest-batch-{offset//8+1:02}.log'
 try:
  with log.open('w',encoding='utf-8') as stream:
   result=subprocess.run(['cmd.exe','/d','/c','pnpm','exec','vitest','run',*batch,'--maxWorkers=1','--pool=threads'],cwd=web,stdout=stream,stderr=subprocess.STDOUT,timeout=180)
  code=result.returncode
 except subprocess.TimeoutExpired: code='TIMEOUT'
 results.append({'files':batch,'exitCode':code,'log':str(log.relative_to(root))})
 print(f'Batch {len(results)} / {(len(files)+7)//8}: {code}',flush=True)
(out/'vitest-batches.json').write_text(json.dumps({'files':len(files),'batches':results},indent=2),encoding='utf-8')
raise SystemExit(0 if all(r['exitCode']==0 for r in results) else 1)
