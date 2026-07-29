export type WechatPayConfig = {
  appId: string
  mchId: string
  privateKey: string
  certSerialNo: string
  apiV3Key: string
  notifyUrl: string
  pubKeyId?: string
  pubKey?: string
  baseUrl?: string
}

export type NativeOrderParams = {
  description?: string
  out_trade_no: string
  amount: { total: number; currency?: string }
  time_expire?: string
  attach?: string
  goods_tag?: string
  support_fapiao?: boolean
  detail?: object
  scene_info?: object
  settle_info?: object
}

export type NativeOrderResult = {
  code_url: string
}

export type Transaction = {
  appid: string
  mchid: string
  out_trade_no: string
  transaction_id: string
  trade_type: string
  trade_state: string
  trade_state_desc: string
  bank_type: string
  attach?: string
  success_time: string
  payer: { openid: string }
  amount: {
    total: number
    payer_total: number
    currency: string
    payer_currency: string
  }
}

export type NotificationBody = {
  id: string
  create_time: string
  event_type: string
  resource_type: string
  resource: {
    algorithm: string
    ciphertext: string
    associated_data?: string
    original_type: string
    nonce: string
  }
  summary: string
}

type KeyUsage = "encrypt" | "decrypt" | "sign" | "verify" | "deriveKey" | "deriveBits" | "wrapKey" | "unwrapKey";

function generateNonceStr(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s+/g, '')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

async function importKey(
  pem: string,
  format: 'pkcs8' | 'spki',
  keyUsages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    format,
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    keyUsages,
  )
}

async function rsaSign(message: string, privateKey: CryptoKey): Promise<string> {
  const data = new TextEncoder().encode(message)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data)
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function rsaVerify(message: string, signature: string, publicKey: CryptoKey): Promise<boolean> {
  const data = new TextEncoder().encode(message)
  const sig = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sig, data)
}

async function decryptAesGcm(
  aesKey: CryptoKey,
  nonce: string,
  ciphertext: string,
  associatedData: string,
): Promise<string> {
  const raw = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const iv = new TextEncoder().encode(nonce)
  const aad = associatedData ? new TextEncoder().encode(associatedData) : undefined
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    aesKey,
    raw,
  )
  return new TextDecoder().decode(plaintext)
}

function makeWechatPayApi(config: WechatPayConfig) {
  const baseUrl = config.baseUrl ?? 'https://api.mch.weixin.qq.com'
  const privateKey = importKey(config.privateKey, 'pkcs8', ['sign'])
  const pubKey = config.pubKey ? importKey(config.pubKey, 'spki', ['verify']) : undefined
  const aesKey = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(config.apiV3Key),
    'AES-GCM',
    false,
    ['decrypt'],
  )

  async function buildAuthHeader(method: string, path: string, body: string) {
    const timestamp = getTimestamp()
    const nonceStr = generateNonceStr()
    const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`
    const signature = await rsaSign(message, await privateKey)
    return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.certSerialNo}"`
  }

  async function request<T>(method: string, path: string, body?: object): Promise<T> {
    const bodyStr = body ? JSON.stringify(body) : ''
    const Authorization = await buildAuthHeader(method, path, bodyStr)
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: bodyStr || undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`WeChatPay API error: ${res.status} ${JSON.stringify(err)}`)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  return {
    native: {
      async createOrder(params: NativeOrderParams): Promise<NativeOrderResult> {
        return request<NativeOrderResult>('POST', '/v3/pay/transactions/native', {
          appid: config.appId,
          mchid: config.mchId,
          notify_url: config.notifyUrl,
          ...params,
        })
      },

      async queryByOutTradeNo(outTradeNo: string): Promise<Transaction> {
        const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${config.mchId}`
        return request<Transaction>('GET', path)
      },

      async closeOrder(outTradeNo: string): Promise<void> {
        const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}/close`
        await request<void>('POST', path, { mchid: config.mchId })
      },

      async parseNotification(
        headers: Record<string, string | string[] | undefined>,
        body: string,
      ): Promise<Transaction> {
        const timestamp = headers['wechatpay-timestamp'] as string
        const nonce = headers['wechatpay-nonce'] as string
        const signature = headers['wechatpay-signature'] as string

        const message = `${timestamp}\n${nonce}\n${body}\n`
        if (pubKey) {
          if (!(await rsaVerify(message, signature, await pubKey))) {
            throw new Error('Invalid WechatPay notification signature')
          }
        }

        const notification = JSON.parse(body) as NotificationBody
        if (notification.resource.algorithm !== 'AEAD_AES_256_GCM') {
          throw new Error(`Unsupported algorithm: ${notification.resource.algorithm}`)
        }

        const plaintext = await decryptAesGcm(
          await aesKey,
          notification.resource.nonce,
          notification.resource.ciphertext,
          notification.resource.associated_data ?? '',
        )

        return JSON.parse(plaintext) as Transaction
      },
    },
  }
}

function readEnvOrThrow(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env: ${name}`)
  return val
}

import { readFileSync } from "node:fs"

function getConfig(): WechatPayConfig {
  const privateKey = readFileSync(readEnvOrThrow("WECHAT_PAY_PRIVATE_KEY_PATH"), "utf8")
  const pubKeyPath = process.env.WECHAT_PAY_PUB_KEY_PATH
  const pubKey = pubKeyPath ? readFileSync(pubKeyPath, "utf8") : undefined

  return {
    appId: readEnvOrThrow("WECHAT_PAY_APP_ID"),
    mchId: readEnvOrThrow("WECHAT_PAY_MCH_ID"),
    privateKey,
    certSerialNo: readEnvOrThrow("WECHAT_PAY_CERT_SERIAL_NO"),
    apiV3Key: readEnvOrThrow("WECHAT_PAY_API_V3_KEY"),
    notifyUrl: readEnvOrThrow("WECHAT_PAY_NOTIFY_URL"),
    pubKey,
  }
}

let _api: ReturnType<typeof makeWechatPayApi> | null = null

export function getWechatPayApi() {
  if (!_api) _api = makeWechatPayApi(getConfig())
  return _api
}
