import "server-only";
import { isAdminSession } from "../session-cookies";
import { fetchAppFeedSnapshot } from "./google";
import { todayInTaipei } from "./dates";
import { buildLeaseRenewals } from "./validate";
import type { AdminLeaseRenewalsResult } from "./types";

/**
 * Lists leases inside the 60-day renewal window for the admin console. Reads
 * fresh on each call and returns only the room and lease end date.
 */
export async function listLeaseRenewals(): Promise<AdminLeaseRenewalsResult> {
  if (!(await isAdminSession())) return { kind: "denied" };

  const snapshot = await fetchAppFeedSnapshot();
  if (snapshot.kind !== "ok") {
    console.warn("[renewal] list unavailable", { reason: snapshot.reason });
    return { kind: "unavailable" };
  }

  const renewals = buildLeaseRenewals(snapshot.snapshot, todayInTaipei());
  if (renewals === null) {
    console.warn("[renewal] list unavailable", { reason: "validation" });
    return { kind: "unavailable" };
  }

  return { kind: "ok", renewals };
}
