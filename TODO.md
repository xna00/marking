- [ ] extension/message.ts: addEventListener wrapper 增加统一错误处理，.then(sendResponse) 改为
      .then(res => sendResponse({ succeed: true, data: res }))
      .catch(e => sendResponse({ succeed: false, data: String(e) }))
      sendMessage/sendTabMessage 同步解包，失败时 throw
- [ ] server/api/handler.ts: 用 AsyncLocalStorage 替代全局 idMap + 递增 counter 传 request context
- [x] server/api/global.ts: Info.headers 未被任何代码读取/写入，可清理
- [ ] server/api/handler.ts: parseFn 不限制路径嵌套深度，过深路径返回 404 而非明确错误
- [x] api/index.ts: callWithFetchOption 固定 res.json()，无法处理非 JSON 响应
- [ ] server/api/wechat/qr.ts: 把微信客服 URL 通过我们自己的服务器重定向，防止过期二维码被保存后扫描
- [x] server/nodeAdapter.ts: 不支持 Content-Encoding (gzip)，压缩请求体会导致 parse 失败
- [ ] 支持自动模型选择：根据图片内容自动匹配最适合的模型并设置 image detail
- [ ] 风控：检测大量未 confirm 的 markRecord，自动封禁异常账号
- [ ] urlResponseMap 改成  `Map<string, {promise: Promise<string>, resolve, reject}>`, imageMap `Map<string, {promise: Promise<string>, resolve, reject}`