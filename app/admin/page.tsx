import { isAdminSession } from "@/lib/session-cookies";
import { redirect } from "next/navigation";
import AdminResetForm from "./reset-form";
import { logoutAction } from "@/app/logout-actions";

export const metadata = { title: "Admin - Reset room code" };
export const instant = false;

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Room access codes</h1>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-slate-500 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              Log out
            </button>
          </form>
        </header>
        <p className="text-sm text-slate-400">
          Reset the access code for any room. A new code is shown once - copy it before leaving this page.
        </p>
        <AdminResetForm />
      </div>
    </main>
  );
}
