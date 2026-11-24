import type { Metadata } from "next";
import "./globals.css";
import "./presentation.css";
import { SiteFooter } from "@/components/site-footer";
import { ConsentAwareTracking } from "@/components/consent-aware-tracking";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
  ? process.env.NEXT_PUBLIC_APP_URL
  : "https://successpro.ai";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "SuccessPro — AI Career Operating System & ATS Resume Checker",
    template: "%s | SuccessPro",
  },
  description:
    "Private, practical career operating system for AI resume reviews, ATS compatibility scoring, timeline gap risk analysis, and job description fit evaluation.",
  keywords: [
    "ATS resume checker",
    "AI resume review",
    "resume score",
    "job match analysis",
    "career operating system",
    "resume gap analysis",
    "resume formatting check",
    "career roadmap",
  ],
  authors: [{ name: "SuccessPro Team" }],
  creator: "SuccessPro",
  publisher: "SuccessPro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SuccessPro — AI Career Operating System & ATS Resume Checker",
    description:
      "Turn career history into clear direction with AI resume screening, ATS compatibility checks, and job match guidance.",
    url: baseUrl,
    siteName: "SuccessPro",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SuccessPro — AI Career Operating System & ATS Resume Checker",
    description:
      "Turn career history into clear direction with AI resume screening, ATS compatibility checks, and job match guidance.",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SuccessPro",
    "url": baseUrl,
    "logo": `${baseUrl}/favicon.svg`,
    "description": "Private, practical AI career operating system and resume intelligence platform."
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SuccessPro",
    "url": baseUrl
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SuccessPro AI Platform",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All",
    "url": baseUrl,
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free tier includes 3 complete resume reviews each month."
    },
    "featureList": [
      "AI Resume Review & Scoring",
      "ATS Compatibility Analysis",
      "Multi-factor Career Rubrics",
      "Timeline Gap & Career Risk Detection",
      "Job Description Fit Evaluation"
    ]
  }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        {children}
        <SiteFooter />
        <ConsentAwareTracking />
      </body>
    </html>
  );
}
