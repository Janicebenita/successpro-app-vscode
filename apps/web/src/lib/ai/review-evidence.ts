/** Stable source spans: the reviewer selects an ID instead of retyping a quote. */
export function reviewEvidence(text: string) {
  const spans = text.split(/\r?\n/).flatMap((line) => {
    const spans: string[] = [];
    let remaining = line.trim();
    while (remaining.length > 650) {
      const boundary = remaining.lastIndexOf(" ", 650);
      const end = boundary > 100 ? boundary : 650;
      spans.push(remaining.slice(0, end));
      remaining = remaining.slice(end).trim();
    }
    // Short headings and competency labels are often the clearest evidence in
    // multi-column resumes; omitting them makes the reviewer infer they do not exist.
    if (remaining.length >= 3) spans.push(remaining);
    return spans;
  });
  // A ten-page resume can have thousands of short bullets. The old first-250
  // cutoff prevented the reviewer from citing anything near its end. A 200k
  // character source fits the model context; only pathological fragmentation
  // needs sampling, and that sampling must cover the full document.
  const selected = spans.length <= 5_000 ? spans : Array.from({ length: 5_000 }, (_, index) => spans[Math.round(index * (spans.length - 1) / 4_999)]);
  return selected.map((text, index) => ({ id: `q${index + 1}`, text }));
}
