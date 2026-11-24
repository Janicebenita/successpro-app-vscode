import {NextResponse} from "next/server";
import {getSessionUser} from "@/lib/session";
import {resumeRuntime} from "@/lib/resume-runtime";
import {localReviewPersistenceEnabled} from "@/lib/review-storage";
export async function GET(){if(process.env.NODE_ENV === "production" || !await getSessionUser())return NextResponse.json({error:"Not found"},{status:404});return NextResponse.json({...await resumeRuntime(),finalReviewPersistence:localReviewPersistenceEnabled()?"mysql-local":"firestore",firestoreMode:process.env.DEV_BYPASS_AUTH === "true" || process.env.GOOGLE_CLOUD_PROJECT === "successpro-local" ? "development-memory-substitute":"configured-real-client"});}
