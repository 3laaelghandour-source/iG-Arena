import "./styles.css";
import { App } from "./app/App";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("The iG Arena app root was not found.");
}

new App(root);
