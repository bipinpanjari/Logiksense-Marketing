const POPULAR_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Melbourne",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
];

export function getTimeZoneOptions(): string[] {
  try {
    const supportedValuesOf = (Intl as any)?.supportedValuesOf;
    if (typeof supportedValuesOf === "function") {
      const all = supportedValuesOf("timeZone") as string[];
      const withUtc = all.includes("UTC") ? all : ["UTC", ...all];
      const popular = POPULAR_TIMEZONES.filter((tz) => withUtc.includes(tz));
      const rest = withUtc.filter((tz) => !popular.includes(tz));
      return [...popular, ...rest];
    }
  } catch {
    // ignore
  }
  return [...POPULAR_TIMEZONES];
}

