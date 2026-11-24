import { loadAiConfig } from "./src/lib/ai/config";
import { usableProviderConfigs } from "./src/lib/ai/config";
import { adminDb } from "./src/lib/firebase-admin";

async function check() {
  const config = await loadAiConfig();
  console.log("AI Config providers:", config.providers);
  const usable = usableProviderConfigs(config, "personal", "analyzeResume");
  console.log("Usable providers for analyzeResume:", usable);

  const consent = await adminDb.collection("registration_consents").doc("local-developer").get();
  console.log("Consent for local-developer exists:", consent.exists);
  console.log("Consent data:", consent.data());
}

check().catch(console.error);
