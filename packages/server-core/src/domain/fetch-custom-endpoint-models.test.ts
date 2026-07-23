import { describe, expect, it, mock } from 'bun:test'
import {
  fetchCustomEndpointModels,
  parseCustomEndpointModelsResponse,
  resolveCustomEndpointModelsUrls,
  sanitizeApiKeyForHeaders,
} from './fetch-custom-endpoint-models'

describe('sanitizeApiKeyForHeaders', () => {
  it('trims and returns a valid Latin1 key', () => {
    expect(sanitizeApiKeyForHeaders('  sk-test  ')).toBe('sk-test')
  })

  it('treats empty and whitespace-only keys as absent', () => {
    expect(sanitizeApiKeyForHeaders(undefined)).toBeUndefined()
    expect(sanitizeApiKeyForHeaders('')).toBeUndefined()
    expect(sanitizeApiKeyForHeaders('   ')).toBeUndefined()
  })

  it('treats masked bullet placeholders as absent (never send as Authorization)', () => {
    expect(sanitizeApiKeyForHeaders('••••••••')).toBeUndefined()
    expect(sanitizeApiKeyForHeaders('sk-ant-••••••••abcd')).toBeUndefined()
  })

  it('rejects other non-Latin1 characters with a clear error (not ByteString crash)', () => {
    expect(() => sanitizeApiKeyForHeaders('sk-test-🔑')).toThrow(/invalid characters/)
    expect(() => sanitizeApiKeyForHeaders('sk-test-\u201Cquoted\u201D')).toThrow(/invalid characters/)
  })
})

describe('resolveCustomEndpointModelsUrls', () => {
  it('uses /models for OpenAI-compatible bases that already include /v1', () => {
    expect(resolveCustomEndpointModelsUrls('https://opencode.ai/zen/v1', 'openai-completions'))
      .toEqual(['https://opencode.ai/zen/v1/models'])
  })

  it('tries /models then /v1/models when base has no version suffix', () => {
    expect(resolveCustomEndpointModelsUrls('https://api.example.com', 'openai-completions'))
      .toEqual([
        'https://api.example.com/models',
        'https://api.example.com/v1/models',
      ])
  })

  it('prefers /v1/models for Anthropic-compatible bases without /v1', () => {
    expect(resolveCustomEndpointModelsUrls('https://api.anthropic.com', 'anthropic-messages'))
      .toEqual([
        'https://api.anthropic.com/v1/models',
        'https://api.anthropic.com/models',
      ])
  })

  it('strips trailing slashes', () => {
    expect(resolveCustomEndpointModelsUrls('https://opencode.ai/zen/v1/', 'openai-completions'))
      .toEqual(['https://opencode.ai/zen/v1/models'])
  })
})

describe('parseCustomEndpointModelsResponse', () => {
  it('parses OpenAI { data: [...] } payloads', () => {
    expect(parseCustomEndpointModelsResponse({
      data: [
        { id: 'gpt-4o', object: 'model' },
        { id: 'o3-mini', object: 'model', name: 'o3 mini' },
      ],
    })).toEqual([
      { id: 'gpt-4o', name: 'gpt-4o' },
      { id: 'o3-mini', name: 'o3 mini' },
    ])
  })

  it('parses { models: [...] } and string entries', () => {
    expect(parseCustomEndpointModelsResponse({
      models: ['alpha', { id: 'beta', display_name: 'Beta' }],
    })).toEqual([
      { id: 'alpha', name: 'alpha' },
      { id: 'beta', name: 'Beta' },
    ])
  })

  it('skips non-model objects and duplicates', () => {
    expect(parseCustomEndpointModelsResponse({
      data: [
        { id: 'keep', object: 'model' },
        { id: 'skip', object: 'embedding' },
        { id: 'keep', object: 'model' },
      ],
    })).toEqual([{ id: 'keep', name: 'keep' }])
  })
})

describe('fetchCustomEndpointModels', () => {
  it('returns models from the first successful URL', async () => {
    const fetchImpl = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({
          data: [{ id: 'free-model', object: 'model' }],
        }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch

    const result = await fetchCustomEndpointModels({
      baseUrl: 'https://opencode.ai/zen/v1',
      apiKey: 'sk-test',
      api: 'openai-completions',
      fetchImpl,
    })

    expect(result.models).toEqual([{ id: 'free-model', name: 'free-model' }])
    expect(result.fetchedFrom).toBe('https://opencode.ai/zen/v1/models')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to /v1/models after a 404 on /models', async () => {
    const fetchImpl = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/v1/models')) {
        return new Response(JSON.stringify({
          data: [{ id: 'claude-sonnet-4-6', display_name: 'Sonnet 4.6' }],
        }), { status: 200 })
      }
      return new Response('missing', { status: 404 })
    }) as unknown as typeof fetch

    const result = await fetchCustomEndpointModels({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test',
      api: 'openai-completions',
      fetchImpl,
    })

    expect(result.models).toEqual([{ id: 'claude-sonnet-4-6', name: 'Sonnet 4.6' }])
    expect(result.fetchedFrom).toBe('https://api.example.com/v1/models')
  })

  it('surfaces a clear error when the endpoint has no model list', async () => {
    const fetchImpl = mock(async () => new Response('missing', { status: 404 })) as unknown as typeof fetch

    await expect(fetchCustomEndpointModels({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      fetchImpl,
    })).rejects.toThrow(/does not expose a model list/)
  })

  it('surfaces auth failures without trying fallbacks', async () => {
    const fetchImpl = mock(async () => new Response('nope', { status: 401 })) as unknown as typeof fetch

    await expect(fetchCustomEndpointModels({
      baseUrl: 'https://api.example.com',
      apiKey: 'bad',
      fetchImpl,
    })).rejects.toThrow(/Invalid API key/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('omits Authorization when apiKey is empty (keyless local servers)', async () => {
    const fetchImpl = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.has('Authorization')).toBe(false)
      return new Response(JSON.stringify({
        data: [{ id: 'local-model', object: 'model' }],
      }), { status: 200 })
    }) as unknown as typeof fetch

    const result = await fetchCustomEndpointModels({
      baseUrl: 'http://127.0.0.1:8000/v1',
      apiKey: '',
      fetchImpl,
    })

    expect(result.models).toEqual([{ id: 'local-model', name: 'local-model' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('omits Authorization for masked bullet keys instead of ByteString-crashing', async () => {
    const fetchImpl = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.has('Authorization')).toBe(false)
      return new Response(JSON.stringify({
        data: [{ id: 'free-model', object: 'model' }],
      }), { status: 200 })
    }) as unknown as typeof fetch

    const result = await fetchCustomEndpointModels({
      baseUrl: 'http://127.0.0.1:8000/v1',
      apiKey: 'sk-ant-••••••••abcd',
      fetchImpl,
    })

    expect(result.models).toEqual([{ id: 'free-model', name: 'free-model' }])
  })

  it('throws a clear error for non-ASCII keys (not undici ByteString)', async () => {
    const fetchImpl = mock(async () => new Response('should not be called', { status: 500 })) as unknown as typeof fetch

    await expect(fetchCustomEndpointModels({
      baseUrl: 'http://127.0.0.1:8000/v1',
      apiKey: 'sk-test-🔑',
      fetchImpl,
    })).rejects.toThrow(/invalid characters/)
    expect(fetchImpl).toHaveBeenCalledTimes(0)
  })
})
