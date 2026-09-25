import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useStore } from '@/context/StoreContext';
import { useNav } from '@/context/NavContext';
import { formatPrice, freeShippingNote } from '@/i18n/translations';
import { useCart } from '@/context/CartContext';
import { freeShippingThreshold } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { Check, Minus, Plus, ArrowLeft, ShoppingBag, Loader2 } from 'lucide-react';

const LOW_STOCK = 3;

export function ProductDetailPage({ slug }: { slug: string }) {
  const { locale, t } = useI18n();
  const { store } = useStore();
  const { navigate } = useNav();
  const { addItem } = useCart();
  const { products, categories, shippingRules } = store!;
  const product = products.find(p => p.slug === slug);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    setSelectedImage(0);
    // 只有一个尺码（如 ONE SIZE）时直接选中
    setSelectedSize(product?.sizes.length === 1 ? product.sizes[0] : null);
    setSelectedColor(product?.colors[0]?.slug ?? null);
    setQuantity(1);
    setAdded(false);
    setSizeError(false);
    setAddError('');
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-20">
        <div className="text-center">
          <p className="text-neutral-400 text-lg mb-4">{t('detail_not_found')}</p>
          <button onClick={() => navigate({ name: 'shop' })} className="text-neutral-900 underline text-sm">
            {t('detail_back')}
          </button>
        </div>
      </div>
    );
  }

  const category = categories.find(c => c.id === product.categoryId);
  const related = products
    .filter(p => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);

  const findVariant = (size: string | null, color: string | null) =>
    product.variants.find(v =>
      (product.sizes.length === 0 || v.size === size) && (product.colors.length === 0 || v.colorSlug === color));
  const sizeStock = (size: string) => findVariant(size, selectedColor)?.quantityAvailable ?? 0;
  const variant = findVariant(selectedSize, selectedColor);
  const price = variant?.price ?? product.price;
  const available = variant?.quantityAvailable ?? 0;
  const colorName = product.colors.find(c => c.slug === selectedColor)?.name;
  const threshold = freeShippingThreshold(shippingRules);

  const handleAddToCart = async () => {
    if (product.sizes.length > 0 && !selectedSize) {
      setSizeError(true);
      return;
    }
    if (!variant) return;
    setAdding(true);
    setAddError('');
    try {
      await addItem(variant.id, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 3000);
    } catch (e) {
      setAddError(e instanceof Error && /stock/i.test(e.message) ? t('error_stock') : t('error_generic'));
    } finally {
      setAdding(false);
    }
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
              {product.images[selectedImage] && (
                <img
                  key={selectedImage}
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover animate-[fadeIn_0.4s_ease-out]"
                />
              )}
            </div>
          </div>

          {/* Info */}
          <div className="md:py-4">
            {category && (
              <p className="text-[11px] tracking-[0.2em] uppercase text-neutral-400 mb-3">
                {category.name}
              </p>
            )}
            <h1 className="text-2xl md:text-3xl font-light tracking-tight text-neutral-900 mb-4 leading-tight">
              {product.name}
            </h1>
            <p className="text-xl text-neutral-900 mb-8">
              {formatPrice(price, locale)}
            </p>

            <div className="mb-8 space-y-3">
              {product.description.split('\n\n').map((para, i) => (
                <p key={i} className="text-[14px] text-neutral-600 leading-relaxed">{para}</p>
              ))}
            </div>

            {/* Color selection */}
            {product.colors.length > 0 && (
              <div className="mb-6">
                <label className="block text-[12px] tracking-[0.1em] uppercase font-medium text-neutral-900 mb-3">
                  {t('detail_color')}
                </label>
                <div className="flex gap-3">
                  {product.colors.map(color => (
                    <button
                      key={color.slug}
                      onClick={() => { setSelectedColor(color.slug); setAddError(''); }}
                      className={`relative w-9 h-9 rounded-full border-2 transition-all ${selectedColor === color.slug ? 'border-neutral-900 ring-2 ring-neutral-900/10' : 'border-neutral-200'}`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                      aria-label={color.name}
                    >
                      {selectedColor === color.slug && (
                        <Check
                          size={14}
                          className="absolute inset-0 m-auto text-white mix-blend-difference"
                        />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-neutral-400 mt-2">{colorName}</p>
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
                  {product.sizes.map(size => {
                    const soldOut = sizeStock(size) <= 0;
                    return (
                      <button
                        key={size}
                        disabled={soldOut}
                        onClick={() => { setSelectedSize(size); setSizeError(false); setAddError(''); }}
                        className={`min-w-[48px] px-4 py-2.5 text-[13px] font-medium border transition-all ${
                          soldOut
                            ? 'border-neutral-100 text-neutral-300 line-through cursor-not-allowed'
                            : selectedSize === size
                              ? 'border-neutral-900 bg-neutral-900 text-white'
                              : 'border-neutral-200 text-neutral-700 hover:border-neutral-400'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                {sizeError && (
                  <p className="text-[12px] text-red-500 mt-2">{t('detail_select_size')}</p>
                )}
                {variant && available > 0 && available <= LOW_STOCK && (
                  <p className="text-[12px] text-amber-700 mt-2">{t('detail_low_stock', { n: available })}</p>
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
                  onClick={() => setQuantity(q => (variant ? Math.min(Math.max(available, 1), q + 1) : q + 1))}
                  className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Add to cart */}
            {!product.isAvailable ? (
              <button disabled className="w-full py-4 text-[13px] tracking-[0.15em] uppercase font-medium bg-neutral-200 text-neutral-500 cursor-not-allowed">
                {t('product_sold_out')}
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={adding}
                className={`w-full py-4 text-[13px] tracking-[0.15em] uppercase font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  added ? 'bg-green-700 text-white' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                } ${adding ? 'opacity-70' : ''}`}
              >
                {adding ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('detail_adding')}
                  </>
                ) : added ? (
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
            )}
            {addError && <p className="text-[12px] text-red-500 mt-3 text-center">{addError}</p>}

            {threshold != null && price && (
              <p className="text-[12px] text-neutral-400 mt-4 text-center">
                {freeShippingNote(threshold, price.currency, locale)}
              </p>
            )}
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
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
