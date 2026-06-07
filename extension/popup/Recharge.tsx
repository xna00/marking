import wechatPng from "./wechat.png";
import usernamePng from "./username.png";

export const Recharge = () => (
  <div className="p-5 text-center">
    <p className="text-lg font-bold mb-3">加微信充值</p>
    <img src={wechatPng} alt="微信二维码" className="mx-auto w-48" />
    <p className="text-gray-500 text-sm mt-3">扫码加好友充值</p>
    <p className="text-gray-500 text-sm">或添加微信号 <span className="font-mono font-bold">silentwave3</span></p>
    <p className="text-gray-500 text-sm mt-3">加好友后把用户名发给我</p>
    <p className="text-gray-500 text-sm">在当前用户后面显示的四位数字：</p>
    <img src={usernamePng} alt="用户名位置" className="mx-auto mt-1 max-w-full" style={{ width: 380 }} />
    <p className="text-gray-500 text-sm mt-3">价格：0.5 元 / 100 份</p>
  </div>
);
