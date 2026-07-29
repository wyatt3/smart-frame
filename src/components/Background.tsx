import { useState, useEffect } from "react";
import styles from "./Background.module.css";
const INTERVAL_MS = 360_000;

function Background() {
  const [imgUrl, setImgUrl] = useState("");

  useEffect(() => {
    function pickRandom() {
      window.ipcRenderer.invoke("get-images").then((images: string[]) => {
        if (images.length > 0) {
          const random = images[Math.floor(Math.random() * images.length)];
          setImgUrl(`/img/${random}`);
        }
      });
    }

    pickRandom();
    const id = setInterval(pickRandom, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (!imgUrl) return null;

  return (
    <div className={styles.bg}>
      <img src={imgUrl} alt="Background Image" />
    </div>
  );
}

export default Background;
