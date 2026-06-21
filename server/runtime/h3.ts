export type H3Event = { headers?: Record<string, string> }

export const defineEventHandler = <T>(handler: T) => handler
export const createError = (error: unknown) => error
export const getRequestHeader = (event: H3Event, key: string) => event.headers?.[key]
export const setResponseHeader = (_event: H3Event, _key: string, _value: string) => {}
