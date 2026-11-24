import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const isDevBypass = process.env.NODE_ENV !== "production" && (process.env.DEV_BYPASS_AUTH === "true" || process.env.GOOGLE_CLOUD_PROJECT === "successpro-local");

function createDevMockFirestore() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Firestore unavailable: Firebase Admin is not configured in production.");
  }
  const store = new Map<string, any>();
  store.set("registration_consents/local-developer", {
    ownerId: "local-developer",
    externalAiDataUseAccepted: true,
    externalAiDataUseVersion: "1.0",
    externalAiDataUseAcceptedAt: new Date().toISOString(),
  });
  const makeDoc = (docPath: string): any => {
    const docObj: any = {
      id: docPath.split("/").pop() || "",
      get: async () => ({
        id: docPath.split("/").pop() || "",
        exists: docPath.startsWith("registration_consents/") ? true : store.has(docPath),
        data: () => {
          if (docPath.startsWith("registration_consents/")) {
            return {
              ownerId: docPath.split("/").pop() || "",
              externalAiDataUseAccepted: true,
              externalAiDataUseVersion: "1.0",
              externalAiDataUseAcceptedAt: new Date().toISOString(),
              ...(store.get(docPath) ?? {}),
            };
          }
          return store.get(docPath) ?? null;
        },
        ref: docObj,
      }),
      set: async (data: any, options?: any) => {
        const prev = store.get(docPath) ?? {};
        store.set(docPath, options?.merge ? { ...prev, ...data } : data);
        return { writeTime: new Date() };
      },
      update: async (data: any) => {
        const prev = store.get(docPath) ?? {};
        store.set(docPath, { ...prev, ...data });
        return { writeTime: new Date() };
      },
      delete: async () => {
        store.delete(docPath);
        return { writeTime: new Date() };
      },
      collection: (subName: string) => makeCollection(`${docPath}/${subName}`),
    };
    docObj.ref = docObj;
    return docObj;
  };

  type QueryFilter = { field: string; op: string; val: any };
  const makeCollection = (colPath: string, filters: QueryFilter[] = [], limitVal?: number): any => {
    const queryObj: any = {
      doc: (id?: string) => makeDoc(`${colPath}/${id || Math.random().toString(36).slice(2)}`),
      add: async (data: any) => {
        const id = Math.random().toString(36).slice(2);
        store.set(`${colPath}/${id}`, data);
        return { id };
      },
      where: (field: string, op: string, val: any) => makeCollection(colPath, [...filters, { field, op, val }], limitVal),
      limit: (n: number) => makeCollection(colPath, filters, n),
      orderBy: () => queryObj,
      startAfter: () => queryObj,
      get: async () => {
        const prefix = `${colPath}/`;
        let docs: any[] = [];
        for (const [key, val] of store.entries()) {
          if (key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) {
            const matches = filters.every(({ field, op, val: targetVal }) => {
              const actual = val?.[field];
              if (op === "==" || op === "===") return actual === targetVal;
              if (op === "!=") return actual !== targetVal;
              if (op === ">") return actual > targetVal;
              if (op === ">=") return actual >= targetVal;
              if (op === "<") return actual < targetVal;
              if (op === "<=") return actual <= targetVal;
              if (op === "in") return Array.isArray(targetVal) && targetVal.includes(actual);
              if (op === "array-contains") return Array.isArray(actual) && actual.includes(targetVal);
              return true;
            });
            if (matches) {
              docs.push({
                id: key.slice(prefix.length),
                exists: true,
                data: () => val,
                ref: makeDoc(key),
              });
            }
          }
        }
        if (typeof limitVal === "number" && limitVal > 0) {
          docs = docs.slice(0, limitVal);
        }
        return {
          empty: docs.length === 0,
          docs,
          forEach: (cb: any) => docs.forEach(cb),
          map: (cb: any) => docs.map(cb),
        };
      },
    };
    return queryObj;
  };

  return {
    collection: (name: string) => makeCollection(name),
    doc: (path: string) => makeDoc(path),
    batch: () => {
      const ops: (() => Promise<any> | any)[] = [];
      const batchObj: any = {
        set: (ref: any, data: any, options?: any) => {
          ops.push(() => ref.set(data, options));
          return batchObj;
        },
        update: (ref: any, data: any) => {
          ops.push(() => ref.update(data));
          return batchObj;
        },
        delete: (ref: any) => {
          ops.push(() => ref.delete());
          return batchObj;
        },
        create: (ref: any, data: any) => {
          ops.push(() => ref.set(data));
          return batchObj;
        },
        commit: async () => {
          for (const op of ops) {
            await op();
          }
          return [];
        },
      };
      return batchObj;
    },
    runTransaction: async (cb: any) => cb({
      get: async (ref: any) => ref.get(),
      set: (ref: any, data: any, options?: any) => ref.set(data, options),
      update: (ref: any, data: any) => ref.update(data),
      delete: (ref: any) => ref.delete(),
    }),
  } as unknown as import("firebase-admin/firestore").Firestore;
}

