import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/styles/index.css";
import "@/styles/auth.css";
import "@/styles/cart.css";
import "@/styles/details.css";
import "@/styles/embroidery.css";
import "@/styles/i18n.css";
import "@/styles/l10n-home.css";
import "@/styles/l10n-configurator.css";
import "@/styles/configurator-flow.css";
import "@/styles/l10n-auth.css";
import "@/styles/l10n-cart.css";
import "@/styles/group.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
