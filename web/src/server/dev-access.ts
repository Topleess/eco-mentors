export function isLocalDevelopment(host: string | undefined): boolean {
  return process.env.NODE_ENV === 'development' &&
    process.env.APP_ENV === 'development' &&
    typeof host === 'string' &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)
}
