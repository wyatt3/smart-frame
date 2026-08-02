// Copy this file to src/config.ts
export const config = {
  weather: {
    lat: 40.7128,
    lon: -74.006,
    units: "imperial", // "imperial" | "metric"
    // thresholds to determine temperature highlights
    hot_threshold: 100,
    cold_threshold: 32,
  },
  background: {
      darkWindow: {
        start: "22:00", // 24h "HH:MM" when the background should go black
        end: "07:00",
      },
  },
} as const;
