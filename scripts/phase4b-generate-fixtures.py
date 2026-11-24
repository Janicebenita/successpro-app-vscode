"""Phase 4B: Generate comprehensive synthetic test resumes with layout, date, and metric variants."""
import hashlib
import json
from pathlib import Path
import fitz

root = Path(r"D:\successpro-app-vscode")
out_dir = root / ".local/phase4b/fixtures"
out_dir.mkdir(parents=True, exist_ok=True)

fixtures = {}

# 1. POOR: Single-column, missing dates, missing contact, vague claims
text_poor = """SYNTHETIC TEST FIXTURE — POOR QUALITY
UNKNOWN APPLICANT

PROFILE
Enthusiastic hard worker looking for opportunities in technology. Great at everything and quick learner.

EXPERIENCE
Software Worker
Did coding and worked with teams on various projects. Helped customers and fixed computer bugs.

Assistant
Responsible for general assistance and answering questions.

SKILLS
Computers, Coding, Fast Learner, Hard Worker, Good Attitude

EDUCATION
High School Diploma
General Studies
"""

doc_poor = fitz.open()
page1 = doc_poor.new_page(width=595, height=842) # A4
page1.insert_textbox(fitz.Rect(50, 50, 545, 790), text_poor, fontsize=10.5)
path_poor = out_dir / "poor_singlecol_nodates_nocontact.pdf"
doc_poor.save(path_poor)
doc_poor.close()
fixtures["poor_singlecol_nodates_nocontact"] = {
    "pdf": str(path_poor),
    "sha256": hashlib.sha256(path_poor.read_bytes()).hexdigest(),
    "pages": 1,
    "layout": "single-column",
    "defects": ["missing_dates", "missing_contact", "vague_claims", "no_metrics"]
}

# 2. AVERAGE: Two-column layout, 2 pages, overlapping employment dates
# Page 1: Header + 2 columns (sidebar & main)
doc_mid = fitz.open()
p1 = doc_mid.new_page(width=595, height=842)

# Header
header_text = "JORDAN TAYLOR\nOperations & Systems Analyst\nEmail: jordan.taylor@example.test | Phone: +1 555 0199\nLocation: Chicago, IL"
p1.insert_textbox(fitz.Rect(50, 40, 545, 100), header_text, fontsize=11)

# Sidebar (Left column: x=50 to 190)
sidebar_p1 = """CORE SKILLS
• SQL & Database Queries
• Spreadsheet Reporting
• Jira & ServiceNow
• Incident Triage
• Process Documentation

EDUCATION
B.S. Information Systems
Illinois Tech, 2019

CERTIFICATIONS
ITIL Foundation v4 (2020)
"""
p1.insert_textbox(fitz.Rect(50, 110, 190, 790), sidebar_p1, fontsize=9.5)

# Main Content (Right column: x=210 to 545)
main_p1 = """PROFESSIONAL SUMMARY
Systems Analyst with over 5 years of experience supporting enterprise application workflows, recurring service reporting, and cross-functional incident resolution.

WORK EXPERIENCE
Senior Systems Analyst — Apex Logistics Solutions
Chicago, IL | Jan 2022 - Present
• Monitored daily data pipeline jobs and coordinated incident remediation across 4 logistics hubs.
• Prepared recurring operational status reports for department management.
• Automated weekly exception auditing spreadsheets, reducing report generation time.

Operations Analyst — Midwest Freight Partners
Chicago, IL | Mar 2021 - Dec 2023
• Managed service desk tickets and performed tier-2 troubleshooting for internal booking platforms.
• Resolved recurring database connectivity discrepancies across logistics systems.
• Documented standard operating procedures for new support team hires.
"""
p1.insert_textbox(fitz.Rect(210, 110, 545, 790), main_p1, fontsize=9.5)

