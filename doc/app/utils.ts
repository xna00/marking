const pad = (n: number) => String(n).padStart(2, "0");

// 按浏览器本地时区格式化时间；无法解析的输入原样返回，避免显示 NaN
export function formatTime(iso: string, options: { seconds?: boolean } = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return options.seconds ? `${date} ${time}:${pad(d.getSeconds())}` : `${date} ${time}`;
}
