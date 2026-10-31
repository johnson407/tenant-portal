import { redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/session-cookies";
import AdminLoginForm from "./admin-login-form";

export const metadata = { title: "Admin sign in" };
export const instant = false;

export default async function AdminLoginPage() {
  const claims = await getSessionClaims();
  if (claims?.role === "admin") redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-lg bg-slate-900 p-8 text-slate-100 shadow-xl">
        <h1 className="text-2xl font-semibold">Admin sign in</h1>
        <p className="mt-2 text-sm text-slate-400">Landlord access only.</p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