function createDevMockAuth() {
  if (process.env.NODE_ENV === "production") {
    return {
      getUser: async () => { throw new Error("Authentication unavailable: Firebase Admin is not configured in production."); },
      verifySessionCookie: async () => { throw new Error("Authentication unavailable: Firebase Admin is not configured in production."); },
      verifyIdToken: async () => { throw new Error("Authentication unavailable: Firebase Admin is not configured in production."); },
      createSessionCookie: async () => { throw new Error("Authentication unavailable: Firebase Admin is not configured in production."); },
    } as unknown as import("firebase-admin/auth").Auth;
  }
  return {
    getUser: async (uid: string) => ({
      uid,
      email: "demo@successpro.local",
      emailVerified: true,
      displayName: "Demo Developer",
    }),
    verifySessionCookie: async (_cookie: string) => ({
      uid: "local-developer",
      email: "demo@successpro.local",
      email_verified: true,
      name: "Demo Developer",
    }),
    verifyIdToken: async (_token: string) => ({
      uid: "local-developer",
      email: "demo@successpro.local",
      email_verified: true,
      name: "Demo Developer",
    }),
    createSessionCookie: async () => "mock_session_cookie",
  } as unknown as import("firebase-admin/auth").Auth;
}

function createDevMockStorage() {
  if (process.env.NODE_ENV === "production") {
    return {
      bucket: () => {
        throw new Error("Storage unavailable: Firebase Admin is not configured in production.");
      },
    } as unknown as import("firebase-admin/storage").Storage;
  }
  return {
    bucket: () => ({
      file: () => ({
        save: async () => {},
        getSignedUrl: async () => ["http://localhost:3000/placeholder-resume.pdf"],
      }),
    }),
  } as unknown as import("firebase-admin/storage").Storage;
}

let app: any;
try {
  app = getApps().length
    ? getApp()
    : initializeApp({
        credential: applicationDefault(),
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        storageBucket: process.env.SUCCESSPRO_PRIVATE_BUCKET,
      });
} catch {
  app = undefined;
}

if (process.env.NODE_ENV === "production" && !app) {
  console.error("CRITICAL: Firebase Admin failed to initialize in production. Mock services are strictly disabled in production.");
}

export const adminAuth = isDevBypass || (!app && process.env.NODE_ENV !== "production") ? createDevMockAuth() : (app ? getAuth(app) : createDevMockAuth());
export const adminDb = isDevBypass || (!app && process.env.NODE_ENV !== "production") ? createDevMockFirestore() : (app ? getFirestore(app) : createDevMockFirestore());
export const adminStorage = isDevBypass || (!app && process.env.NODE_ENV !== "production") ? createDevMockStorage() : (app ? getStorage(app) : createDevMockStorage());
