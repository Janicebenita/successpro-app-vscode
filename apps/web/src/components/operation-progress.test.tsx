import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OperationProgress } from "./operation-progress";
afterEach(cleanup);
it("does not present a timer estimate as a measured completion percentage", () => {
  render(<OperationProgress state={{ active: true, estimated: true, percent: 92, title: "Writing", detail: "Preparing your draft", steps: [], currentStep: 0 }} />);
  expect(screen.getByRole("status")).toHaveAccessibleName("Writing: In progress");
  expect(screen.queryByText("92%")).not.toBeInTheDocument();
});
it("retains measured upload percentages", () => {
  render(<OperationProgress state={{ active: true, percent: 45, title: "Uploading", detail: "Transferring file", steps: [], currentStep: 0 }} />);
  expect(screen.getByText("45%")).toBeInTheDocument();
});
