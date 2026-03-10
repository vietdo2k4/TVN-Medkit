import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

/* CSS tách nhỏ */
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";

import "./styles/utilities.css";
import "./styles/pages.css";
import "./App.css";

createRoot(document.getElementById("root")).render(<App />);
