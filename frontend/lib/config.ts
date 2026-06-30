export const API_URL =
  ((typeof window !== "undefined" && (window as any).desktopEnv?.API_URL) ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3000/api");

