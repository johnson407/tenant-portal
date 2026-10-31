import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantRoom } from "@/lib/session-cookies";
import LoginForm from "./login-form";

export const metadata = { title: "Tenant sign in" };
export const instant = false;

export default async function LoginPage() {
  if (await getTenantRoom()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-lg bg-slate-900 p-8 text-slate-100 shadow-xl">
        <h1 className="text-2xl font-semibold">Tenant sign in</h1>
        <p className="mt-2 text-sm text-slate-400">Select your room and enter your access code.</p>
        <LoginForm />
        <p className="mt-6 text-xs text-slate-500">
          Landlord? <Link href="/admin/login" className="underline hover:text-slate-300">Admin area</Link>
        </p>
      </div>
    </main>
  );
}
