import { existsSync } from "node:fs";
import path from "node:path";
import React from "react";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CanonicalProfile } from "@successpro/contracts";
import { getDocumentTemplate, type DocumentTemplateId, type PageSize } from "@successpro/domain";
import type { ResumeSectionId } from "./document-request";
import { groupResumeExperience } from "./resume-experience-groups";

export type DocumentContact = {
  email: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  website?: string;
};

export type ResumeRenderInput = {
  profile: CanonicalProfile;
  contact: DocumentContact;
  templateId: DocumentTemplateId;
  pageSize?: PageSize;
  photoDataUri?: string;
  sectionOrder?: ResumeSectionId[];
};

export type CoverLetterRenderInput = ResumeRenderInput & {
  letter: {
    date: string;
    recipientName?: string;
    recipientTitle?: string;
    company: string;
    companyAddress?: string;
    targetRole: string;
    greeting: string;
    paragraphs: string[];
    closing: string;
  };
};

function resolveFontRoot() {
  const candidates = [path.join(process.cwd(), "apps/web/public/fonts"), path.join(process.cwd(), "public/fonts")];
  const root = candidates.find((candidate) => existsSync(candidate));
  if (!root) throw new Error("Document fonts are unavailable.");
  return root;
}

let fontsRegistered = false;
let documentRenderQueue: Promise<unknown> = Promise.resolve();

