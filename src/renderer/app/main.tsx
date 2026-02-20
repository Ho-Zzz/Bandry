import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import { AppRouter } from "./router";
import "../styles/globals.css";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <HeroUIProvider>
        <AppRouter />
      </HeroUIProvider>
    </StrictMode>
  );
}
