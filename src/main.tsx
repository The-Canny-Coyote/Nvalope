import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const buildEpoch = typeof import.meta.env.VITE_BUILD_EPOCH !== "undefined" ? String(import.meta.env.VITE_BUILD_EPOCH) : "";
if (buildEpoch && document.documentElement) document.documentElement.dataset.build = buildEpoch;

createRoot(document.getElementById("root")!).render(<App />);
