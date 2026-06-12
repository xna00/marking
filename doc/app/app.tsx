import { createRoot } from "react-dom/client";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { createHandler } from "@marking/api";
import { Usage } from "./Usage.js";
import { Recharge } from "./Recharge.js";

const params = new URLSearchParams(location.search);
const token = params.get("token") || sessionStorage.getItem("authToken");
if (token) sessionStorage.setItem("authToken", token);
history.replaceState(null, "", location.pathname + location.hash);

export const api = createHandler("/api", {
  beforeRequest: async (req) => {
    const t = sessionStorage.getItem("authToken");
    if (t) req.headers.set("Authorization", `Bearer ${t}`);
    return req;
  },
});

const App = () => (
  <Router hook={useHashLocation}>
    <Switch>
      <Route path="/usage"><Usage /></Route>
      <Route path="/recharge"><Recharge /></Route>
    </Switch>
  </Router>
);

createRoot(document.getElementById("app")!).render(<App />);
