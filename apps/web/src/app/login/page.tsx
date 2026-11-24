import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your private SuccessPro career workspace.",
  alternates: {
    canonical: "/login",
  },
};
export default function LoginPage() { return <AuthLayout mode="login" />; }
