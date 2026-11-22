const servers = [
  { id: 'novyra-core', name: 'NOVYRA Speed Engine (Active Node)', nameAr: 'محرك NOVYRA للسرعة (الخادم النشط)', location: 'Vercel Edge Function', locationAr: 'خادم NOVYRA السحابي', host: 'self', capabilities: ['download', 'upload', 'latency', 'probe-loss'], isPrimaryBenchmark: true },
  { id: 'cloudflare-dns', name: 'Cloudflare Anycast Edge', nameAr: 'عقدة Cloudflare العالمية', location: 'Global Anycast (1.1.1.1)', locationAr: 'شبكة Anycast العالمية', host: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A', capabilities: ['latency'], isPrimaryBenchmark: false },
  { id: 'google-dns', name: 'Google Public DNS Edge', nameAr: 'عقدة Google DNS العالمية', location: 'Global Anycast (8.8.8.8)', locationAr: 'شبكة Anycast العالمية', host: 'https://dns.google/resolve?name=example.com&type=A', capabilities: ['latency'], isPrimaryBenchmark: false },
];

export { servers };
export default function handler(_req: any, res: any): void {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ servers });
}

