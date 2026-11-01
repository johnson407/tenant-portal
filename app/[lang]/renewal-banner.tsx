import type { LeaseRenewal } from "@/lib/appfeed/types";
import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";

type RenewalBannerProps = {
  locale: Locale;
  dictionary: Dictionary;
  renewals: LeaseRenewal[];
  variant: "tenant" | "admin";
};

/** Server-rendered renewal reminder for the tenant and admin views. */
export function RenewalBanner({
  locale,
  dictionary,
  renewals,
  variant,
}: RenewalBannerProps) {
  if (renewals.length === 0) return null;

  const headingId = "renewal-reminder-heading";
  const panelClass =
    "mt-6 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-200";

  if (variant === "tenant") {
    const renewal = renewals[0];
    const message = dictionary.renewal.tenantMessageTemplate.replace(
      "{date}",
      formatDate(renewal.end, locale),
    );

    return (
      <section aria-labelledby={headingId} className={panelClass}>
        <h2 id={headingId} className="text-sm font-semibold">
          {dictionary.renewal.tenantHeading}
        </h2>
        <p className="mt-1 flex flex-wrap gap-y-1 min-w-0 break-words text-sm">
          {message}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className={panelClass}>
      <h2 id={headingId} className="text-sm font-semibold">
        {dictionary.renewal.adminHeading}
      </h2>
      <p className="mt-1 text-sm">{dictionary.renewal.adminCaption}</p>
      <ul className="mt-3 space-y-1">
        {renewals.map((renewal) => (
          <li
            key={renewal.room}
            className="flex flex-wrap gap-x-2 gap-y-1 text-sm"
          >
            <span className="min-w-0 break-words">
              {dictionary.common.room} {renewal.room.toUpperCase()}
            </span>
            <span className="min-w-0 break-words">
              {dictionary.room.leaseEnd}: {formatDate(renewal.end, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
