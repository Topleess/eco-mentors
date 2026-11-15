import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Turnstile, type TurnstileInstance, type TurnstileProps } from '@marsidev/react-turnstile'

export type CaptchaInstance = Pick<TurnstileInstance, 'reset'>
type SmartCaptchaAPI = {
 render: (node: HTMLElement, options: { sitekey: string; hl: string; callback: (token: string) => void }) => number
 subscribe: (id: number, event: string, callback: () => void) => (() => void)
 reset: (id: number) => void
 destroy: (id: number) => void
}
declare global { interface Window { smartCaptcha?: SmartCaptchaAPI } }

const Captcha = forwardRef<CaptchaInstance, TurnstileProps>(function Captcha(props, ref) {
 const legacy = useRef<TurnstileInstance>(null)
 const node = useRef<HTMLDivElement>(null)
 const widget = useRef<number | null>(null)
 const callbacks = useRef(props)
 callbacks.current = props
 const smart = process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER === 'smartcaptcha'
 const language = props.options?.language === 'en' ? 'en' : 'ru'
 useImperativeHandle(ref, () => ({ reset: () => {
  if (smart) {
   callbacks.current.onExpire?.('expired')
   if (widget.current !== null) window.smartCaptcha?.reset(widget.current)
  } else legacy.current?.reset()
 } }), [smart])
 useEffect(() => {
  if (!smart) return
  let disposed = false
  const unsubscribers: (() => void)[] = []
  const clear = (): void => { callbacks.current.onExpire?.('expired') }
  const mount = (): void => {
   const api = window.smartCaptcha
   if (disposed || !api || !node.current || widget.current !== null) return
   const key = process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY
   if (!key) { clear(); return }
   widget.current = api.render(node.current, { sitekey: key, hl: language, callback: (token) => callbacks.current.onSuccess?.(token) })
   for (const event of ['token-expired', 'network-error', 'javascript-error']) unsubscribers.push(api.subscribe(widget.current, event, clear))
  }
  let script = document.querySelector<HTMLScriptElement>('script[data-smartcaptcha]')
  if (!script && !window.smartCaptcha) {
   script = document.createElement('script')
   script.dataset.smartcaptcha = 'true'
   script.src = 'https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload'
   script.async = true
   document.head.appendChild(script)
  }
  script?.addEventListener('load', mount)
  script?.addEventListener('error', clear)
  mount()
  return () => {
   disposed = true
   script?.removeEventListener('load', mount)
   script?.removeEventListener('error', clear)
   unsubscribers.forEach(unsubscribe => unsubscribe())
   if (widget.current !== null) window.smartCaptcha?.destroy(widget.current)
   widget.current = null
  }
 }, [smart, language])
 if (!smart) {
  if (process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER && process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER !== 'turnstile') return null
  return <Turnstile {...props} ref={legacy} />
 }
 return <div ref={node} style={{ minHeight: 100 }} data-testid="smartcaptcha" />
})
export default Captcha
