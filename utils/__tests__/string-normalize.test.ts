import { describe, expect, it } from '@jest/globals'
import { normalizeModelName, slugToDisplayName } from '../string-normalize'

describe('normalizeModelName', () => {
  it('normalizes plain string: DeepSeek-V4-Flash → deepseek-v4-flash', () => {
    const result = normalizeModelName('DeepSeek-V4-Flash')
    expect(result).toEqual({ slug: 'deepseek-v4-flash', provider: null })
  })

  it('extracts provider prefix: opencode-go/deepseek-v4-flash', () => {
    const result = normalizeModelName('opencode-go/deepseek-v4-flash')
    expect(result).toEqual({ slug: 'opencode-go-deepseek-v4-flash', provider: 'opencode-go' })
  })

  it('collapses whitespace: MiniMax M3 → minimax-m3', () => {
    const result = normalizeModelName('  MiniMax  M3  ')
    expect(result).toEqual({ slug: 'minimax-m3', provider: null })
  })

  it('handles null input: null → (unknown)', () => {
    const result = normalizeModelName(null)
    expect(result).toEqual({ slug: '(unknown)', provider: null })
  })

  it('handles undefined input', () => {
    const result = normalizeModelName(undefined)
    expect(result).toEqual({ slug: '(unknown)', provider: null })
  })

  it('handles empty string', () => {
    const result = normalizeModelName('')
    expect(result).toEqual({ slug: '(unknown)', provider: null })
  })

  it('handles whitespace-only string', () => {
    const result = normalizeModelName('   ')
    expect(result).toEqual({ slug: '(unknown)', provider: null })
  })

  it('preserves dots in version numbers: glm-5.2', () => {
    const result = normalizeModelName('glm-5.2')
    expect(result).toEqual({ slug: 'glm-5.2', provider: null })
  })

  it('preserves dots in k2.7 style versions', () => {
    const result = normalizeModelName('kimi-k2.7-code')
    expect(result).toEqual({ slug: 'kimi-k2.7-code', provider: null })
  })

  it('extracts JSON-object string with id field', () => {
    const result = normalizeModelName('{"id":"gpt-4o","name":"GPT-4o"}')
    expect(result).toEqual({ slug: 'gpt-4o', provider: null })
  })

  it('extracts JSON-object with modelID field', () => {
    const result = normalizeModelName('{"modelID":"claude-sonnet-4","name":"Claude Sonnet 4"}')
    expect(result).toEqual({ slug: 'claude-sonnet-4', provider: null })
  })

  it('handles object value directly', () => {
    const result = normalizeModelName({ id: 'deepseek-v4', name: 'DeepSeek V4' })
    expect(result).toEqual({ slug: 'deepseek-v4', provider: null })
  })

  it('handles object value with model_id field', () => {
    const result = normalizeModelName({ model_id: 'minimax-m3', name: 'MiniMax M3' })
    expect(result).toEqual({ slug: 'minimax-m3', provider: null })
  })

  it('returns (unknown) for non-string, non-object primitive', () => {
    const result = normalizeModelName(42)
    expect(result).toEqual({ slug: '(unknown)', provider: null })
  })

  it('strips leading/trailing hyphens after slugification', () => {
    const result = normalizeModelName('---hello---world---')
    expect(result).toEqual({ slug: 'hello-world', provider: null })
  })
})

describe('slugToDisplayName', () => {
  it('formats deepseek-v4-flash → DeepSeek V4 Flash', () => {
    expect(slugToDisplayName('deepseek-v4-flash')).toBe('DeepSeek V4 Flash')
  })

  it('preserves acronym uppercase: glm-5.2 → GLM 5.2', () => {
    expect(slugToDisplayName('glm-5.2')).toBe('GLM 5.2')
  })

  it('preserves M3 uppercase: minimax-m3 → MiniMax M3', () => {
    expect(slugToDisplayName('minimax-m3')).toBe('MiniMax M3')
  })

  it('strips provider prefix when provided: opencode-go-deepseek-v4-flash', () => {
    expect(slugToDisplayName('opencode-go-deepseek-v4-flash', 'opencode-go')).toBe('DeepSeek V4 Flash')
  })

  it('formats kimi-k2.7-code → Kimi K2.7 Code', () => {
    expect(slugToDisplayName('kimi-k2.7-code')).toBe('Kimi K2.7 Code')
  })

  it('preserves GPT acronym', () => {
    expect(slugToDisplayName('gpt-4o')).toBe('GPT 4o')
  })

  it('handles single-word slug', () => {
    expect(slugToDisplayName('unknown')).toBe('Unknown')
  })

  it('handles provider prefix with no matching provider param', () => {
    // Without provider param, it stays in the slug
    expect(slugToDisplayName('opencode-go-deepseek-v4-flash')).toBe('OpenCode Go DeepSeek V4 Flash')
  })

  it('preserves V1-V5 versions', () => {
    expect(slugToDisplayName('deepseek-v4')).toBe('DeepSeek V4')
  })

  it('preserves R1 version', () => {
    expect(slugToDisplayName('deepseek-r1')).toBe('DeepSeek R1')
  })

  it('handles API acronym', () => {
    expect(slugToDisplayName('my-api')).toBe('My API')
  })
})