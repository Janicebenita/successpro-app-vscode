import JSZip from "jszip";
import { editorialStyle } from "./editorial-style";
import { getDocumentTemplate } from "@successpro/domain";
import type { CoverLetterRenderInput, ResumeRenderInput } from "./document-renderer";
import type { ResumeSectionId } from "./document-request";
import { groupResumeExperience } from "./resume-experience-groups";

const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clean = (value: unknown) => editorialStyle(String(value ?? "")).replace(/\s+/g, " ").trim();
const halfPoints = (points: number) => Math.round(points * 2);
const fontName = (family: string) => family === "Source Sans 3" ? "Source Sans 3" : family;

function run(text: unknown, options: { bold?: boolean; size?: number; color?: string; font?: string } = {}) {
  const properties = `<w:rPr>${options.bold ? "<w:b/>" : ""}${options.font ? `<w:rFonts w:ascii="${esc(options.font)}" w:hAnsi="${esc(options.font)}" w:cs="${esc(options.font)}"/>` : ""}${options.color ? `<w:color w:val="${options.color.replace("#", "")}"/>` : ""}${options.size ? `<w:sz w:val="${halfPoints(options.size)}"/><w:szCs w:val="${halfPoints(options.size)}"/>` : ""}</w:rPr>`;
  // Preserve intentional inter-run spacing, for example a bold title followed
  // by a normal-weight separator. Trimming each run glues those words together.
  const value = editorialStyle(String(text ?? "")).replace(/\s+/g, " ");
  return `<w:r>${properties}<w:t xml:space="preserve">${esc(value)}</w:t></w:r>`;
}

function paragraph(content: string, options: { style?: string; after?: number; before?: number; keepNext?: boolean; bullet?: boolean } = {}) {
  return `<w:p><w:pPr>${options.style ? `<w:pStyle w:val="${options.style}"/>` : ""}<w:widowControl/>${options.keepNext ? "<w:keepNext/><w:keepLines/>" : ""}${options.bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ""}<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 80}"/></w:pPr>${content}</w:p>`;
}

