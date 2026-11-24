import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your free SuccessPro account and get 3 free AI resume checks every month.",
  alternates: {
    canonical: "/signup",
  },
};
export default function SignupPage() { return <AuthLayout mode="signup" />; }