// The renderer mutates fontkit glyph mappings. Reusing a loaded custom font
// across different documents can corrupt both visible glyphs and ToUnicode.
// Keep font replacement and rendering atomic within this process.
function renderWithFreshFonts(render: () => Promise<Buffer>) {
  const pending = documentRenderQueue.then(async () => {
    const registered = Font.getRegisteredFonts();
    for (const family of ["Inter", "Source Sans 3", "Noto Sans", "Noto Sans Devanagari"]) delete registered[family];
    fontsRegistered = false;
    return render();
  });
  documentRenderQueue = pending.catch(() => undefined);
  return pending;
}
function registerFonts() {
  if (fontsRegistered) return;
  const root = resolveFontRoot();
  const registrations = [
    { family: "Inter", prefix: "inter" },
    { family: "Source Sans 3", prefix: "source-sans-3" },
    { family: "Noto Sans", prefix: "noto-sans" },
  ];
  for (const registration of registrations) {
    Font.register({
      family: registration.family,
      fonts: [
        { src: path.join(root, `${registration.prefix}-400.woff`), fontWeight: 400 },
        { src: path.join(root, `${registration.prefix}-600.woff`), fontWeight: 600 },
        { src: path.join(root, `${registration.prefix}-700.woff`), fontWeight: 700 },
      ],
    });
  }
  const devanagariFont = path.join(root, "noto-sans-devanagari-full.ttf");
  Font.register({
    family: "Noto Sans Devanagari",
    fonts: [
      { src: devanagariFont, fontWeight: 400 },
      { src: devanagariFont, fontWeight: 600 },
      { src: devanagariFont, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/[‐‑‒–—]/g, "-").replace(/\s+/g, " ").trim();
}

function initials(name: string) {
  return cleanText(name).split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function displayUrl(value?: string) {
  return cleanText(value).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function containsDevanagari(value: unknown) {
  return /[\u0900-\u097F]/.test(JSON.stringify(value));
}

function makeStyles(templateId: DocumentTemplateId, fontFamilyOverride?: "Noto Sans Devanagari") {
  const template = getDocumentTemplate(templateId);
  const fontFamily = fontFamilyOverride ?? template.typography.family;
  const editorial = templateId === "editorial";
  const signature = templateId === "signature";
  const momentum = templateId === "momentum";
  const base = StyleSheet.create({
    page: {
      paddingTop: 38,
      paddingBottom: 36,
      paddingHorizontal: 42,
      fontFamily,
      fontSize: template.typography.bodyPt,
      lineHeight: template.typography.lineHeight,
      color: template.accent.neutral,
      backgroundColor: "#FFFFFF",
    },
    header: {
      flexShrink: 0,
      marginBottom: 16,
      paddingBottom: 12,
      paddingTop: signature ? 12 : 0,
      paddingHorizontal: signature ? 12 : 0,
      backgroundColor: signature ? "#F3F5F8" : "transparent",
      borderBottomWidth: signature ? 2 : 0.9,
      borderBottomColor: template.accent.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
    },
    identity: { flexGrow: 1, flexShrink: 1 },
    name: { fontSize: template.typography.namePt, lineHeight: 1.2, fontWeight: 700, color: template.accent.primary, letterSpacing: editorial ? 0.6 : 0.15 },
    headline: { marginTop: 4, fontSize: template.typography.roleTitlePt, lineHeight: 1.2, fontWeight: 600, color: template.accent.secondary },
    contact: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 5 },
    contactItem: { fontSize: template.typography.metadataPt, color: template.accent.neutral },
    contactSeparator: { fontSize: template.typography.metadataPt, color: template.accent.secondary },
    photo: { width: 56, height: 56, objectFit: "cover", borderRadius: signature ? 6 : 28, borderWidth: 1.5, borderColor: template.accent.secondary },
    initials: { width: 48, height: 48, borderRadius: signature ? 5 : 24, backgroundColor: template.accent.primary, color: "#FFFFFF", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 },
    summary: { marginBottom: 8, paddingVertical: signature ? 10 : 0, paddingHorizontal: signature ? 12 : 0, backgroundColor: signature ? "#F3F5F8" : "transparent", borderLeftWidth: signature ? 2 : 0, borderLeftColor: template.accent.secondary },
    section: { marginTop: 13 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, minHeight: 14, paddingBottom: editorial ? 4 : 0, borderBottomWidth: editorial ? .5 : 0, borderBottomColor: "#D7DEE7" },
    sectionTitle: { fontSize: template.typography.sectionHeadingPt, lineHeight: 1.2, fontWeight: 700, color: template.accent.primary, letterSpacing: editorial ? 0.8 : 0.35, textTransform: "uppercase" },
    sectionRule: { flexGrow: 1, height: 1, backgroundColor: momentum ? template.accent.secondary : "#D7DEE7" },
    paragraph: { fontSize: template.typography.bodyPt, lineHeight: template.typography.lineHeight, textAlign: "justify" },
    role: { marginBottom: 10, paddingLeft: momentum ? 14 : 0, borderLeftWidth: momentum ? 1.2 : 0, borderLeftColor: "#C5D3E2" },
    denseRole: { marginBottom: 6 },
    roleHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 4 },
    roleTitle: { maxWidth: "72%", fontSize: template.typography.roleTitlePt, fontWeight: 700, color: template.accent.primary },
    inlineEmployer: { fontSize: template.typography.metadataPt, fontWeight: 400, color: template.accent.secondary },
    dates: { fontSize: template.typography.metadataPt, fontWeight: 600, color: template.accent.neutral, backgroundColor: momentum ? "#EDF2F8" : "transparent", paddingHorizontal: momentum ? 5 : 0, paddingVertical: momentum ? 2 : 0, borderRadius: 3 },
    employer: { marginBottom: 4, fontSize: template.typography.metadataPt, fontWeight: 600, color: template.accent.secondary },
    earlierRoles: { marginBottom: 10, paddingLeft: momentum ? 14 : 0, borderLeftWidth: momentum ? 1.2 : 0, borderLeftColor: "#C5D3E2" },
    earlierRoleTitle: { fontSize: template.typography.bodyPt, lineHeight: template.typography.lineHeight, color: template.accent.neutral },
    bulletRow: { flexDirection: "row", gap: 6, marginTop: 3.5, paddingLeft: 2 },
    bulletMark: { width: 7, fontSize: template.typography.bodyPt, fontWeight: 700, color: template.accent.secondary },
    bulletText: { flexGrow: 1, flexShrink: 1, fontSize: template.typography.bodyPt, lineHeight: template.typography.lineHeight, textAlign: "justify" },
    skillsGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 5 },
    skillItem: { width: "47%", flexDirection: "row", gap: 5, paddingVertical: signature || editorial ? 3 : 0, paddingHorizontal: signature || editorial ? 6 : 0, backgroundColor: signature || editorial ? "#F3F5F8" : "transparent", borderRadius: 3 },
    denseSkillItem: { paddingVertical: 0 },
    skillMark: { width: 7, color: template.accent.secondary, fontWeight: 700 },
    skillText: { flexGrow: 1, flexShrink: 1, fontSize: template.typography.bodyPt },
    twoColumn: { flexDirection: "row", gap: 20 },
    column: { flexGrow: 1, flexBasis: 0 },
    detail: { marginBottom: 8 },
    projectGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 3 },
    projectItem: { width: "47%", marginBottom: 8, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: "#C5D3E2" },
    detailTitle: { fontWeight: 700, color: template.accent.primary },
    detailMeta: { fontSize: template.typography.metadataPt, color: template.accent.neutral, marginTop: 1 },
    detailDescription: { marginTop: 2, fontSize: template.typography.bodyPt, lineHeight: template.typography.lineHeight, textAlign: "left" },
    link: { marginTop: 1, fontSize: 8, color: template.accent.primary, textDecoration: "none" },
    letterAddress: { marginTop: 4, marginBottom: 14 },
    letterAddressLine: { fontSize: 8.5 },
    letterAddressGap: { height: 8 },
    letterSubject: { marginBottom: 10, fontWeight: 700, color: template.accent.primary },
    letterParagraph: { marginBottom: 13, fontSize: 9, lineHeight: 1.28, textAlign: "justify" },
    letterClosing: { marginTop: 6 },
    footer: { position: "absolute", left: 42, right: 42, bottom: 12, paddingTop: 3, borderTopWidth: 0.4, borderTopColor: "#D7DEE7", fontFamily, fontSize: 8, color: "#64748B", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footerBrand: { color: template.accent.primary, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.25 },
    footerBadge: { width: 10, height: 10, marginRight: 3, borderRadius: 3, backgroundColor: "#F5C451", alignItems: "center", justifyContent: "center" },
    footerBadgeText: { color: "#07111F", fontSize: 7, fontWeight: 700 },
    footerName: { color: "#64748B", fontSize: 8 },
  });
  return { template, styles: base };
}

function ContactLine({ contact, styles }: { contact: DocumentContact; styles: ReturnType<typeof makeStyles>["styles"] }) {
  const values = [contact.email, contact.phone, contact.location, displayUrl(contact.linkedIn), displayUrl(contact.website)].filter(Boolean) as string[];
  return <View style={styles.contact}>{values.map((value, index) => <React.Fragment key={`${value}-${index}`}>{index > 0 && <Text style={styles.contactSeparator}>|</Text>}<Text style={styles.contactItem}>{cleanText(value)}</Text></React.Fragment>)}</View>;
}

function IdentityHeader({ input, compact = false }: { input: ResumeRenderInput; compact?: boolean }) {
  const { template, styles } = makeStyles(input.templateId, containsDevanagari(input) ? "Noto Sans Devanagari" : undefined);
  const showPhoto = !compact && template.photo === "optional" && input.photoDataUri;
  return <View style={styles.header} wrap={false}>
    <View style={styles.identity}>
      <Text style={styles.name}>{cleanText(input.profile.fullName)}</Text>
      {!compact && <Text style={styles.headline}>{cleanText(input.profile.headline)}</Text>}
      <ContactLine contact={input.contact} styles={styles} />
    </View>
    {/* React PDF images do not expose an HTML alt attribute in their type or PDF output. */}
    {/* eslint-disable-next-line jsx-a11y/alt-text */}
    {showPhoto ? <Image style={styles.photo} src={input.photoDataUri!} /> : (!compact && template.photo === "optional" ? <View style={styles.initials}><Text>{initials(input.profile.fullName)}</Text></View> : null)}
  </View>;
}

function SectionTitle({ children, styles }: React.PropsWithChildren<{ styles: ReturnType<typeof makeStyles>["styles"] }>) {
  return <View style={styles.sectionTitleRow} wrap={false} minPresenceAhead={54}><Text style={styles.sectionTitle}>{children}</Text><View style={styles.sectionRule} /></View>;
}

function ResumeSection({ children, style, minPresenceAhead = 0 }: React.PropsWithChildren<{ style: ReturnType<typeof makeStyles>["styles"]["section"]; minPresenceAhead?: number }>) {
  const entries = React.Children.toArray(children);
  const first = entries[1];
  // Keep a heading with the first indivisible education/credential/award
  // record. A heading-only presence hint cannot follow that record when
  // React PDF moves the record to the next page.
  if (React.isValidElement<{ wrap?: boolean }>(first) && first.props.wrap === false) {
    return <View style={style}><View wrap={false}>{entries[0]}{first}</View>{entries.slice(2)}</View>;
  }
  return <View style={style} minPresenceAhead={minPresenceAhead}>{children}</View>;
}

function Bullet({ children, styles, keepNext = false }: React.PropsWithChildren<{ styles: ReturnType<typeof makeStyles>["styles"]; keepNext?: boolean }>) {
  return <View style={styles.bulletRow} minPresenceAhead={keepNext ? 28 : 0}><Text style={styles.bulletMark}>-</Text><Text style={styles.bulletText}>{children}</Text></View>;
}

function ExperienceRole({ role, styles, dense = false, showEmployer = true }: { role: CanonicalProfile["experience"][number]; styles: ReturnType<typeof makeStyles>["styles"]; dense?: boolean; showEmployer?: boolean }) {
  const firstAchievement = role.achievements[0];
  return <View style={[styles.role, dense ? styles.denseRole : {}]}>
    <View wrap={false}>
      <View style={styles.roleHeader}><Text style={styles.roleTitle}>{cleanText(role.title)}{!showEmployer && <Text style={styles.inlineEmployer}> | {cleanText(role.employer)}</Text>}</Text><Text style={styles.dates}>{cleanText([role.startDate, role.endDate].filter(Boolean).join(" - "))}</Text></View>
      {showEmployer && <Text style={styles.employer}>{cleanText(role.employer)}</Text>}
      {firstAchievement && <Bullet styles={styles}>{cleanText(firstAchievement)}</Bullet>}
    </View>
    {role.achievements.slice(1).map((achievement) => <Bullet styles={styles} key={achievement}>{cleanText(achievement)}</Bullet>)}
  </View>;
}

function ExperienceEntries({ roles, styles }: { roles: CanonicalProfile["experience"]; styles: ReturnType<typeof makeStyles>["styles"] }) {
  const groups = groupResumeExperience(roles);
  const dense = roles.length >= 12;
  return <>{groups.map((group, index) => {
    const previous = groups[index - 1];
    return group.kind === "role"
    ? <ExperienceRole role={group.role} styles={styles} dense={dense} showEmployer={!dense || index % 5 === 0 || !previous || previous.kind !== "role" || previous.role.employer.trim().toLowerCase() !== group.role.employer.trim().toLowerCase()} key={group.role.id} />
    : <View style={styles.earlierRoles} key={group.roles[0].id}>
      <View wrap={false}><Text style={styles.roleTitle}>Earlier roles</Text><Text style={styles.employer}>{cleanText(group.employer)}</Text><Bullet styles={styles}>{cleanText(group.roles[0].title)}</Bullet></View>
      {group.roles.slice(1).map((role) => <Bullet styles={styles} key={role.id}>{cleanText(role.title)}</Bullet>)}
    </View>;
  })}</>;
}

function ProjectDetails({ projects, styles }: { projects: CanonicalProfile["projects"]; styles: ReturnType<typeof makeStyles>["styles"] }) {
  return <View style={styles.projectGrid}>{projects.map((project) => <View style={styles.projectItem} key={project.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(project.name)}</Text>{project.description && <Text style={styles.detailDescription}>{cleanText(project.description)}</Text>}{project.link && <Link style={styles.link} src={project.link}>{displayUrl(project.link)}</Link>}</View>)}</View>;
}

function ProjectsSection({ projects, styles }: { projects: CanonicalProfile["projects"]; styles: ReturnType<typeof makeStyles>["styles"] }) {
  const [first, ...rest] = projects;
  if (!first) return null;
  return <View style={styles.section}>
    <View wrap={false}>
      <SectionTitle styles={styles}>Selected projects</SectionTitle>
      <ProjectDetails projects={[first]} styles={styles} />
    </View>
    {rest.length > 0 && <ProjectDetails projects={rest} styles={styles} />}
  </View>;
}

function LinksSection({ links, styles }: { links: CanonicalProfile["links"]; styles: ReturnType<typeof makeStyles>["styles"] }) {
  const [first, ...rest] = links;
  if (!first) return null;
  return <View style={styles.section}>
    <View wrap={false}><SectionTitle styles={styles}>Professional links</SectionTitle><Link style={styles.link} src={first.url}>{cleanText(first.label)}: {displayUrl(first.url)}</Link></View>
    {rest.map((item) => <Link style={styles.link} src={item.url} key={item.id}>{cleanText(item.label)}: {displayUrl(item.url)}</Link>)}
  </View>;
}

function OrderedResumeSection({ input, section }: { input: ResumeRenderInput; section: ResumeSectionId }) {
  const { profile } = input;
  const { styles } = makeStyles(input.templateId, containsDevanagari(input) ? "Noto Sans Devanagari" : undefined);
  if (section === "summary") return profile.summary ? <ResumeSection style={styles.section} minPresenceAhead={45}><SectionTitle styles={styles}>Professional summary</SectionTitle><Text style={styles.paragraph}>{cleanText(profile.summary)}</Text></ResumeSection> : null;
  if (section === "skills") return profile.skills.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Core skills</SectionTitle><View style={styles.skillsGrid}>{profile.skills.map((skill) => <View style={[styles.skillItem, profile.experience.length >= 12 ? styles.denseSkillItem : {}]} key={skill}><Text style={styles.skillMark}>-</Text><Text style={styles.skillText}>{cleanText(skill)}</Text></View>)}</View></ResumeSection> : null;
  if (section === "experience") return profile.experience.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Professional experience</SectionTitle><ExperienceEntries roles={profile.experience} styles={styles} /></ResumeSection> : null;
  if (section === "projects") return <ProjectsSection projects={profile.projects} styles={styles} />;
  if (section === "education") return profile.education.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Education</SectionTitle>{profile.education.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.qualification)}</Text><Text style={styles.detailMeta}>{cleanText(item.institution)}</Text><Text style={styles.detailMeta}>{cleanText([item.startDate, item.endDate].filter(Boolean).join(" - "))}</Text></View>)}</ResumeSection> : null;
  if (section === "certifications") return profile.certifications.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Certifications</SectionTitle>{profile.certifications.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.name)}</Text><Text style={styles.detailMeta}>{cleanText([item.issuer, item.date].filter(Boolean).join(" | "))}</Text>{item.credentialUrl && <Link style={styles.link} src={item.credentialUrl}>Credential</Link>}</View>)}</ResumeSection> : null;
  if (section === "awards") return profile.awards.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Awards &amp; achievements</SectionTitle>{profile.awards.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.title)}</Text><Text style={styles.detailMeta}>{cleanText([item.kind === "award" ? "Award" : item.kind === "achievement" ? "Achievement" : "", item.issuer, item.date].filter(Boolean).join(" | "))}</Text>{item.description && <Text style={styles.detailDescription}>{cleanText(item.description)}</Text>}</View>)}</ResumeSection> : null;
  if (section === "languages") return profile.languages.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Languages</SectionTitle><Text>{profile.languages.map(cleanText).join(" | ")}</Text></ResumeSection> : null;
  if (section === "links") return <LinksSection links={profile.links} styles={styles} />;
  if (section === "publications") return profile.publications.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Publications</SectionTitle>{profile.publications.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.title)}</Text><Text style={styles.detailMeta}>{cleanText([item.publisher, item.date].filter(Boolean).join(" | "))}</Text>{item.link && <Link style={styles.link} src={item.link}>{displayUrl(item.link)}</Link>}</View>)}</ResumeSection> : null;
  return profile.volunteerExperience.length ? <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Volunteer experience</SectionTitle>{profile.volunteerExperience.map((item) => <View style={styles.detail} key={item.id} minPresenceAhead={34}><View style={styles.roleHeader}><Text style={styles.detailTitle}>{cleanText(item.role)}</Text><Text style={styles.dates}>{cleanText([item.startDate, item.endDate].filter(Boolean).join(" - "))}</Text></View><Text style={styles.detailMeta}>{cleanText(item.organization)}</Text>{item.description && <Text style={styles.detailDescription}>{cleanText(item.description)}</Text>}</View>)}</ResumeSection> : null;
}

