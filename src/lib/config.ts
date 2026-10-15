/** The one StayUp API this app talks to. */
export const API_URL: string = (
  process.env.EXPO_PUBLIC_STAYUP_API_URL ?? "https://stayup-api.r-sik.workers.dev"
).replace(/\/$/, "")
