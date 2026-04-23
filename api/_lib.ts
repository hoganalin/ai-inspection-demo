import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const ALLOWED_MEDIA_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set on the server.');
  }
  return new Anthropic({ apiKey });
}

export function normalizeMediaType(mt: string): ImageMediaType {
  if (!ALLOWED_MEDIA_TYPES.includes(mt)) {
    throw new Error(`Unsupported image media type: ${mt}. Allowed: ${ALLOWED_MEDIA_TYPES.join(', ')}`);
  }
  return mt as ImageMediaType;
}

export function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
}

export function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
}

export function httpStatusFor(err: unknown): number {
  if (err instanceof Anthropic.APIError) return err.status ?? 500;
  return 500;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}
