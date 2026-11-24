# Regional jobs, salary, and learning sources

Last reviewed: 2026-09-24

SuccessPro separates source retrieval from AI interpretation. Connectors retrieve and normalize only data whose official API, feed, partner agreement, or employer-controlled ATS endpoint permits that use. AI never scrapes a job board. It receives a bounded set of normalized, already-approved records and ranks them against the member's confirmed profile, roles, skills, work modes, and up to five location preferences.

## Job-source policy

- Only postings with a valid publication date within the preceding 30 days may enter a customer feed.
- Each result retains source name, canonical apply URL, publication date, last-seen date, geography, and available salary text.
- Closed, disappeared, duplicate, undated, future-dated, or older postings are excluded.
- The apply action always returns the member to the original source.
- Country selection determines the regional connector configuration; city/state/region choices refine matching after ingestion and, where supported, the provider request itself.

Approved connector families currently implemented:

| Source | Coverage | Access | Notes |
| --- | --- | --- | --- |
| Employer Greenhouse boards | Global/employer-specific | Public board API | Employer-controlled listings |
| Employer Lever boards | Global/employer-specific | Public postings API | Employer-controlled listings |
| USAJOBS | United States | Registered official API | Public federal opportunities; source attribution and return link retained |
| Adzuna | Country-specific, including India where the account permits | Registered official API | Search requests enforce `max_days_old=30`; regional keywords/location are configured per source |
| Bright Data Google Jobs | Optional worldwide discovery channel | Third-party SERP API; requires documented terms/legal approval before activation | Hard shared monthly ceiling below the free allowance; skipped silently when unavailable or exhausted; original HTTPS application URL retained |
| SuccessPro verified recruiters | Worldwide, based on recruiter-entered location | First-party postings after organization and identity due diligence | Candidates browse with role, department, location, experience and CTC filters and apply only with their SuccessPro profile |

Google Jobs is never the sole source and is disabled by default. SuccessPro continues with approved public feeds, government sources, employer-controlled career pages, and verified recruiter postings when Google-derived results are unavailable. Provider failures are not exposed to candidates.

Indeed exposes partner integrations, and access is subject to its partner program. Naukri and other commercial boards are not scraped or reverse engineered. They can be activated only after SuccessPro receives documented API/feed/partner permission. Until then, India coverage should use approved Adzuna access plus employer-controlled Greenhouse/Lever boards, with further licensed sources added through the same connector contract.

Google Jobs discovery links are generated from each saved role/location combination plus the member's experience and keywords and open in Google's own interface. Result cards are not copied into SuccessPro: Google states that automated queries or scraping Search without express permission violate its policies, and Google does not expose a public Google Jobs results API for this product use. Dashboard cards therefore continue to come from approved source connectors; a future Google-results provider must pass legal/vendor review before activation.

## Salary research policy

Salary benchmarks must combine sources relevant to the member's current role, responsibilities, experience, industry, employer size, and present-job geography. Values are normalized to the local market currency, dated, and shown as a range with source count and confidence. SuccessPro labels the result as market research—not a guarantee or compensation advice—and does not invent a value when sufficient comparable evidence is unavailable. Future customer-derived benchmarks must be aggregated, minimum-cohort protected, de-identified, and displayed separately from external market evidence.

## Learning-source policy

The member's confirmed profile and career goal determine functional and technical gaps. AI may rank only the current, source-backed course records supplied to it; it cannot invent providers, courses, prices, credentials, or availability. Recommendations retain provider URL, last verification date, price/free status, duration, geography/language, credential type, and an availability caveat. Current sources include official Microsoft Learn, IBM SkillsBuild, Government of India SWAYAM, NPTEL, AWS Skill Builder, and Google Career Certificates pages.
