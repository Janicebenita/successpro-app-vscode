import { execFileSync } from "node:child_process";

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const gcloud = process.env.GCLOUD_BIN ?? "gcloud";
const googleOauthClientId = process.env.FIREBASE_GOOGLE_OAUTH_CLIENT_ID;
const googleOauthClientSecret = process.env.FIREBASE_GOOGLE_OAUTH_CLIENT_SECRET;

if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT is required");

const token = execFileSync(gcloud, ["auth", "print-access-token"], {
  encoding: "utf8",
  env: process.env,
}).trim();

async function request(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Goog-User-Project": projectId,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function waitForOperation(name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const operation = await request(`https://firebase.googleapis.com/v1beta1/${name}`);
    if (operation.done) return operation;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for ${name}`);
}

try {
  const operation = await request(`https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`, {
    method: "POST",
    body: "{}",
  });
  if (operation.name) await waitForOperation(operation.name);
} catch (error) {
  if (error.status !== 409) throw error;
}

const apps = await request(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps?pageSize=100`);
let app = apps.apps?.find((item) => item.displayName === "SuccessPro Web");

if (!app) {
  const operation = await request(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
    method: "POST",
    body: JSON.stringify({ displayName: "SuccessPro Web" }),
  });
  const completed = await waitForOperation(operation.name);
  app = completed.response;
}

const config = await request(`https://firebase.googleapis.com/v1beta1/${app.name}/config`);

try {
  await request(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`);
} catch (error) {
  if (error.status !== 404) throw error;
  await request(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`, {
    method: "POST",
    body: "{}",
  });
}

await request(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`,
  {
    method: "PATCH",
    body: JSON.stringify({
      signIn: { email: { enabled: true, passwordRequired: true } },
      authorizedDomains: [
        "localhost",
        "successpro-web-staging-913575819720.asia-south1.run.app",
        "successpro-web-staging-tjx6xu7doq-el.a.run.app",
        "successpro.xfactor.ltd",
      ],
    }),
  },
);

let googleProvider = "enabled";
try {
  await request(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs/google.com?updateMask=enabled`, {
    method: "PATCH",
    body: JSON.stringify({ enabled: true }),
  });
} catch (error) {
  if (error.status !== 404) {
    googleProvider = `requires-console-configuration: ${error.message}`;
  } else {
    if (!googleOauthClientId || !googleOauthClientSecret) {
      googleProvider = "requires-oauth-client-id-and-secret";
      console.log(JSON.stringify({ appName: app.name, googleProvider, ...config }, null, 2));
      process.exit(0);
    }
    try {
      await request(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs?idpId=google.com`, {
        method: "POST",
        body: JSON.stringify({ enabled: true, clientId: googleOauthClientId, clientSecret: googleOauthClientSecret }),
      });
      googleProvider = "enabled";
    } catch (createError) {
      googleProvider = `requires-console-configuration: ${createError.message}`;
    }
  }
}

console.log(JSON.stringify({ appName: app.name, googleProvider, ...config }, null, 2));