function section(title: string) { return paragraph(run(title.toUpperCase()), { style: "SectionHeading", before: 260, after: 120, keepNext: true }); }
function linkText(value?: string) { return clean(value).replace(/^https?:\/\//, "").replace(/\/$/, ""); }

function packageDocx(body: string, input: ResumeRenderInput, title: string) {
  const template = getDocumentTemplate(input.templateId); const page = input.pageSize === "letter" ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 };
  const font = fontName(template.typography.family); const primary = template.accent.primary.replace("#", ""); const secondary = template.accent.secondary.replace("#", "");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(input.profile.fullName)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${esc(font)}" w:hAnsi="${esc(font)}"/><w:sz w:val="${halfPoints(template.typography.bodyPt)}"/><w:color w:val="${template.accent.neutral.replace("#", "")}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="${Math.round(template.typography.lineHeight * 240)}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="${primary}"/><w:sz w:val="${halfPoints(template.typography.namePt)}"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Headline"><w:name w:val="Headline"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="${secondary}"/><w:sz w:val="${halfPoints(template.typography.roleTitlePt)}"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="100" w:after="45"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="${secondary}"/></w:pBdr></w:pPr><w:rPr><w:b/><w:color w:val="${primary}"/><w:sz w:val="${halfPoints(template.typography.sectionHeadingPt)}"/></w:rPr></w:style></w:styles>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="${page.width}" w:h="${page.height}"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function header(input: ResumeRenderInput) { const contact = [input.contact.email, input.contact.phone, input.contact.location, linkText(input.contact.linkedIn), linkText(input.contact.website)].filter(Boolean).join(" | "); return paragraph(run(input.profile.fullName), { style: "Name", after: 20 }) + paragraph(run(input.profile.headline), { style: "Headline", after: 25 }) + paragraph(run(contact), { after: 90 }); }

function resumeSectionDocx(profile: ResumeRenderInput["profile"], id: ResumeSectionId) {
  if (id === "summary") return profile.summary ? section("Professional summary") + paragraph(run(profile.summary), { after: 70 }) : "";
  if (id === "skills") return profile.skills.length ? section("Core skills") + paragraph(run(profile.skills.join(" | ")), { after: 65 }) : "";
  if (id === "experience") return profile.experience.length ? section("Professional experience") + groupResumeExperience(profile.experience).map((group, groupIndex) => group.kind === "earlier-roles"
    ? paragraph(run("Earlier roles", { bold: true }), { keepNext: true, before: groupIndex ? 160 : 0, after: 50 }) + paragraph(run(group.employer), { keepNext: true, after: 50 }) + group.roles.map((role) => paragraph(run(role.title), { bullet: true, after: 35 })).join("")
    : paragraph(run([group.role.title, [group.role.startDate, group.role.endDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | "), { bold: true }), { keepNext: true, before: groupIndex ? 160 : 0, after: 60 }) + paragraph(run(group.role.employer), { keepNext: !!group.role.achievements.length, after: 80 }) + group.role.achievements.map((achievement) => paragraph(run(achievement), { bullet: true, after: 70 })).join("")).join("") : "";
  if (id === "projects") return profile.projects.length ? section("Selected projects") + profile.projects.map((item) => paragraph(run(item.name, { bold: true }), { keepNext: !!(item.description || item.link), after: 60 }) + (item.description ? paragraph(run(item.description), { after: 80 }) : "") + (item.link ? paragraph(run(item.link), { after: 80 }) : "")).join("") : "";
  if (id === "education") return profile.education.length ? section("Education") + profile.education.map((item) => paragraph(run(`${item.qualification} | ${item.institution} | ${[item.startDate, item.endDate].filter(Boolean).join(" - ")}`, { bold: true }), { after: 35 })).join("") : "";
  if (id === "certifications") return profile.certifications.length ? section("Certifications") + profile.certifications.map((item) => paragraph(run(`${item.name} | ${[item.issuer, item.date].filter(Boolean).join(" | ")}`, { bold: true }), { keepNext: !!item.credentialUrl, after: 80 }) + (item.credentialUrl ? paragraph(run(item.credentialUrl), { after: 80 }) : "")).join("") : "";
  if (id === "awards") return profile.awards.length ? section("Awards & achievements") + profile.awards.map((item) => paragraph(run(item.title, { bold: true }) + run(` | ${[item.kind === "award" ? "Award" : item.kind === "achievement" ? "Achievement" : "", item.issuer, item.date].filter(Boolean).join(" | ")}`), { keepNext: !!item.description, after: 60 }) + (item.description ? paragraph(run(item.description), { after: 80 }) : "")).join("") : "";
  if (id === "languages") return profile.languages.length ? section("Languages") + paragraph(run(profile.languages.join(" | "))) : "";
  if (id === "publications") return profile.publications.length ? section("Publications") + profile.publications.map((item) => paragraph(run(item.title, { bold: true }) + run(` | ${[item.publisher, item.date].filter(Boolean).join(" | ")}`), { keepNext: !!item.link, after: 80 }) + (item.link ? paragraph(run(item.link), { after: 80 }) : "")).join("") : "";
  if (id === "volunteer") return profile.volunteerExperience.length ? section("Volunteer experience") + profile.volunteerExperience.map((item) => paragraph(run(item.role, { bold: true }) + run(` | ${item.organization} | ${[item.startDate, item.endDate].filter(Boolean).join(" - ")}`), { keepNext: !!item.description, after: 60 }) + (item.description ? paragraph(run(item.description), { after: 80 }) : "")).join("") : "";
  return profile.links.length ? section("Professional links") + profile.links.map((item) => paragraph(run(`${item.label}: ${linkText(item.url)}`), { after: 20 })).join("") : "";
}

export async function renderResumeDocx(input: ResumeRenderInput) {
  // Default and customer-ordered exports share one renderer so fields cannot
  // disappear merely because the customer has not reordered their sections.
  const order: ResumeSectionId[] = input.sectionOrder?.length ? input.sectionOrder : ["summary", "skills", "experience", "projects", "education", "certifications", "awards", "languages", "links", "publications", "volunteer"];
  const body = header(input) + order.map((id) => resumeSectionDocx(input.profile, id)).join("");
  return packageDocx(body, input, `${input.profile.fullName} Resume`);
}

export async function renderCoverLetterDocx(input: CoverLetterRenderInput) {
  const address = [input.letter.date, "", input.letter.recipientName, input.letter.recipientTitle, input.letter.company, input.letter.companyAddress].map((line) => paragraph(run(line), { after: line ? 15 : 80 })).join("");
  let body = header(input) + address + paragraph(run(`Re ${input.letter.targetRole}`, { bold: true }), { after: 110 }) + paragraph(run(input.letter.greeting), { after: 90 });
  body += input.letter.paragraphs.map((value) => paragraph(run(value), { after: 260 })).join("");
  body += paragraph(run(input.letter.closing), { keepNext: true, after: 180 }) + paragraph(run(input.profile.fullName, { bold: true }));
  return packageDocx(body, input, `${input.profile.fullName} Cover Letter`);
}