# Page 2: Continued experience & projects
p2 = doc_mid.new_page(width=595, height=842)
# Sidebar (Left column: x=50 to 190)
sidebar_p2 = """LANGUAGES
English (Native)
Spanish (Intermediate)

INTERESTS
Cloud Infrastructure
Logistics Optimization
"""
p2.insert_textbox(fitz.Rect(50, 50, 190, 790), sidebar_p2, fontsize=9.5)

# Main Content (Right column: x=210 to 545)
main_p2 = """WORK EXPERIENCE (CONTINUED)
Junior Support Specialist — CoreTech Helpdesk
Peoria, IL | Jun 2019 - Feb 2021
• Provided phone and ticket support for 250 local users.
• Administered Active Directory accounts and password resets.

KEY PROJECTS
Warehouse Inventory Synchronization (2023)
Assisted in migrating legacy SQL queries to Postgres reporting views, improving daily query consistency.
"""
p2.insert_textbox(fitz.Rect(210, 50, 545, 790), main_p2, fontsize=9.5)

path_mid = out_dir / "average_twocol_multipage_overlaps.pdf"
doc_mid.save(path_mid)
doc_mid.close()
fixtures["average_twocol_multipage_overlaps"] = {
    "pdf": str(path_mid),
    "sha256": hashlib.sha256(path_mid.read_bytes()).hexdigest(),
    "pages": 2,
    "layout": "two-column",
    "defects": ["overlapping_employment (Jan 2022-Present vs Mar 2021-Dec 2023)", "unlabelled_concurrency"]
}

# 3. STRONG: Single-column, 2 pages, grounded metrics, clean chronology
doc_strong = fitz.open()
# Page 1
sp1 = doc_strong.new_page(width=595, height=842)
strong_text_p1 = """MORGAN CHEN
Senior Full Stack Engineer
morgan.chen@example.test | +1 555 0142 | https://github.com/morganchen | Seattle, WA

PROFESSIONAL SUMMARY
Senior Full Stack Engineer with 7 years of experience architecting high-availability TypeScript and Python web applications, distributed APIs, and resilient data processing pipelines across cloud infrastructure.

TECHNICAL SKILLS
Languages: TypeScript, JavaScript (ESNext), Python, SQL (PostgreSQL), HTML5, CSS3
Frameworks & Libraries: Next.js, React, Node.js, FastAPI, Express, Vitest, Jest
Databases & Tools: PostgreSQL, Redis, Docker, Git, Linux, Tailwind CSS, CI/CD pipelines

PROFESSIONAL EXPERIENCE
Senior Full Stack Engineer — CloudScale Systems, Seattle, WA
Jan 2022 - Present
• Architected and deployed microservices handling 8,000 requests per second with 99.98% uptime using Node.js and Redis caching.
• Redesigned customer dashboard queries in PostgreSQL, reducing p95 latency from 850ms to 120ms for 45,000 active users.
• Spearheaded migration from legacy monolith to Next.js server components, improving Largest Contentful Paint (LCP) from 3.4s to 1.1s.
• Mentored 5 mid-level engineers in test-driven development, increasing unit test coverage from 62% to 89% across core services.

Full Stack Engineer — Beacon Health Analytics, Seattle, WA
Aug 2019 - Dec 2021
• Built real-time patient metric visualization interfaces using React, TypeScript, and WebSockets for 12 clinical partner networks.
• Implemented automated audit logging and role-based access control complying with HIPAA security standards.
• Reduced API response payload sizes by 35% through schema validation optimization and selective field projection.
"""
sp1.insert_textbox(fitz.Rect(50, 45, 545, 795), strong_text_p1, fontsize=9.5)

