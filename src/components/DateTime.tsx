import { useState, useEffect } from "react";
import styles from "./DateTime.module.css";

function DateTime({ position }: { position: string }) {
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [second, setSecond] = useState("");
  const [ampm, setAmPm] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      const hours = now.getHours();
      setHour((hours > 12 ? hours - 12 : hours).toString());
      setAmPm(hours >= 12 ? "PM" : "AM");
      setMinute(now.getMinutes().toString().padStart(2, "0"));
      setSecond(now.getSeconds().toString().padStart(2, "0"));
      const dayName = now.getDay();
      const dayNumber = now.getDate();
      const month = now.getMonth();
      const dayNumberSuffix =
        dayNumber >= 11 && dayNumber <= 13 ? "th" : ["st", "nd", "rd"][(dayNumber % 10) - 1] || "th";

      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      setDate(`${dayNames[dayName]}, ${monthNames[month]} ${dayNumber}${dayNumberSuffix}`);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  });
  return (
    <div className={`module ${position} ${styles["date-time"]}`}>
      <div className={styles.date}>{date}</div>
      <div className={styles.time}>
        <span>{hour}:{minute}</span><span className={styles.seconds}>{second}</span><span>{ampm}</span>
      </div>
    </div>
  );
}

export default DateTime;
