import type { ConnectionInfo } from '../types/network';
import { getDesktopBridge } from './desktopAdapter';

interface NavigatorConnectionLike {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function getNavigatorConnection(): NavigatorConnectionLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NavigatorConnectionLike;
    mozConnection?: NavigatorConnectionLike;
    webkitConnection?: NavigatorConnectionLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function readBrowserConnectionSnapshot(): Partial<ConnectionInfo> {
  const conn = getNavigatorConnection();
  return {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: conn?.type ?? null,
    effectiveType: conn?.effectiveType ?? null,
    downlinkEstimateMbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
    rttEstimateMs: typeof conn?.rtt === 'number' ? conn.rtt : null,
    saveData: typeof conn?.saveData === 'boolean' ? conn.saveData : null,
  };
}

async function detectLocalIpViaWebRtc(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.RTCPeerConnection) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ip: string | null) => {
      if (settled) return;
      settled = true;
      resolve(ip);
    };

    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      const timer = setTimeout(() => {
        pc.close();
        finish(null);
      }, 1500);

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timer);
          pc.close();
          finish(null);
          return;
        }
        const cand = event.candidate.candidate;
        const ipv4Match = cand.match(/\b((?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3})\b/);
        if (ipv4Match) {
          clearTimeout(timer);
          pc.close();
          finish(ipv4Match[1]);
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timer);
          pc.close();
          finish(null);
        });
    } catch {
      finish(null);
    }
  });
}

export async function gatherConnectionInformation(allowPublicIpLookup: boolean): Promise<ConnectionInfo> {
  const browserSnap = readBrowserConnectionSnapshot();
  const desktopBridge = getDesktopBridge();

  let serverObservedIp: string | null = null;
  let localIp: string | null = null;
  let dnsServers: string | null = null;

  if (desktopBridge) {
    try {
      const ifaces = await desktopBridge.getNetworkInterfaces();
      if (ifaces.length > 0) {
        localIp = ifaces[0].localIp;
        dnsServers = ifaces[0].dnsServers?.join(', ') ?? null;
      }
    } catch {
      // Desktop interface fetch failed cleanly
    }
  } else {
    localIp = await detectLocalIpViaWebRtc();
  }

  try {
    const res = await fetch('/api/network/server-view', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      serverObservedIp = typeof data.observedIp === 'string' ? data.observedIp : null;
    }
  } catch {
    // Ignore backend view error if offline
  }

  let publicIpv4: string | null = null;
  let publicIpv6: string | null = null;
  let isp: string | null = null;
  let asn: string | null = null;
  let city: string | null = null;
  let country: string | null = null;
  let timezone: string | null = null;
  let lookupError: string | null = null;

  if (allowPublicIpLookup && browserSnap.online) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch('https://ipwho.is/', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const geo = await res.json();
        if (geo && geo.success !== false) {
          publicIpv4 = typeof geo.ip === 'string' && geo.ip.includes('.') ? geo.ip : null;
          publicIpv6 = typeof geo.ip === 'string' && geo.ip.includes(':') ? geo.ip : null;
          isp = geo.connection?.isp || geo.connection?.org || null;
          asn = geo.connection?.asn ? `AS${geo.connection.asn}` : null;
          city = geo.city || null;
          country = geo.country || null;
          timezone = geo.timezone?.id || null;
        }
      }
    } catch {
      // Fallback to simple ipify IP-only endpoint
      try {
        const res = await fetch('https://api64.ipify.org?format=json');
        if (res.ok) {
          const data = await res.json();
          if (typeof data.ip === 'string') {
            if (data.ip.includes(':')) publicIpv6 = data.ip;
            else publicIpv4 = data.ip;
          }
        }
      } catch {
        lookupError = 'External IP lookup unavailable or blocked by network/privacy extension.';
      }
    }
  }

  return {
    online: browserSnap.online ?? true,
    connectionType: browserSnap.connectionType ?? null,
    effectiveType: browserSnap.effectiveType ?? null,
    downlinkEstimateMbps: browserSnap.downlinkEstimateMbps ?? null,
    rttEstimateMs: browserSnap.rttEstimateMs ?? null,
    saveData: browserSnap.saveData ?? null,
    publicIpv4,
    publicIpv6,
    localIp,
    isp,
    asn,
    city,
    country,
    timezone,
    serverObservedIp,
    dnsServers,
    lastUpdated: new Date().toISOString(),
    lookupError,
    isLoadingPublicIp: false,
  };
}