# Page 2
sp2 = doc_strong.new_page(width=595, height=842)
strong_text_p2 = """PROFESSIONAL EXPERIENCE (CONTINUED)
Associate Software Engineer — DataVenture Labs, Portland, OR
Jul 2017 - Jul 2019
• Developed REST APIs for internal inventory tracking using Python and Flask, serving 15 warehouse locations.
• Implemented automated integration test suites with PyTest, reducing release regression bugs by 28%.
• Collaborated with UX designers to refactor frontend form validation, decreasing user submission errors.

EDUCATION
Bachelor of Science in Computer Science
University of Washington, Seattle, WA | Graduated Jun 2017
Dean's List (2015 – 2017), GPA: 3.82 / 4.0

ENGINEERING PROJECTS & CONTRIBUTIONS
OpenSource Document Pipeline (2024)
Author of typed document extraction utility with over 1,200 GitHub stars and 50,000 monthly downloads.
Optimized text span boundary grouping algorithms to correctly preserve reading order in multi-column PDF layouts.
"""
sp2.insert_textbox(fitz.Rect(50, 45, 545, 795), strong_text_p2, fontsize=9.5)

path_strong = out_dir / "strong_singlecol_twopage_metrics.pdf"
doc_strong.save(path_strong)
doc_strong.close()
fixtures["strong_singlecol_twopage_metrics"] = {
    "pdf": str(path_strong),
    "sha256": hashlib.sha256(path_strong.read_bytes()).hexdigest(),
    "pages": 2,
    "layout": "single-column",
    "defects": []
}

# 4. EDGE CASE: Unsupported / Extravagant Metrics & Contradictions
doc_edge = fitz.open()
ep1 = doc_edge.new_page(width=595, height=842)
edge_text = """SAM RIVERA
Software Developer | sam.rivera@example.test | +1 555 0188

PROFESSIONAL SUMMARY
Visionary developer who single-handedly increased company profits by 500% and solved all scalability challenges across the industry.

EXPERIENCE
Lead Developer — StartupX
Jun 2023 - Present
• Responsible for 1000x user growth and billions of transactions daily with zero bugs.
• Transformed the entire enterprise software ecosystem through sheer coding speed.

Junior Coder — CodeShop
Jan 2024 - Dec 2022
• Handled general website maintenance.
• Managed all cloud infrastructure with 100% automated efficiency.

SKILLS
All programming languages, AI, Machine Learning, Cloud

EDUCATION
Computer Science, Online University (2025)
"""
ep1.insert_textbox(fitz.Rect(50, 45, 545, 795), edge_text, fontsize=10)
path_edge = out_dir / "edge_unsupported_metrics_reversed_dates.pdf"
doc_edge.save(path_edge)
doc_edge.close()
fixtures["edge_unsupported_metrics_reversed_dates"] = {
    "pdf": str(path_edge),
    "sha256": hashlib.sha256(path_edge.read_bytes()).hexdigest(),
    "pages": 1,
    "layout": "single-column",
    "defects": ["unsupported_hyperbolic_metrics (500% profit, 1000x user growth)", "reversed_chronology (Jan 2024 - Dec 2022)"]
}

# 5. Target Job Description
jd_text = """Target Role: Senior Full Stack Engineer
Required Skills: TypeScript, React, Next.js, Node.js, SQL, PostgreSQL, REST APIs, Microservices, Automated Testing.
Experience: 5+ years building and deploying production web applications and distributed backend services.
Preferred: Experience with Redis caching, Docker, CI/CD pipelines, high-traffic systems (1,000+ RPS).
Responsibilities:
- Architect and develop scalable web applications and backend microservices.
- Optimize database queries and improve frontend page load performance.
- Mentor mid-level engineers and enforce rigorous code review and test coverage standards.
"""
path_jd = out_dir / "target_job_description.txt"
path_jd.write_text(jd_text, encoding="utf-8")
fixtures["target_job_description"] = {
    "path": str(path_jd),
    "sha256": hashlib.sha256(path_jd.read_bytes()).hexdigest()
}

summary_path = out_dir / "manifest.json"
summary_path.write_text(json.dumps(fixtures, indent=2), encoding="utf-8")
print(f"Generated {len(fixtures)} Phase 4B test fixtures under {out_dir}")
for k, v in fixtures.items():
    print(f"  {k}: SHA256 {v['sha256'][:16]}...")
