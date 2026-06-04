type MessageActionDataRet = {
    getAIResult: [{ url: string }, { result: [string, number, string][], markRecordId: number } | { error: string }],
    confirmMark: [{ markRecordId: number }, { success: true, usage: { confirmedCount: number } } | { error: string }],
    hello: [undefined, string],
    usageUpdated: [{ usage: { confirmedCount: number } }, undefined],
    syncCurrentImage: [undefined, { dataUrl: string | undefined }],
    getResponse: [{ url: string }, { dataUrl: string | undefined }],
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
    const wrapper = (msg: any, sender: chrome.runtime.MessageSender) => {
        if (msg.action === action) {
            return handler(msg.data, sender)
        }
    }
    chrome.runtime.onMessage.addListener(wrapper)
    return () => chrome.runtime.onMessage.removeListener(wrapper)
}
