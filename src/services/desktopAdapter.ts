/**
 * Modular Platform & Desktop Compatibility Adapter.
 *
 * Isolates browser runtime APIs from future Electron / Windows desktop IPC bridges.
 * In a packaged Electron app, a context-isolated preload script exposes `window.novyraDesktop`
 * via `contextBridge.exposeInMainWorld('novyraDesktop', ...)`, enabling OS-level ICMP,
 * traceroute, NIC byte counters, Wi-Fi SSID/RSSI, and gateway ARP inspection without
 * modifying any React UI components.
 */

export interface DesktopSystemInterfaceInfo {
  interfaceName: string;
  type: 'ethernet' | 'wifi' | 'other';
  localIp: string;
  gatewayIp?: string;
  dnsServers?: string[];
  wifiSsid?: string;
  signalStrengthDbm?: number;
}

export interface DesktopTrafficSample {
  timestamp: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
}

export interface NovyraDesktopBridge {
  platform: string;
  version: string;
  capabilities: {
    icmpPing: boolean;
    nativeTraceroute: boolean;
    systemTrafficMonitor: boolean;
    wifiDetails: boolean;
    desktopNotifications: boolean;
  };
  getNetworkInterfaces: () => Promise<DesktopSystemInterfaceInfo[]>;
  getSystemTrafficSample: () => Promise<DesktopTrafficSample | null>;
  sendNativeNotification?: (title: string, body: string) => void;
}

declare global {
  interface Window {
    novyraDesktop?: NovyraDesktopBridge;
  }
}

export interface PlatformCapabilities {
  runtime: 'browser' | 'electron-desktop';
  icmpPing: boolean;
  nativeTraceroute: boolean;
  systemTrafficMonitor: boolean;
  wifiHardwareMetrics: boolean;
  routerGatewayDiscovery: boolean;
  httpSpeedBenchmark: boolean;
  tcpConnectDiagnostics: boolean;
  dnsLookup: boolean;
}

export function getDesktopBridge(): NovyraDesktopBridge | null {
  if (typeof window !== 'undefined' && window.novyraDesktop) {
    return window.novyraDesktop;
  }
  return null;
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const bridge = getDesktopBridge();
  if (bridge) {
    return {
      runtime: 'electron-desktop',
      icmpPing: bridge.capabilities.icmpPing,
      nativeTraceroute: bridge.capabilities.nativeTraceroute,
      systemTrafficMonitor: bridge.capabilities.systemTrafficMonitor,
      wifiHardwareMetrics: bridge.capabilities.wifiDetails,
      routerGatewayDiscovery: true,
      httpSpeedBenchmark: true,
      tcpConnectDiagnostics: true,
      dnsLookup: true,
    };
  }

  return {
    runtime: 'browser',
    icmpPing: false,
    nativeTraceroute: false,
    systemTrafficMonitor: false,
    wifiHardwareMetrics: false,
    routerGatewayDiscovery: false,
    httpSpeedBenchmark: true,
    tcpConnectDiagnostics: true,
    dnsLookup: true,
  };
}
