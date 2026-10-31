import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { getTenantRoom } from "@/lib/session-cookies";

export const instant = false;

type HomeProps = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: getDictionary(lang).meta.homeTitle };
}

export default async function Home({ params }: HomeProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const room = await getTenantRoom();
  if (room) redirect(localePath(lang, `/rooms/${room}`));
  redirect(localePath(lang, "/login"));
}
