import {cleanup,render,screen,within} from "@testing-library/react";
import {afterEach,describe,it,expect} from "vitest";
import {analyzeResumeGapsAndRisks,CONTENT_PARAMETER_IDS,VISUAL_PARAMETER_IDS,evaluateSuccessProV2} from "@successpro/domain";
import {WorkbookReview} from "./workbook-review";
afterEach(cleanup);
describe("workbook display",()=>{
 it("displays Pending, fixed allocations and all parameter evidence",()=>{
  const result=evaluateSuccessProV2({mode:"no_job_description",parameters:[],intakeGates:{textReliable:true,visualDocumentAvailable:false}});
  render(<WorkbookReview result={result}/>);
  expect(screen.getByText("Score Pending")).toBeInTheDocument();expect(screen.getByText("No job description · 65 Content / 35 Visual")).toBeInTheDocument();expect(screen.getByText(/Possible range: 0–100/)).toBeInTheDocument();expect(screen.getByText(/C01 ·/)).toBeInTheDocument();
 });
});

it("shows gap, future-date and other diagnostics without changing the workbook score", () => {
  const text = [
    "EXPERIENCE",
    "Analyst | Example Co | January 2020 - December 2022",
    "Prepared detailed operations reports for managers.",
    "Senior Analyst | Sample Co | January 2024 - Present",
    "Coordinated reporting across teams.",
    "Consultant | Third Co | 2023-2029 working",
    "Supported cross-functional service improvements.",
  ].join("\n");
  const diagnostics = analyzeResumeGapsAndRisks(text, {}, "", new Date("2026-11-24T12:00:00+05:30"));
  const result = evaluateSuccessProV2({
    mode: "no_job_description",
    intakeGates: { textReliable: true, visualDocumentAvailable: true },
    parameters: [...CONTENT_PARAMETER_IDS, ...VISUAL_PARAMETER_IDS].map(id => ({
      id, status: "Assessed", rating: 4,
      evidence: { excerpt: "Prepared detailed operations reports for managers.", rationale: "Fixture evidence." },
    })),
  });
  const { rerender } = render(<WorkbookReview result={result} isPaid={false} />);
  expect(screen.getByText("80.0")).toBeVisible();

  rerender(<WorkbookReview result={result} isPaid={false} gapRiskAnalysis={diagnostics} />);
  const advisory = within(screen.getByRole("region", { name: "Resume Gap & Risk Detection" }));
  expect(advisory.getByRole("heading", { name: /Employment Gap of 1 year/i })).toBeVisible();
  expect(advisory.getByRole("heading", { name: /Future Employment End Date: 2029/i })).toBeVisible();
  expect(advisory.getByRole("button", { name: /Missing Information/ })).toBeVisible();
  expect(advisory.getByText(/Advisory findings add no deductions/)).toBeVisible();
  expect(screen.getByText("80.0")).toBeVisible();
  expect(screen.getByText(/Detailed Assessment Breakdown \(20 Criteria\)/)).toBeInTheDocument();
});
