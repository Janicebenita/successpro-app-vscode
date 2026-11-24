import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { detectResumeSourceLanguage, extractDocxResume, itemsToReadingOrder } from "./resume-extraction";

async function makeDocx(documentXml: string, stylesXml = "", appXml = "<Properties><Pages>2</Pages></Properties>") {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>");
  zip.file("_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>");
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"/>");
  zip.file("word/styles.xml", stylesXml);
  zip.file("docProps/app.xml", appXml);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("Word resume extraction", () => {
  it("extracts text and detects DOCX page, column, table, margin, colour, and type-size risks", async () => {
    const repeated = "Experienced product leader delivering measurable outcomes across international teams. ".repeat(3);
    const document = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${repeated}</w:t></w:r></w:p><w:tbl/><w:tbl/><w:sectPr><w:cols w:num="2"/><w:pgMar w:left="500" w:right="1600"/></w:sectPr></w:body></w:document>`;
    const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style><w:rPr><w:sz w:val="14"/><w:color w:val="112233"/><w:color w:val="223344"/><w:color w:val="334455"/><w:color w:val="445566"/><w:color w:val="556677"/></w:rPr></w:style></w:styles>`;
    const result = await extractDocxResume(await makeDocx(document, styles));
    expect(result.text.length).toBeGreaterThan(80);
    expect(result.pageCount).toBe(2);
    expect(result.layout).toMatchObject({ multiColumn: true, tableHeavy: true, inconsistentMargins: true, excessiveColor: true, smallText: true });
  });
});

describe("resume source-language detection", () => {
  it("records the source script without translating or changing resume text", () => {
    expect(detectResumeSourceLanguage("Professional Experience\nSkills\nEducation")).toBe("en");
    expect(detectResumeSourceLanguage("कार्य अनुभव\nकौशल\nशिक्षा और उपलब्धियां")).toBe("hi");
    expect(detectResumeSourceLanguage("خبرة مهنية ومهارات وتعليم")).toBe("ar");
  });
});

describe("PDF reading order", () => {
  it("keeps a full-width header together when PDF styling divides it into fragments", () => {
    const item = (str: string, x: number, y: number, width = 60) => ({ str, width, height: 10, transform: [1, 0, 0, 10, x, y] });
    const text = itemsToReadingOrder([
      item("Career", 20, 780, 140), item("leadership", 163, 780, 150), item("profile", 316, 780, 130),
      ...[740, 720, 700, 680].flatMap((y) => [item(`Left ${y}`, 20, y), item(`Right ${y}`, 320, y)]),
    ], 600, true);
    expect(text.startsWith("Career leadership profile\nLeft 740")).toBe(true);
  });
  it("does not move styled fragments of the left column into the right column", () => {
    const item = (str: string, x: number, y: number) => ({ str, width: 45, height: 10, transform: [1, 0, 0, 10, x, y] });
    const text = itemsToReadingOrder([
      item("Director", 40, 740), item("2022", 220, 740), item("Employer", 40, 720), item("Left detail", 40, 700), item("More left", 40, 680),
      item("AWARDS", 320, 740), item("Award one", 320, 720), item("Award two", 320, 700), item("Award three", 320, 680),
    ], 600, true);
    expect(text).toContain("Director 2022\nEmployer");
    expect(text.indexOf("2022")).toBeLessThan(text.indexOf("AWARDS"));
  });
  it("keeps right-aligned dates near their roles when full-width text separates sections", () => {
    const item = (str: string, x: number, y: number, width = 70) => ({ str, width, height: 10, transform: [1, 0, 0, 10, x, y] });
    const text = itemsToReadingOrder([
      item("Director", 40, 740), item("2022 - Present", 450, 740), item("First employer", 40, 725),
      item("A full-width achievement describing the role and its measured impact.", 40, 710, 510),
      item("Manager", 40, 680), item("2018 - 2022", 450, 680), item("Second employer", 40, 665),
      item("Another full-width achievement with verified responsibilities and results.", 40, 650, 510),
    ], 600, true);
    expect(text.indexOf("2022 - Present")).toBeLessThan(text.indexOf("Manager"));
    expect(text.indexOf("2018 - 2022")).toBeGreaterThan(text.indexOf("Manager"));
  });
  it("reads each detected column from top to bottom instead of mixing rows", () => {
    const item = (str: string, x: number, y: number) => ({ str, width: 70, height: 10, transform: [1, 0, 0, 10, x, y] });
    const text = itemsToReadingOrder([
      item("PROFILE", 240, 740), item("Summary", 240, 720), item("EXPERIENCE", 240, 680), item("Director", 240, 660),
      item("CONTACT", 40, 740), item("Hyderabad", 40, 720), item("SKILLS", 40, 680), item("Product Management", 40, 660),
    ], 600, true);
    expect(text).toBe("CONTACT\nHyderabad\nSKILLS\nProduct Management\nPROFILE\nSummary\nEXPERIENCE\nDirector");
  });
});
