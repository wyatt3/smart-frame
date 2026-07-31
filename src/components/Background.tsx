import { useState, useEffect } from "react";
import styles from "./Background.module.css";
const INTERVAL_MS = 120_000;

function Background() {
  const [imgUrl, setImgUrl] = useState("");

  useEffect(() => {
    var currentImage = 0;
    var images: string[] = [];

    function shuffleArray(array: string[]) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    function checkImages() {
      window.ipcRenderer.invoke("get-images").then((result: string[]) => {
        const same = images.length === result.length && images.every((img) => result.includes(img));
        if (same) {
          setImgUrl("/img/" + images[currentImage++ % result.length]);
        } else {
          shuffleArray(result);
          images = result;
          setImgUrl("/img/" + images[currentImage++ % result.length]);
        }
      });
    }

    checkImages();
    const id = setInterval(checkImages, INTERVAL_MS);
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
