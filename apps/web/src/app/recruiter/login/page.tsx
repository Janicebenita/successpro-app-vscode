import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Recruiter sign in",
  robots: { index: false, follow: false },
};

export default async function RecruiterLogin() {
  if (await getSessionUser()) redirect("/recruiter");
  return <AuthLayout mode="login" audience="recruiter" />;
}
