import type { AIResultItem } from "@marking/server";

type MessageActionDataRet = {
    getAIResult: [{ url: string }, { result: AIResultItem[], markRecordId: number } | { error: string }],
    confirmMark: [{ markRecordId: number }, { success: true, usage: { confirmedCount: number } } | { error: string }],
    hello: [undefined, string],
    usageUpdated: [{ usage: { confirmedCount: number } }, undefined],
    getResponse: [{ url: string }, { dataUrl: string | undefined }],
    urlResponseUpdated: [string, undefined]
}

type MessageT<K> = K extends keyof MessageActionDataRet ? MessageActionDataRet[K][0] extends undefined ? { action: K, data?: MessageActionDataRet[K][0] } : {
    action: K,
    data: MessageActionDataRet[K][0]
} : never

type Message = MessageT<keyof MessageActionDataRet>

export const sendMessage = <const M extends Message>(msg: M) => {
    return chrome.runtime.sendMessage<M, MessageActionDataRet[M['action']][1]>(msg)
}

export const sendTabMessage = <const M extends Message>(tabId: number, msg: M) => {
    return chrome.tabs.sendMessage<M, MessageActionDataRet[M['action']][1]>(tabId, msg)
}

export const addEventListener = <const A extends keyof MessageActionDataRet>(action: A, handler: (data: (Message & { action: A })['data'], sender: chrome.runtime.MessageSender) => Promise<MessageActionDataRet[A][1]>) => {
    const wrapper = (msg: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
        if (msg.action === action) {
            // 不直接 return Promise：Chrome 144+ 开始支持将 Promise 作为 onMessage
            // 返回值进行异步响应，但该功能在 144 首次发布后因兼容性问题被回滚，
            // 直到 148 才完全覆盖所有用户（chromium-extensions PSA）。
            // 改用 return true + sendResponse 兼容所有版本。
            handler(msg.data, sender).then(sendResponse).catch(console.error)
            return true
        }
    }
    chrome.runtime.onMessage.addListener(wrapper)
    return () => chrome.runtime.onMessage.removeListener(wrapper)
}
