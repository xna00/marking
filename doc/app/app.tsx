import { createRoot } from "react-dom/client";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { createHandler } from "@marking/api";
import { Usage } from "./Usage.js";
import { Recharge } from "./Recharge.js";
import { Login } from "./Login.js";
import { AdminRecharge } from "./AdminRecharge.js";
import { MarkLogs } from "./MarkLogs.js";
import { AdminUsers } from "./AdminUsers.js";
import { AdminModels } from "./AdminModels.js";
import "./index.css";

const KEY = "authToken";

// token 由 content script 写入 sessionStorage，这里用模块级 deferred 等它就绪
let resolveToken: (() => void) | undefined;
const tokenReady = new Promise<void>((r) => {
  resolveToken = r;
});

window.addEventListener("message", (e) => {
  if (e.data?.type !== "MARKING_TOKEN_READY") return;
  resolveToken?.();
});

// 主动请求 content script 注入 token（content script 的监听必然已就绪）
window.postMessage({ type: "MARKING_REQUEST_TOKEN" }, "*");
// 兜底：没装扩展时也要 resolve，否则所有请求会永久挂起
setTimeout(() => resolveToken?.(), 1000);

export const api = createHandler("/api", {
  fetcher: async (req, init) => {
    await tokenReady;
    const t = sessionStorage.getItem(KEY);
    if (t) req.headers.set("Authorization", `Bearer ${t}`);
    return fetch(req, init);
  },
});

const App = () => (
  <Router hook={useHashLocation}>
    <Switch>
      <Route path="/usage"><Usage /></Route>
      <Route path="/recharge"><Recharge /></Route>
      <Route path="/login"><Login /></Route>
      <Route path="/admin"><AdminRecharge /></Route>
      <Route path="/admin/mark-logs"><MarkLogs /></Route>
      <Route path="/admin/users"><AdminUsers /></Route>
      <Route path="/admin/models"><AdminModels /></Route>
    </Switch>
  </Router>
);

createRoot(document.getElementById("app")!).render(<App />);
