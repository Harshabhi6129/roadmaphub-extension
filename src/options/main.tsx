import React from "react";
import { createRoot } from "react-dom/client";
import { OptionsApp } from "./OptionsApp";
import "@/styles/tailwind.css";

const root = document.getElementById("root")!;
createRoot(root).render(React.createElement(OptionsApp));
