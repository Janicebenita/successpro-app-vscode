"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase-client";

export function SignOutButton() {
  const router = useRouter();
  async function leave() {
    await Promise.all([signOut(firebaseAuth), fetch("/api/session", { method: "DELETE" })]);
    router.push("/login");
    router.refresh();
  }
  return <button className="sign-out" type="button" onClick={() => void leave()}>Sign out</button>;
}
