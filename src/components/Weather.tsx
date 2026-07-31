import { useEffect, useState } from "react";
import "weather-icons/css/weather-icons.css";
import styles from "./Weather.module.css";
import { config } from "../config";

const INTERVAL_MS = 10 * 60 * 1000;
const MAX_DAYS = 5;

interface CurrentWeather {
  icon: string;
  temperature: number;
  apparentTemperature: number;
}

interface DailyForecast {
  icon: string;
  date: string;
  maxTemp: number;
  minTemp: number;
}

function getWeatherIcon(code: number, isDay: boolean): string {
  switch (code) {
    case 0:
      return isDay ? "day-sunny" : "night-clear";
    case 1:
      return isDay ? "day-cloudy" : "night-alt-cloudy";
    case 2:
      return isDay ? "day-cloudy" : "night-alt-cloudy";
    case 3:
      return isDay ? "day-sunny-overcast" : "night-alt-partly-cloudy";
    case 45:
    case 48:
      return isDay ? "day-fog" : "night-fog";
    case 51:
    case 53:
    case 55:
      return isDay ? "day-sprinkle" : "night-sprinkle";
    case 56:
    case 57:
      return "snowflake-cold";
    case 61:
      return isDay ? "day-sprinkle" : "night-sprinkle";
    case 63:
      return isDay ? "day-showers" : "night-showers";
    case 65:
      return isDay ? "day-thunderstorm" : "night-thunderstorm";
    case 66:
      return isDay ? "day-rain-mix" : "night-rain-mix";
    case 67:
      return isDay ? "day-snow-thunderstorm" : "night-snow-thunderstorm";
    case 71:
    case 73:
    case 75:
      return isDay ? "day-snow-wind" : "night-snow-wind";
    case 77:
      return isDay ? "day-sleet" : "night-sleet";
    case 80:
      return isDay ? "day-sprinkle" : "night-sprinkle";
    case 81:
      return isDay ? "day-showers" : "night-showers";
    case 82:
      return isDay ? "day-thunderstorm" : "night-thunderstorm";
    case 85:
    case 86:
      return isDay ? "day-rain-mix" : "night-rain-mix";
    case 95:
      return isDay ? "day-thunderstorm" : "night-thunderstorm";
    case 96:
      return isDay ? "day-sleet" : "night-sleet";
    case 99:
      return isDay ? "day-sleet-storm" : "night-sleet-storm";
    default:
      return "cloudy";
  }
}

function weekdayName(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(year, month - 1, day).getDay()];
}

function Weather({
  position,
  lat,
  lon,
  units = "imperial",
}: {
  position: string;
  lat: number;
  lon: number;
  units?: "imperial" | "metric";
}) {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [error, setError] = useState("");
  const [hotThreshold, setHotThreshold] = useState(config.weather.hot_threshold);
  const [coldThreshold, setColdThreshold] = useState(config.weather.cold_threshold);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const tempUnit = units === "metric" ? "celsius" : "fahrenheit";
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${tempUnit}&forecast_days=${MAX_DAYS}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        setCurrent({
          icon: getWeatherIcon(data.current.weather_code, data.current.is_day === 1),
          temperature: data.current.temperature_2m,
          apparentTemperature: data.current.apparent_temperature,
        });

        setForecast(
          data.daily.time.map((date: string, i: number) => ({
            date,
            icon: getWeatherIcon(data.daily.weather_code[i], true),
            maxTemp: data.daily.temperature_2m_max[i],
            minTemp: data.daily.temperature_2m_min[i],
          })),
        );
        setError("");
      } catch {
        if (!cancelled) setError("Unable to load weather");
      }
    }

    load();
    const id = setInterval(load, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lat, lon, units]);

  function dayLabel(index: number): string {
    if (index === 0) return "TODAY";
    if (index === 1) return "TOMORROW";
    return weekdayName(forecast[index].date);
  }

  if (error) {
    return (
      <div className={`module ${position} ${styles.weather}`}>
        <div className={`${styles.message} ${styles.dimmed}`}>{error}</div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={`module ${position} ${styles.weather}`}>
        <div className={`${styles.message} ${styles.dimmed}`}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={`module ${position} ${styles.weather}`}>
      <div className={styles.current}>
        <span className={styles.weathericon}>
          <i className={`wi wi-${current.icon}`} />
        </span>
        <span className={styles.temp}>{Math.round(current.temperature)}&deg;</span>
      </div>
      <div className={styles.feelsLike}>FEELS LIKE {Math.round(current.apparentTemperature)}&deg;</div>
      <hr></hr>
      <table className={styles.forecast}>
        <tbody>
          {forecast.map((f, i) => (
            <tr className={styles.dayRow} key={f.date}>
              <td className={styles.day}>{dayLabel(i)}</td>
              <td className={styles.weatherIconCell}>
                <i className={`wi wi-${f.icon}`} />
              </td>
              <td
                className={`${styles.forecastTemp} ${Math.round(f.maxTemp) <= coldThreshold ? styles.cold : ""} ${Math.round(f.maxTemp) >= hotThreshold ? styles.hot : ""}`}
              >
                {Math.round(f.maxTemp)}&deg;
              </td>
              <td
                className={`${styles.forecastTemp} ${styles.minTemp} ${Math.round(f.minTemp) >= hotThreshold ? styles.hot : ""} ${Math.round(f.minTemp) <= coldThreshold ? styles.cold : ""}`}
              >
                {Math.round(f.minTemp)}&deg;
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Weather;
