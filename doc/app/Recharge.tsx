import { useState, useEffect } from "react";
import { api } from "./app.js";
import QRCode from "qrcode";
import wechatPng from "./wechat.png";
import usernamePng from "./username.png";

const PLANS = [
  { credits: 100, price: 0.3 },
  { credits: 300, price: 0.9 },
  { credits: 500, price: 1.5 },
  { credits: 1000, price: 3 },
];

export const Recharge = () => {
  const [selectedCredits, setSelectedCredits] = useState(100);
  const [qrUrl, setQrUrl] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "qr" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const plan = PLANS.find(p => p.credits === selectedCredits)!;

  useEffect(() => {
    if (status !== "qr" || !orderNo) return;
    const timer = setInterval(async () => {
      try {
        const res = await api.wechatPay.getQuery({ outTradeNo: orderNo });
        if (res.status === "success") {
          setStatus("success");
          setMessage(`充值 ${selectedCredits} 次成功`);
          clearInterval(timer);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [status, orderNo, selectedCredits]);

  const handlePay = async () => {
    setStatus("loading");
    setMessage("");
    setQrUrl("");
    try {
      const res = await api.wechatPay.createOrder({ credits: selectedCredits });
      const dataUrl = await QRCode.toDataURL(res.codeUrl, { width: 256 });
      setQrUrl(dataUrl);
      setOrderNo(res.outTradeNo);
      setStatus("qr");
      setMessage("请用微信扫码支付");
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "创建订单失败");
    }
  };

  const handleManualCheck = async () => {
    if (!orderNo) return;
    try {
      const res = await api.wechatPay.getQuery({ outTradeNo: orderNo });
      if (res.status === "success") {
        setStatus("success");
        setMessage(`充值 ${selectedCredits} 次成功`);
      } else {
        setMessage("尚未支付成功，请确认已扫码付款");
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "查询失败");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setMessage("");
    setQrUrl("");
    setOrderNo("");
  };

  return (
    <div style={{ padding: "20px", maxWidth: "480px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", textAlign: "center" }}>充值</h2>

      {status === "success" ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px", color: "#07c160" }}>✓</div>
          <p style={{ fontSize: "16px", color: "#07c160", fontWeight: "bold", marginBottom: "20px" }}>{message}</p>
          <button onClick={handleReset} style={{ padding: "8px 24px", fontSize: "14px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "6px", background: "#fff" }}>继续充值</button>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            {PLANS.map(p => (
              <div
                key={p.credits}
                onClick={() => { setSelectedCredits(p.credits); handleReset(); }}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: `2px solid ${selectedCredits === p.credits ? "#2563eb" : "#eee"}`,
                  cursor: "pointer",
                  textAlign: "center",
                  background: selectedCredits === p.credits ? "#eff6ff" : "#fff",
                }}
              >
                <div style={{ fontSize: "18px", fontWeight: "bold" }}>{p.credits} 次</div>
                <div style={{ fontSize: "14px", color: "#666" }}>¥{p.price}</div>
              </div>
            ))}
          </div>

          {status === "qr" && qrUrl && (
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <img src={qrUrl} alt="微信支付二维码" style={{ width: 256, height: 256, display: "block", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>{message}</p>
              <button onClick={handleManualCheck} style={{ padding: "6px 16px", fontSize: "13px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "6px", background: "#f9f9f9" }}>手动查询</button>
            </div>
          )}

          {status === "loading" && (
            <div style={{ textAlign: "center", padding: "24px", color: "#666" }}>正在创建订单...</div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <p style={{ color: "red", fontSize: "14px", marginBottom: "8px" }}>{message}</p>
              <button onClick={handlePay} style={{ padding: "8px 24px", fontSize: "14px", cursor: "pointer", border: "none", borderRadius: "6px", background: "#07c160", color: "#fff" }}>重试</button>
            </div>
          )}

          {status === "idle" && (
            <button
              onClick={handlePay}
              style={{
                width: "100%", padding: "12px", fontSize: "16px", cursor: "pointer", border: "none", borderRadius: "8px",
                background: "#07c160", color: "#fff", fontWeight: "bold",
              }}
            >
              去支付 ¥{plan.price}
            </button>
          )}
        </>
      )}

      <div style={{ marginTop: "32px", borderTop: "1px solid #eee", paddingTop: "16px" }}>
        <p style={{ fontSize: "14px", color: "#999", textAlign: "center", marginBottom: "12px" }}>也支持人工转账充值</p>
        <div style={{ textAlign: "center" }}>
          <img src={wechatPng} alt="微信二维码" style={{ width: 192, margin: "0 auto 8px", display: "block" }} />
          <p style={{ fontSize: "13px", color: "#666" }}>扫码加微信 <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>silentwave3</span></p>
          <p style={{ fontSize: "13px", color: "#666", marginTop: "8px" }}>加好友后转账并发送用户名</p>
          <p style={{ fontSize: "13px", color: "#666" }}>用户名的四位数字：</p>
          <img src={usernamePng} alt="用户名位置" style={{ maxWidth: "100%", margin: "4px auto", display: "block" }} />
        </div>
      </div>
    </div>
  );
};
