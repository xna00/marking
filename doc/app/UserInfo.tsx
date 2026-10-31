import { useState } from "react";

// 微信头像存的是 http://wx.qlogo.cn/...，后台走 https 时会被浏览器当混合内容拦掉
const toSafeUrl = (url: string) => url.replace(/^http:\/\//, "https://");

type UserInfoProps = {
  username: string;
  nickname?: string | null;
  avatar?: string | null;
  /** 头像尺寸，默认 24 */
  size?: number;
  /** 悬停提示，比如用户的 openid */
  title?: string;
  /** 是否在昵称后显示（用户名），默认显示 */
  showUsername?: boolean;
};

export const UserInfo = ({ username, nickname, avatar, size = 24, title, showUsername = true }: UserInfoProps) => {
  const [failed, setFailed] = useState(false);
  const url = avatar ? toSafeUrl(avatar) : "";
  const name = nickname || username;

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap" title={title}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          onError={() => setFailed(true)}
          className="rounded-full object-cover shrink-0"
          style={{ width: size, height: size }}
        />
      ) : (
        // 无头像或加载失败：灰色圆底兜底，不出现破图标
        <span className="rounded-full bg-gray-200 shrink-0" style={{ width: size, height: size }} />
      )}
      <span>{name}</span>
      {showUsername && nickname && nickname !== username && (
        <span className="text-gray-400 text-xs">（{username}）</span>
      )}
    </div>
  );
};
