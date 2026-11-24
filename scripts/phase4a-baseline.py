"""Read-only source/workbook audit. Never connects to a provider or database."""
import hashlib
import sys
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local' / 'phase4a'
OUT.mkdir(parents=True, exist_ok=True)
WORKBOOK = Path(r'C:\Users\janic\Documents\Codex\2026-11-14\continue-successpro-v2-remediation-first-verify\outputs\PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx')
EXPECTED = '8a6794c75e8e323e0fa06678b1c3096cfeec17c32f084a046fa84143a52bea97'
digest = hashlib.sha256(WORKBOOK.read_bytes()).hexdigest()
assert digest == EXPECTED, f'STOP: workbook mismatch {digest}'
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(WORKBOOK) as z:
    strings = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
    workbook = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = {}
    for s in workbook.find('m:sheets', ns):
        target = rels[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        rows = []
        for row in ET.fromstring(z.read(path)).findall('.//m:sheetData/m:row', ns):
            cells = {}
            for c in row:
                value = c.find('m:v', ns)
                text = value.text if value is not None else ''.join(c.find('m:is', ns).itertext()) if c.find('m:is', ns) is not None else ''
                if c.attrib.get('t') == 's': text = strings[int(text)]
                formula = c.find('m:f', ns)
                cells[c.attrib['r']] = {'value': text, **({'formula': formula.text} if formula is not None else {})}
            rows.append(cells)
        sheets[s.attrib['name']] = rows
    (OUT / 'workbook-cells.json').write_text(json.dumps({'path': str(WORKBOOK), 'sha256': digest, 'sheets': sheets}, indent=2), encoding='utf-8')
manifest = {}
for base in ['apps/web/src', 'packages', 'processing/resume_worker', 'processing/tests']:
    for p in (ROOT / base).rglob('*'):
        if p.is_file() and p.suffix in {'.ts', '.tsx', '.py', '.json'} and 'node_modules' not in p.parts:
            manifest[p.relative_to(ROOT).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
manifest_path = OUT / 'source-before.json'
if manifest_path.exists(): raise SystemExit('Baseline already exists; refusing to overwrite')
manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'workbookSha256': digest, 'sourceFiles': len(manifest), 'sheets': list(sheets)}))
for name, rows in sheets.items():
    if any(word in name.lower() for word in ['rating', 'free', 'paid', 'scoring']):
        print('\nSHEET', name)
        for row in rows:
            print(' | '.join(k + ': ' + v['value'] + (' FORMULA=' + str(v['formula']) if 'formula' in v else '') for k,v in row.items()))
