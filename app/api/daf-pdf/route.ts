export async function GET(request: Request) {
  const url = new URL(request.url);
  const masechta = url.searchParams.get("masechta") ?? "";
  const daf = url.searchParams.get("daf") ?? "";
  const amud = url.searchParams.get("amud") ?? "a";
  if (!/^[a-z-]+$/.test(masechta) || !/^\d{1,3}$/.test(daf) || !/^[ab]$/.test(amud)) return new Response("Invalid daf", { status: 400 });
  const upstream = await fetch(`https://www.shas.org/daf-pdf/api/?masechta=${masechta}&daf=${daf}&amud=${amud}`);
  if (!upstream.ok) return new Response("PDF not found", { status: upstream.status });
  return new Response(upstream.body, { headers: { "content-type": "application/pdf", "cache-control": "public, max-age=86400" } });
}
