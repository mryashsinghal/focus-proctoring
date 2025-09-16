import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css"; // optional tailwind

createRoot(document.getElementById("root")).render(<App />);
