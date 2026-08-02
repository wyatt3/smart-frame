import { useState, useEffect, useRef } from "react";
import styles from "./Background.module.css";
import { config } from "../config";
const INTERVAL_MS = 120_000;
const TRANSITION_MS = 1_000;

interface Layer {
  url: string;
  key: number;
  visible: boolean;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isDarkWindow(): boolean {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(config.background.darkWindow.start);
  const end = toMinutes(config.background.darkWindow.end);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function Background() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [isDark, setIsDark] = useState(isDarkWindow);
  const timersRef = useRef<number[]>([]);
  const rafsRef = useRef<number[]>([]);
  const keyRef = useRef(0);

  useEffect(() => {
    let currentImage = 0;
    let images: string[] = [];

    function shuffleArray(array: string[]) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    function showImage(url: string) {
      const img = new Image();
      img.onload = () => {
        const newKey = ++keyRef.current;
        setLayers((prev) => [...prev.slice(-1), { url, key: newKey, visible: false }]);

        const raf = window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setLayers((prev) =>
              prev.map((layer) =>
                layer.key === newKey
                  ? { ...layer, visible: true }
                  : layer.key === newKey - 1
                    ? { ...layer, visible: false }
                    : layer,
              ),
            );
          });
        });
        rafsRef.current.push(raf);

        const timer = window.setTimeout(
          () => setLayers((prev) => prev.filter((layer) => layer.key !== newKey - 1)),
          TRANSITION_MS + 200,
        );
        timersRef.current.push(timer);
      };
      img.src = url;
    }

    function checkImages() {
      window.ipcRenderer.invoke("get-images").then((result: string[]) => {
        const same = images.length === result.length && images.every((img) => result.includes(img));
        if (same) {
          showImage("/img/" + images[currentImage++ % result.length]);
        } else {
          shuffleArray(result);
          images = result;
          showImage("/img/" + images[currentImage++ % result.length]);
        }
      });
    }

    checkImages();
    const id = setInterval(checkImages, INTERVAL_MS);
    return () => {
      clearInterval(id);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      rafsRef.current.forEach((raf) => window.cancelAnimationFrame(raf));
    };
  }, []);

  useEffect(() => {
    function checkDark() {
      setIsDark(isDarkWindow());
    }

    const id = setInterval(checkDark, 30_000);
    return () => clearInterval(id);
  }, []);

  const fadeStyle = { transition: `opacity ${TRANSITION_MS}ms ease` };

  return (
    <div className={styles.bg}>
      {layers.map((layer) => (
        <div key={layer.key} style={fadeStyle} className={`${styles.layer} ${layer.visible ? styles.visible : ""}`}>
          <img src={layer.url} alt="Background Image" />
        </div>
      ))}
      <div style={fadeStyle} className={`${styles.dark} ${isDark ? styles.visible : ""}`} />
    </div>
  );
}

export default Background;
