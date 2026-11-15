import { render, act } from '@testing-library/react'
import { createRef } from 'react'
import Captcha, { type CaptchaInstance } from '../Captcha'

jest.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => <div data-testid="legacy" /> }))

test('SmartCaptcha renders, clears expired tokens and resets on retry', () => {
 process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER = 'smartcaptcha'
 process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY = 'public-test-key'
 const success = jest.fn(), expired = jest.fn(), reset = jest.fn(), destroy = jest.fn()
 let callback: (token: string) => void = () => undefined
 const events: Record<string, () => void> = {}
 window.smartCaptcha = { render: jest.fn((_node, opts) => { callback = opts.callback; return 7 }), subscribe: jest.fn((_id, event, cb) => { events[event] = cb; return () => undefined }), reset, destroy }
 const ref = createRef<CaptchaInstance>()
 const view = render(<Captcha ref={ref} siteKey="old" onSuccess={success} onExpire={expired} options={{language:'ru'}} />)
 expect(window.smartCaptcha.render).toHaveBeenCalled()
 act(() => callback('human-token'))
 expect(success).toHaveBeenCalledWith('human-token')
 act(() => events['token-expired']())
 expect(expired).toHaveBeenCalled()
 act(() => ref.current?.reset())
 expect(reset).toHaveBeenCalledWith(7)
 view.unmount()
 expect(destroy).toHaveBeenCalledWith(7)
 delete window.smartCaptcha
 delete process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER
})