function ResumeSections({ input }: { input: ResumeRenderInput }) {
  const { profile } = input;
  const { styles } = makeStyles(input.templateId, containsDevanagari(input) ? "Noto Sans Devanagari" : undefined);
  if (input.sectionOrder?.length) return <>{input.sectionOrder.map((section) => <OrderedResumeSection input={input} section={section} key={section} />)}</>;
  return <>
    {profile.summary && <View style={styles.summary} minPresenceAhead={45}><SectionTitle styles={styles}>Professional profile</SectionTitle><Text style={styles.paragraph}>{cleanText(profile.summary)}</Text></View>}

    {!!profile.skills.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Core skills</SectionTitle><View style={styles.skillsGrid}>{profile.skills.map((skill) => <View style={[styles.skillItem, profile.experience.length >= 12 ? styles.denseSkillItem : {}]} key={skill}><Text style={styles.skillMark}>-</Text><Text style={styles.skillText}>{cleanText(skill)}</Text></View>)}</View></ResumeSection>}

    {!!profile.experience.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Professional experience</SectionTitle><ExperienceEntries roles={profile.experience} styles={styles} /></ResumeSection>}

    <ProjectsSection projects={profile.projects} styles={styles} />

    {!!profile.education.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Education</SectionTitle>{profile.education.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.qualification)}</Text><Text style={styles.detailMeta}>{cleanText(item.institution)}</Text><Text style={styles.detailMeta}>{cleanText([item.startDate, item.endDate].filter(Boolean).join(" - "))}</Text></View>)}</ResumeSection>}
    {!!profile.certifications.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Certifications</SectionTitle>{profile.certifications.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.name)}</Text><Text style={styles.detailMeta}>{cleanText([item.issuer, item.date].filter(Boolean).join(" | "))}</Text>{item.credentialUrl && <Link style={styles.link} src={item.credentialUrl}>Credential</Link>}</View>)}</ResumeSection>}
    {!!profile.awards.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Awards &amp; achievements</SectionTitle>{profile.awards.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.title)}</Text><Text style={styles.detailMeta}>{cleanText([item.kind === "award" ? "Award" : item.kind === "achievement" ? "Achievement" : "", item.issuer, item.date].filter(Boolean).join(" | "))}</Text>{item.description && <Text style={styles.detailDescription}>{cleanText(item.description)}</Text>}</View>)}</ResumeSection>}
    {!!profile.languages.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Languages</SectionTitle><Text>{profile.languages.map(cleanText).join(" | ")}</Text></ResumeSection>}
    <LinksSection links={profile.links} styles={styles} />
    {!!profile.publications.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Publications</SectionTitle>{profile.publications.map((item) => <View style={styles.detail} key={item.id} wrap={false}><Text style={styles.detailTitle}>{cleanText(item.title)}</Text><Text style={styles.detailMeta}>{cleanText([item.publisher, item.date].filter(Boolean).join(" | "))}</Text>{item.link && <Link style={styles.link} src={item.link}>{displayUrl(item.link)}</Link>}</View>)}</ResumeSection>}
    {!!profile.volunteerExperience.length && <ResumeSection style={styles.section} minPresenceAhead={0}><SectionTitle styles={styles}>Volunteer experience</SectionTitle>{profile.volunteerExperience.map((item) => <View style={styles.detail} key={item.id} minPresenceAhead={34}><View style={styles.roleHeader}><Text style={styles.detailTitle}>{cleanText(item.role)}</Text><Text style={styles.dates}>{cleanText([item.startDate, item.endDate].filter(Boolean).join(" - "))}</Text></View><Text style={styles.detailMeta}>{cleanText(item.organization)}</Text>{item.description && <Text style={styles.detailDescription}>{cleanText(item.description)}</Text>}</View>)}</ResumeSection>}
  </>;
}

