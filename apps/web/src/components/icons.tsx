type IconName = "home" | "resume" | "target" | "jobs" | "messages" | "profile" | "users" | "shield" | "flag" | "settings" | "audit";

const paths: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z",
  resume: "M6 2h9l3 3v17H6Zm3 6h6M9 12h6M9 16h4",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-5a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  jobs: "M3 7h18v13H3Zm5 0V4h8v3M3 12h18",
  messages: "M4 4h16v13H8l-4 4Zm4 5h8m-8 4h5",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  users: "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6M2 21a6 6 0 0 1 12 0m2-6a5 5 0 0 1 5 5",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-11 2 2 4-4",
  flag: "M5 22V3m0 1h12l-2 4 2 4H5",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-13v3m0 13v3m9.5-9.5h-3m-13 0h-3m16.2-6.2-2.1 2.1M7.4 16.6l-2.1 2.1m13.4 0-2.1-2.1M7.4 7.4 5.3 5.3",
  audit: "M5 3h14v18H5Zm4 5h6m-6 4h6m-6 4h4",
};

export function Icon({ name }: { name: IconName }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
