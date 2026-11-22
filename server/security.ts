import dns from 'node:dns/promises';
import net from 'node:net';

const DOMAIN_REGEX = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
const SIMPLE_HOST_REGEX = /^[a-zA-Z0-9.-]{1,253}$/;

export function isValidDomain(domain: string): boolean {
  const cleaned = domain.trim().replace(/\.$/, '');
  return DOMAIN_REGEX.test(cleaned);
}

export function isValidPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function normalizeHostInput(rawHost: string): string {
  let cleaned = rawHost.trim();
  // Strip accidental scheme or path safely for user convenience, then validate strictly
  cleaned = cleaned.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].trim();
  // Strip bracketed IPv6 if present without port
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const val = Number(part);
    if (val < 0 || val > 255) return null;
    num = (num << 8) | val;
  }
  return num >>> 0;
}

export function isPrivateOrReservedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;

  const ranges: Array<[number, number]> = [
    [0x00000000, 0x00ffffff], // 0.0.0.0/8 (This network)
    [0x0a000000, 0x0affffff], // 10.0.0.0/8 (RFC1918)
    [0x64400000, 0x647fffff], // 100.64.0.0/10 (CGNAT)
    [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (Loopback)
    [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (Link-local / Cloud metadata)
    [0xac100000, 0xac1fffff], // 172.16.0.0/12 (RFC1918)
    [0xc0000000, 0xc00000ff], // 192.0.0.0/24 (IETF Protocol Assignments)
    [0xc0000200, 0xc00002ff], // 192.0.2.0/24 (TEST-NET-1)
    [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16 (RFC1918)
    [0xc6120000, 0xc613ffff], // 198.18.0.0/15 (Benchmarking)
    [0xc6336400, 0xc63364ff], // 198.51.100.0/24 (TEST-NET-2)
    [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 (TEST-NET-3)
    [0xe0000000, 0xffffffff], // 224.0.0.0/4 Multicast & Reserved
  ];

  return ranges.some(([start, end]) => n >= start && n <= end);
}

export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true; // fe80::/10 link-local
  }
  if (normalized.startsWith('ff')) return true; // Multicast
  // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) {
      return isPrivateOrReservedIPv4(mapped);
    }
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateOrReservedIPv4(ip);
  if (version === 6) return isPrivateOrReservedIPv6(ip);
  return true;
}

export interface ValidatedTarget {
  host: string;
  resolvedIp: string;
  family: 4 | 6;
}

export async function validateAndResolvePublicTarget(rawHost: string): Promise<ValidatedTarget> {
  const host = normalizeHostInput(rawHost);
  if (!host) {
    throw new Error('Host is required.');
  }

  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new Error('Private or local hostnames are blocked for security.');
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4 || ipVersion === 6) {
    if (isBlockedIp(host)) {
      throw new Error('Private, loopback, or reserved IP addresses cannot be targeted.');
    }
    return { host, resolvedIp: host, family: ipVersion };
  }

  if (!SIMPLE_HOST_REGEX.test(host) || !isValidDomain(host)) {
    throw new Error('Please enter a valid public domain name or IP address.');
  }

  const records = await dns.lookup(host, { all: true });
  if (!records.length) {
    throw new Error('Unable to resolve hostname.');
  }

  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new Error('Target resolved to a private or reserved network address and was blocked.');
    }
  }

  const preferred = records.find((r) => r.family === 4) ?? records[0];
  return {
    host,
    resolvedIp: preferred.address,
    family: preferred.family === 6 ? 6 : 4,
  };
}
