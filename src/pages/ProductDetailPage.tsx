import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { localized, formatPrice } from '@/i18n/translations';
import { useCart } from '@/context/CartContext';
import type { Category, Product } from '@/types';
import type { Route } from '@/lib/router';
import { ProductCard } from '@/components/ProductCard';
import { Check, Minus, Plus, ArrowLeft, ShoppingBag } from 'lucide-react';

interface ProductDetailPageProps {
  product: Product | undefined;
  categories: Category[];
  products: Product[];
  navigate: (r: Route) => void;
}

export function ProductDetailPage({ product, categories, products, navigate }: ProductDetailPageProps) {
  const { locale, t } = useI18n();
  const { addItem } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [sizeError, setSizeError] = useState(false);

  useEffect(() => {
    setSelectedImage(0);
    setSelectedSize(null);
    setSelectedColor(0);
    setQuantity(1);
    setAdded(false);
    setSizeError(false);
  }, [product?.id]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-20">
        <div className="text-center">
          <p className="text-neutral-400 text-lg mb-4">{t('error_load')}</p>
          <button onClick={() => navigate({ name: 'shop' })} className="text-neutral-900 underline text-sm">
            {t('detail_back')}
          </button>
        </div>
      </div>
    );
  }

  const category = categories.find(c => c.id === product.category_id);
  const related = products
    .filter(p => p.category_id === product.category_id && p.id !== product.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    if (product.sizes.length > 1 && !selectedSize) {
      setSizeError(true);
      return;
    }
    const size = selectedSize || product.sizes[0] || 'ONE SIZE';
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images[0],
      size,
      colorIndex: selectedColor,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="bg-white min-h-screen pt-16 md:pt-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Breadcrumb */}
        <button
          onClick={() => navigate({ name: 'shop', category: category?.slug })}
          className="inline-flex items-center gap-2 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          {t('detail_back')}
        </button>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-16">
          {/* Images */}
          <div className="flex flex-col-reverse md:flex-row gap-4">
            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex md:flex-col gap-3 md:w-20">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-20 md:w-full md:h-24 overflow-hidden bg-neutral-100 border-2 transition-colors ${selectedImage === i ? 'border-neutral-900' : 'border-transparent'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            {/* Main image */}
            <div className="flex-1 aspect-[3/4] overflow-hidden bg-neutral-100">
              <img
                key={selectedImage}
                src={product.images[selectedImage]}
                alt={localized(product.name, locale)}
                className="w-full h-full object-cover animate-[fadeIn_0.4s_ease-out]"
              />
            </div>
          </div>

          {/* Info */}
          <div className="md:py-4">
            {category && (
              <p className="text-[11px] tracking-[0.2em] uppercase text-neutral-400 mb-3">
                {localized(category.name, locale)}
              </p>
            )}
            <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-4 leading-tight">
              {localized(product.name, locale)}
            </h1>
            <p className="text-xl text-neutral-900 mb-8">
              {formatPrice(product.price, locale)}
            </p>

            <div className="mb-8">
              <p className="text-[14px] text-neutral-600 leading-relaxed">
                {localized(product.description, locale)}
              </p>
            </div>

            {/* Color selection */}
            {product.colors.length > 0 && (
              <div className="mb-6">
                <label className="block text-[12px] tracking-[0.1em] uppercase font-medium text-neutral-900 mb-3">
                  {t('detail_color')}
                </label>
                <div className="flex gap-3">
                  {product.colors.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedColor(i)}
                      className={`relative w-9 h-9 rounded-full border-2 transition-all ${selectedColor === i ? 'border-neutral-900 ring-2 ring-neutral-900/10' : 'border-neutral-200'}`}
                      style={{ backgroundColor: color.hex }}
                      title={localized(color, locale)}
                      aria-label={localized(color, locale)}
                    >
                      {selectedColor === i && (
                        <Check
                          size={14}
                          className="absolute inset-0 m-auto text-white mix-blend-difference"
                        />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-neutral-400 mt-2">
                  {localized(product.colors[selectedColor], locale)}
                </p>
              </div>
            )}

            {/* Size selection */}
            {product.sizes.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[12px] tracking-[0.1em] uppercase font-medium text-neutral-900">
                    {t('detail_size')}
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => { setSelectedSize(size); setSizeError(false); }}
                      className={`min-w-[48px] px-4 py-2.5 text-[13px] font-medium border transition-all ${selectedSize === size ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-400'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {sizeError && (
                  <p className="text-[12px] text-red-500 mt-2">{t('detail_select_size')}</p>
                )}
              </div>
            )}

            {/* Quantity */}
            <div className="mb-8">
              <label className="block text-[12px] tracking-[0.1em] uppercase font-medium text-neutral-900 mb-3">
                {t('detail_quantity')}
              </label>
              <div className="inline-flex items-center border border-neutral-200">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-12 text-center text-[14px] font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Add to cart */}
            <button
              onClick={handleAddToCart}
              className={`w-full py-4 text-[13px] tracking-[0.15em] uppercase font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                added ? 'bg-green-700 text-white' : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              {added ? (
                <>
                  <Check size={16} />
                  {t('detail_added')}
                </>
              ) : (
                <>
                  <ShoppingBag size={16} strokeWidth={1.5} />
                  {t('detail_add_cart')}
                </>
              )}
            </button>

            <p className="text-[12px] text-neutral-400 mt-4 text-center">{t('free_ship_note')}</p>
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div className="mt-20 md:mt-28 pt-12 border-t border-neutral-100">
            <h2 className="text-xl md:text-2xl font-light tracking-tight text-neutral-900 mb-8">
              {t('detail_related')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {related.map(p => (
                <ProductCard key={p.id} product={p} navigate={navigate} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
