export type OperationProgressState = {
  active: boolean;
  percent: number;
  title: string;
  detail: string;
  steps: string[];
  currentStep: number;
  estimated?: boolean;
};

export function OperationProgress({ state, variant = "default" }: { state: OperationProgressState; variant?: "default" | "scan" }) {
  if (!state.active && state.percent === 0) return null;
  const progressLabel = state.estimated && state.active ? "In progress" : `${state.percent}%`;
  return <section className={`operation-progress operation-progress-${variant}`} role="status" aria-live="polite" aria-label={`${state.title}: ${progressLabel}`}>
    <div className="operation-progress-copy"><div><strong>{state.title}</strong><span>{state.detail}</span></div><b>{progressLabel}</b></div>
    <div className="operation-progress-track" aria-hidden="true"><span style={{ width: `${state.percent}%` }} /></div>
    <div className="operation-progress-steps" aria-hidden="true">{state.steps.map((step, index) => <span className={index < state.currentStep ? "done" : index === state.currentStep ? "current" : ""} key={step}><i>{index < state.currentStep ? "✓" : index + 1}</i>{step}</span>)}</div>
    {variant === "scan" && <div className="resume-scan-visual" aria-hidden="true"><div className="scan-page scan-page-back"/><div className="scan-page"><i/><i/><i/><i/></div><span className="scan-beam"/><div className="scan-orbit"><i/><i/><i/></div></div>}
  </section>;
}
