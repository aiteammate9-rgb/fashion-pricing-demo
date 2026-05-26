/**
 * Weather notes for the outfit calendar — powered by Open-Meteo.
 * --------------------------------------------------------------------------
 * Open-Meteo is free and needs NO API key, so this works out of the box.
 * Default location is Bangkok; override with WEATHER_LAT / WEATHER_LON env.
 *
 * fetchWeatherNotes() returns a map of { "yyyy-mm-dd": "ฝนน่าจะตก พกร่ม · 33°" }
 * for the available forecast window (~16 days). On any failure it returns {}
 * so the calendar still works without weather.
 */

const LAT = process.env.WEATHER_LAT || "13.7563";
const LON = process.env.WEATHER_LON || "100.5018";

// WMO weather codes → short Thai description + a light clothing hint.
function describeCode(code: number, rainProb: number): string {
  let desc: string;
  if (code === 0) desc = "ฟ้าโปร่ง";
  else if (code <= 2) desc = "มีเมฆบางส่วน";
  else if (code === 3) desc = "เมฆมาก";
  else if (code >= 45 && code <= 48) desc = "หมอก";
  else if (code >= 51 && code <= 57) desc = "ฝนปรอย";
  else if (code >= 61 && code <= 67) desc = "ฝนตก";
  else if (code >= 71 && code <= 77) desc = "หิมะ";
  else if (code >= 80 && code <= 82) desc = "ฝนตกหนัก";
  else if (code >= 95) desc = "พายุฝนฟ้าคะนอง";
  else desc = "อากาศแปรปรวน";
  if (rainProb >= 50 && code < 71) desc += " พกร่ม";
  return desc;
}

export async function fetchWeatherNotes(): Promise<Record<string, string>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=weather_code,temperature_2m_max,precipitation_probability_max` +
    `&timezone=Asia%2FBangkok&forecast_days=16`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return {};
    const data: any = await res.json();
    const days: string[] = data?.daily?.time ?? [];
    const codes: number[] = data?.daily?.weather_code ?? [];
    const tmax: number[] = data?.daily?.temperature_2m_max ?? [];
    const rain: number[] = data?.daily?.precipitation_probability_max ?? [];
    const out: Record<string, string> = {};
    for (let i = 0; i < days.length; i++) {
      const note = describeCode(codes[i] ?? 0, rain[i] ?? 0);
      const temp = tmax[i] != null ? ` · ${Math.round(tmax[i])}°` : "";
      out[days[i]] = `${note}${temp}`;
    }
    return out;
  } catch {
    return {};
  }
}
