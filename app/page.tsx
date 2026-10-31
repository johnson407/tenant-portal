import { redirect } from "next/navigation";
import { getTenantRoom } from "@/lib/session-cookies";

export const metadata = { title: "Tenant Portal" };
export const instant = false;

export default async function Home() {
  const room = await getTenantRoom();
  if (room) redirect(`/rooms/${room}`);
  redirect("/login");
}
