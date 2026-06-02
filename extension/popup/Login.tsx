import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { BACKEND_URL } from "../constants";
import { api } from "../api";

type Props = {
  onLogin: (token: string) => void;
};

export function Login({ onLogin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uuidRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const uuid = crypto.randomUUID();
    uuidRef.current = uuid;

    // const controller = new AbortController();

    api.wechat.qr({
      sceneParam: uuid
    })
      .then((data) => {
        if (data.url && canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, data.url, { width: 200 });
        }
      })
      .catch(() => { });

    const interval = setInterval(async () => {
      try {
        ;
        const data = await api.wechat.poll({uuid})
        if (data.status === "completed" && data.token) {
          clearInterval(interval);
          setDone(true);
          onLogin(data.token);
        } else if (data.status === "expired") {
          clearInterval(interval);
          setError("二维码已过期，请刷新");
        }
      } catch { }
    }, 2000);

    return () => {
      // controller.abort();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-5">
      <h2 className="text-lg font-bold">扫码登录</h2>
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : done ? (
        <p className="text-green-600">登录成功</p>
      ) : (
        <>
          <canvas ref={canvasRef} />
          <p className="text-sm text-gray-500">请使用微信扫描二维码</p>
        </>
      )}
    </div>
  );
}