function StaticFooter({ name, styles }: { name: string; styles: ReturnType<typeof makeStyles>["styles"] }) {
  return <View style={styles.footer} fixed><View style={{ flexDirection: "row", alignItems: "center" }}><View style={styles.footerBadge}><Text style={styles.footerBadgeText}>S</Text></View><Text style={styles.footerBrand}>SuccessPro</Text></View><Text style={styles.footerName}>{cleanText(name)}</Text></View>;
}

export function ResumePdfDocument({ input }: { input: ResumeRenderInput }) {
  registerFonts();
  const { styles } = makeStyles(input.templateId, containsDevanagari(input) ? "Noto Sans Devanagari" : undefined);
  return <Document title={`${cleanText(input.profile.fullName)} - Resume`} author={cleanText(input.profile.fullName)} subject="Professional resume" creator="SuccessPro" producer="SuccessPro PDF Renderer" keywords="resume, professional profile">
    <Page size={input.pageSize === "letter" ? "LETTER" : "A4"} style={styles.page} wrap>
      <IdentityHeader input={input} />
      <ResumeSections input={input} />
    </Page>
  </Document>;
}

export function CoverLetterPdfDocument({ input }: { input: CoverLetterRenderInput }) {
  registerFonts();
  const { template, styles } = makeStyles(input.templateId, containsDevanagari(input) ? "Noto Sans Devanagari" : undefined);
  const addressee = [input.letter.recipientName, input.letter.recipientTitle, input.letter.company, input.letter.companyAddress].filter(Boolean).map(cleanText);
  return <Document title={`${cleanText(input.profile.fullName)} - Cover letter`} author={cleanText(input.profile.fullName)} subject={`Application for ${cleanText(input.letter.targetRole)}`} creator="SuccessPro" producer="SuccessPro PDF Renderer" keywords="cover letter, job application">
    <Page size={input.pageSize === "letter" ? "LETTER" : "A4"} style={styles.page} wrap>
      <IdentityHeader input={input} />
      <View style={styles.letterAddress}>
        <Text style={styles.letterAddressLine}>{cleanText(input.letter.date)}</Text>
        <View style={styles.letterAddressGap} />
        {addressee.map((line, index) => <Text style={styles.letterAddressLine} key={`${line}-${index}`}>{line}</Text>)}
      </View>
      <Text style={styles.letterSubject}>Re: {cleanText(input.letter.targetRole)}</Text>
      <Text style={styles.letterParagraph}>{cleanText(input.letter.greeting)}</Text>
      {input.letter.paragraphs.map((paragraph, index) => <Text style={styles.letterParagraph} key={index} orphans={2} widows={2}>{cleanText(paragraph)}</Text>)}
      <View style={styles.letterClosing} wrap={false}><Text style={styles.paragraph}>{cleanText(input.letter.closing)}</Text><Text style={[styles.paragraph, { marginTop: 13, fontWeight: 700, color: template.accent.primary }]}>{cleanText(input.profile.fullName)}</Text></View>
      <StaticFooter name={input.profile.fullName} styles={styles} />
    </Page>
  </Document>;
}

export async function renderResumePdf(input: ResumeRenderInput) {
  return renderWithFreshFonts(async () => Buffer.from(await renderToBuffer(<ResumePdfDocument input={input} />)));
}

export async function renderCoverLetterPdf(input: CoverLetterRenderInput) {
  return renderWithFreshFonts(async () => Buffer.from(await renderToBuffer(<CoverLetterPdfDocument input={input} />)));
}
