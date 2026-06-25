// Normalise Australian address punctuation: "City, NSW, 2000" → "City NSW 2000"
export function normalizeAddress(address: string): string {
  return address
    .trim()
    .replace(/,\s*(NSW|VIC|QLD|WA|SA|TAS|ACT|NT),?\s*(\d{4})\b/g, ' $1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatTimeLabel(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-AU', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export async function reverseGeocode(
  lat: number, lng: number,
): Promise<{ suburb: string; suburbLat: number; suburbLng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'operation-find-cameron/1.0', 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const addr = data.address || {};
    const suburb =
      addr.suburb || addr.town || addr.city || addr.village ||
      addr.municipality || addr.city_district || addr.county || null;
    if (!suburb) return null;
    return { suburb, suburbLat: parseFloat(data.lat), suburbLng: parseFloat(data.lon) };
  } catch {
    return null;
  }
}

export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0&countrycodes=au`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'operation-find-cameron/1.0', 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    const data: any[] = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export function inferIcon(activity: string): string {
  const a = activity.toLowerCase();
  if (/coffee|café|\bcafe\b|flat white|\blatte\b|espresso|cappuccino/.test(a)) return '☕';
  if (/wine|winery|vineyard|tasting/.test(a)) return '🍷';
  if (/beer|\bpub\b|\bbar\b|cocktail|brewery|\bgin\b|whiskey|whisky/.test(a)) return '🍺';
  if (/eat|food|lunch|dinner|breakfast|restaurant|meal|pizza|burger|taco|sushi|cheese/.test(a)) return '🍔';
  if (/yoga|meditate|meditation|relax|spa|massage/.test(a)) return '🧘';
  if (/snorkel|scuba|dive/.test(a)) return '🤿';
  if (/swim|surf|beach|ocean/.test(a)) return '🏊';
  if (/kayak|boat|paddle|canoe|sail|river/.test(a)) return '🚣';
  if (/book|\bread\b|library|novel|kindle/.test(a)) return '📚';
  if (/shop|shopping|market|\bbuy\b|purchase|mall/.test(a)) return '🛍️';
  if (/walk|hike|\brun\b|jog|exercise|gym|cycling|\bbike\b/.test(a)) return '🏃';
  if (/photo|photograph|camera|picture|\bsnap\b/.test(a)) return '📸';
  if (/music|concert|gig|\bband\b|guitar|piano|festival/.test(a)) return '🎸';
  if (/laptop|computer|\bwork\b|\bcode\b|meeting|zoom|teams/.test(a)) return '💻';
  if (/\bfly\b|flight|airport|departing|\blanding\b|check.?in/.test(a)) return '✈️';
  if (/\bdrive\b|\bcar\b|road trip|journey/.test(a)) return '🚗';
  if (/\bgame\b|gaming|\bplay\b|arcade/.test(a)) return '🎮';
  if (/sleep|nap|\brest\b|tired/.test(a)) return '😴';
  return '⚡';
}

export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
