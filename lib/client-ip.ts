type HeadersLike = { get(name: string): string | null };

export function clientIpFromHeaders(headerList: HeadersLike): string {
  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const nearestProxyClient = hops[hops.length - 1];
    if (nearestProxyClient) return nearestProxyClient;
  }

  return "unknown-ip";
}
