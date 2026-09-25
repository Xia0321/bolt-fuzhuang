import type { ReactNode } from 'react';

// 登录、注册、找回密码页面的统一版式
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      <div className="max-w-[420px] mx-auto px-4 py-14 md:py-20">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-3 text-center">{title}</h1>
        {subtitle ? <p className="text-[14px] text-neutral-500 text-center mb-10 leading-relaxed">{subtitle}</p> : <div className="mb-10" />}
        {children}
      </div>
    </div>
  );
}
