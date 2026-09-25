import { useStore } from '@/context/StoreContext';
import { NotFoundPage } from '@/pages/NotFoundPage';

// 配送、退换、隐私、条款等文字页面，内容在 Saleor 后台「页面」中编辑
export function ContentPage({ slug }: { slug: string }) {
  const { store } = useStore();
  const page = store!.pages[slug];
  if (!page) return <NotFoundPage />;

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      <article className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <h1 className="text-3xl md:text-4xl font-light tracking-tight text-neutral-900 mb-10 text-center">{page.title}</h1>
        <div className="space-y-5">
          {page.paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] leading-[1.9] text-neutral-700 whitespace-pre-line">{p}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
