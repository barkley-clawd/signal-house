function firstDefined(values: Array<string | undefined>): string | undefined {
  return values.find(value => value !== undefined)
}

export function getEnv(env: NodeJS.ProcessEnv, key: string, fallbackKey?: string): string | undefined {
  return firstDefined([env[key], fallbackKey ? env[fallbackKey] : undefined])
}

export function getBooleanEnv(env: NodeJS.ProcessEnv, key: string, fallbackKey?: string): boolean {
  return getEnv(env, key, fallbackKey) === 'true'
}

