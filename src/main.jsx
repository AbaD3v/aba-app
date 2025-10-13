import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.jsx"

// 🚀 Точка входа в React-приложение
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
)
