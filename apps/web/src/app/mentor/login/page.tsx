import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Mentor sign in",
  robots: { index: false, follow: false },
};

export default async function MentorLogin() {
  if (await getSessionUser()) redirect("/mentor");
  return <AuthLayout mode="login" audience="mentor" />;
}
