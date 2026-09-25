import { SALEOR_API_URL } from '@/config';

export class SaleorError extends Error {
  code?: string;
  field?: string | null;
  constructor(message: string, code?: string, field?: string | null) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

interface MutationError {
  field?: string | null;
  message?: string | null;
  code?: string;
}

export async function saleorFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(SALEOR_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new SaleorError(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new SaleorError(json.errors[0].message);
  return json.data as T;
}

// mutation 返回的业务错误（库存不足、地址不合法等）统一抛出
export function throwIfErrors(errors: MutationError[] | undefined | null) {
  if (errors && errors.length) {
    const e = errors[0];
    throw new SaleorError(e.message || e.code || 'Error', e.code, e.field);
  }
}

// Saleor 富文本为 EditorJS JSON，这里取出纯文本段落
export function richTextToParagraphs(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const doc = JSON.parse(json);
    return (doc.blocks || [])
      .map((b: { data?: { text?: string; items?: string[] } }) => b.data?.text ?? (b.data?.items || []).join('\n'))
      .map((html: string) => (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
