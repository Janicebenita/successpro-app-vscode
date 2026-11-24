# Resume and cover-letter design standard

Last reviewed: 2026-09-23

## Purpose

This standard governs every resume and cover letter created or exported by SuccessPro. It converts the founder's direction and the reviewed XF Resume sample library into original, testable design rules. The samples are references for quality, hierarchy, density, and variety; SuccessPro must not reproduce their proprietary templates, graphics, text, or candidate data.

Reference pages reviewed:

- [XF Resume sample library](https://www.xfresume.com/samples): visual, text, and executive resume categories.
- [XF Resume cover-letter service](https://www.xfresume.com/cover-letter): tailored, concise, role-specific content that complements the resume.
- Representative sample PDFs: Visual V4, V8, V9; Text T3, T7; Executive E9. All pages were rendered and inspected, not judged from extracted text alone.

## What the reference library does well

- Strong first-page identity through a clear name, headline, contact block, and restrained accent palette.
- Multiple visual families rather than one template with different colours.
- Useful executive storytelling patterns: growth paths, role timelines, impact-led bullets, career highlights, and distinct skill groups.
- Consistent section hierarchy across multi-page documents.
- Optional portraits used as a deliberate composition element rather than a floating attachment.
- Dense but purposeful information architecture that can represent long careers without making every page look identical.
- Visual continuity between page one and continuation pages through colour, rules, recurring headings, and page-edge motifs.

## What SuccessPro must improve

- Never shrink body text below 8 pt to force content onto a page.
- Avoid decorative skill bars, doughnut charts, arbitrary percentages, and unlabeled proficiency graphics. They consume space, are hard to substantiate, and may parse poorly.
- Do not use an icon as the only label for a phone, email, location, or link.
- Preserve a logical single text-extraction order even when the visual layout has columns.
- Avoid overlong paragraphs, justified spacing rivers, crowded bullet stacks, and weak line wrapping.
- Do not place essential content in images, page headers, page footers, text boxes, or inaccessible vector outlines.
- Do not leave a blank photo frame, empty sidebar, isolated heading, half-empty continuation page, or large unexplained gap when an optional section is absent.
- Never manufacture facts, metrics, responsibilities, employers, education, certifications, dates, or skills to improve page balance.

## Typography contract

All sizes refer to final embedded PDF point sizes, not browser CSS approximations.

| Element | Allowed | Default |
| --- | ---: | ---: |
| Candidate name | 12-14 pt | 14 pt |
| Section heading | 9-10 pt | 9.5 pt |
| Body and bullets | 8-9 pt | 8.5 pt |
| Role/title line | 8.5-10 pt | 9 pt |
| Dates, location, metadata | 8-9 pt | 8 pt |
| Page number/footer | 8 pt | 8 pt |

Rules:

- Use no more than two type families in one document; one well-designed family with several weights is preferred.
- Embed every font subset in the PDF. Never depend on a reader's local fonts.
- Use open, commercially usable fonts with strong Latin coverage and language-appropriate fallbacks. Initial approved families: Inter, Source Sans 3, and Noto Sans.
- Body line height: 1.16-1.28. Bullet spacing: 1.5-3 pt. Section spacing: 6-10 pt.
- Do not use full paragraphs in uppercase. Section headings may use uppercase only with comfortable tracking.
- Use bold selectively for role, employer, and measurable evidence; do not bold entire bullets.

## Page and spacing contract

- Default page: A4. Allow US Letter only when the customer selects it or a target market requires it.
- A4 safe margins: 28-40 pt. Nothing may enter the print-safety inset.
- Prefer one page for students and early-career profiles, two pages for most experienced professionals, and two or three pages for genuinely extensive executive/technical histories.
- Cover letters should normally be one page and 250-450 words. A second page is not an automatic overflow escape.
- Content determines page count. Page count never determines whether facts are omitted or invented.
- A section heading must remain with at least two subsequent lines.
- A role heading must remain with its employer/date line and at least the first achievement.
- Prevent widow/orphan lines and bullet fragments across pages.
- Continuation pages repeat only a compact identity line and page number; they must not repeat a large hero header.
- Reflow all adjacent sections when a photograph, link, optional section, or short career entry is absent.

## Original SuccessPro style families

### Clarity

- ATS-first, single-column, restrained rules, no required photograph.
- Best for broad applications, early/mid-career users, regulated industries, and conservative employers.
- Highest parsing reliability and the default recommendation.
- Cover letter uses the same name block, type scale, accent rule, and contact line.

### Signature

- Executive-led composition with a narrow identity/sidebar zone and a dominant achievement column.
- Optional professional photograph; removing it collapses the portrait area and promotes the summary without leaving a hole.
- Best for directors, senior leaders, consultants, and client-facing roles.
- Logical document-tree order remains name/contact/summary/experience/education/skills regardless of visual columns.
- Cover letter retains the sidebar/accent treatment in a lighter one-page composition.

### Momentum

- Career-progression design with a restrained timeline, compact milestone markers, and clear chronological flow.
- Optional photograph, used only in the first-page identity block.
- Best for clear progression, internal mobility, project/program careers, and professional pivots.
- The timeline is decorative enhancement; dates and roles also exist as normal selectable text.
- Cover letter reuses the timeline colour and header geometry but not the full timeline graphic.

### Editorial

- Text-rich, achievement-led layout with a strong typographic opening and modular sections.
- No proficiency charts; dense expertise is grouped using headings and concise lists.
- Photograph is optional and appears only when the selected market/role and user preference make it suitable.
- Best for subject-matter experts, researchers, academics, medical profiles, and detailed technical careers.
- Cover letter uses the same editorial masthead, fonts, rule system, and accent colour.

## Photograph rules

- Photograph is always optional and off by default.
- Explain that photo norms vary by country and employer; never imply that a photo improves ATS results.
- Provide crop/position preview, circular or rounded-rectangle treatment defined by the selected style, and accessible removal.
- Validate JPEG/PNG/WebP signature, size, dimensions, and orientation. Strip metadata before export.
- Use a print-quality crop; target at least 300 effective pixels across the rendered frame.
- Never stretch, distort, beautify, generate, or materially alter a person's appearance.
- When removed, the layout must reflow with no empty frame or stranded contact details.

## Content composition

- Resume and cover letter use the same confirmed canonical profile and selected target job.
- The resume leads with the most relevant supported achievements, not a generic objective.
- Use short evidence-led bullets: action + scope/context + supported result where available.
- Separate observed facts, user-confirmed facts, and suggestions during editing.
- AI may rewrite or prioritize only supplied facts; it may not invent claims.
- Cover letter structure: tailored opening, role/company motivation grounded in user notes or supplied job information, two or three relevant evidence paragraphs, concise close.
- The cover letter must complement rather than repeat the resume line by line.
- Tone options may change phrasing, never factual content.

## Resume/cover-letter theme lock

A cover letter is always generated from the same `templateId` and `themeVersion` as its resume unless the user explicitly changes the pair together. The following remain matched:

- font family and weights,
- name and section scale,
- accent colour and rule thickness,
- contact ordering and formatting,
- page margins and corner geometry,
- photograph treatment when the user chooses to carry it into the cover letter,
- header/footer and page-number style.

Changing a style previews and applies the complete pair. It must never silently restyle only one document.

## Automatic pagination and fit engine

1. Compose from structured sections, never from absolute-positioned free text.
2. Measure final font metrics using the exact embedded fonts.
3. Allocate sections to pages using keep-with-next, minimum block size, widow/orphan, and role-integrity rules.
4. Rebalance columns and optional modules before reducing type size.
5. If content still overflows, add a page. Never clip, overlap, hide, or shrink below the typography contract.
6. If content is short, tighten the composition and reflow optional modules; never leave a decorative empty region.
7. Show a user-visible content-fit explanation when a selected design is unsuitable for the amount of material and recommend a better style.

## Export preflight — mandatory for every PDF

No PDF is delivered until all automated checks and a rendered-page inspection pass.

### Structural checks

- correct A4/Letter dimensions and consistent page boxes,
- no blank pages,
- no clipped or overset text,
- no overlapping text/images/decoration,
- no off-page objects or unsafe-margin violations,
- no isolated headings or role headers,
- body/heading/name sizes remain within the contract,
- all fonts embedded,
- all expected glyphs render without boxes or substitutions,
- selectable text exists and extraction order matches the intended reading order,
- contact text remains machine-readable,
- hyperlinks are valid and visibly labeled,
- image resolution and photo aspect ratio pass,
- document metadata contains no internal IDs, prompts, or private processing data.

### Visual checks

- Render every page to PNG at 150-200 DPI.
- Inspect page edges, alignment, baseline rhythm, section transitions, and multi-page continuity.
- Detect unusually large internal whitespace regions, cramped regions, scattered blocks, and imbalanced final pages.
- Compare against approved golden renders for every template, page size, photo state, and short/medium/long content profile.
- Extract text from the final PDF and compare section order and required fields with the structured source.

### Acceptance thresholds

- Zero clipping, overlap, missing glyph, blank-page, or out-of-bounds findings.
- Zero unexplained empty content regions larger than 18% of the usable page area.
- Final non-terminal pages should normally use at least 76% of usable vertical space.
- A terminal page may be shorter when the remaining content is semantically indivisible, but it must be visually rebalanced and explicitly pass snapshot review.
- PDF render and extraction tests pass on Chromium/PDFium and Poppler before a template is released.

## Template release matrix

Every style must have golden fixtures for:

- A4 and US Letter,
- photograph on/off where supported,
- short, medium, long, and very long career histories,
- no-resume/manual profile,
- long names and contact details,
- projects/certifications/awards absent and present,
- multilingual Latin and Devanagari text,
- one, two, and three-page results where supported,
- matching cover letter with short and long recipient/company names.

Each fixture must pass structure, extraction, typography, whitespace, visual-diff, and human screenshot review before the style becomes customer-selectable.

