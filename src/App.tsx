import Background from "./components/Background";
import DateTime from "./components/DateTime";
import Weather from "./components/Weather";
import { config } from "./config";

function App() {
  return (
    <>
      <Background />
      <Weather position="bottom-left" lat={config.weather.lat} lon={config.weather.lon} units={config.weather.units} />
      <DateTime position="bottom-right" />
    </>
  );
}

export default App;
