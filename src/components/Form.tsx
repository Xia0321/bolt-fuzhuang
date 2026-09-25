import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { primaryButtonClass } from '@/components/formStyles';

export function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] tracking-[0.05em] text-neutral-500 mb-1.5">
        {label}{required && <span className="text-neutral-900"> *</span>}
        {hint && <span className="text-neutral-400"> · {hint}</span>}
      </span>
      {children}
      {error && <span className="block text-[12px] text-red-600 mt-1">{error}</span>}
    </label>
  );
}

export function PrimaryButton({ busy, disabled, children }: { busy: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={busy || disabled} className={primaryButtonClass}>
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-red-600 bg-red-50 px-4 py-3">{children}</p>;
}
