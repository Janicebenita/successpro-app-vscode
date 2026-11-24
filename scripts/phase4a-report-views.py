"""Apply narrow, checked view edits; no data reads/writes."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
edits={
 'apps/web/src/components/workbook-review.tsx':[
  ('<blockquote>{p.evidence.excerpt}</blockquote>', '<blockquote>{p.evidence.excerpt}</blockquote>{p.evidence.additionalExcerpts?.map((quote,index)=><blockquote key={index}>{quote.excerpt}<cite>{quote.location}</cite></blockquote>)}'),
  ('<blockquote>{a.rewriteTemplate}</blockquote><p>Conditional recovery: {a.conditionalPointRecovery} points, subject to verified new evidence.</p>', '{a.rewriteTemplate ? <blockquote>{a.rewriteTemplate}</blockquote> : null}<p>{a.affectedCriteria?.map(c=>`${c.parameterId}: ${c.conditionalPointRecovery.toFixed(2)} points`).join("; ")}</p><p>Estimated effort: {a.effortMinutes ?? "unconfirmed"} minutes. Conditional recovery ceiling: {a.conditionalPointRecovery.toFixed(2)} points, if all related shortfalls are resolved. This is not a guaranteed score improvement.</p>'),
 ],
 'apps/web/src/lib/review-report-renderer.tsx':[
  ('<Text>{p.evidence.excerpt}</Text>', '<Text>{p.evidence.excerpt}</Text>{p.evidence.additionalExcerpts?.map((quote,index)=><Text key={index}>{quote.excerpt} {quote.location}</Text>)}'),
  ('<Text>{a.rewriteTemplate}</Text><Text>Conditional recovery: {a.conditionalPointRecovery} points, subject to verified new evidence</Text>', '{a.rewriteTemplate ? <Text>{a.rewriteTemplate}</Text> : null}<Text>{a.affectedCriteria?.map(c=>`${c.parameterId}: ${c.conditionalPointRecovery.toFixed(2)} points`).join("; ")}</Text><Text>Estimated effort: {a.effortMinutes ?? "unconfirmed"} minutes. Conditional recovery ceiling: {a.conditionalPointRecovery.toFixed(2)} points, if all related shortfalls are resolved. Not a guaranteed score improvement.</Text>'),
 ]}
for name,replacements in edits.items():
 p=root/name
 text=p.read_text(encoding='utf-8')
 for before,after in replacements:
  assert text.count(before)==1, (name,before)
  text=text.replace(before,after)
 p.write_text(text,encoding='utf-8')
