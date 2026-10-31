import { isAdminSession } from "@/lib/session-cookies";
import { redirect } from "next/navigation";
import AdminResetForm from "./reset-form";

export const metadata = { title: "Admin - Reset room code" };
export const instant = false;

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-3xl font-semibold">Room access codes</h1>
        <p className="text-sm text-slate-400">
          Reset the access code for any room. A new code is shown once - copy it before leaving this page.
        </p>
        <AdminResetForm />
      </div>
    </main>
  );
}
