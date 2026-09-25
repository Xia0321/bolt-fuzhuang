import { Sparkles, Scissors, Leaf, Globe, Gem, Heart, Truck, Shield, Circle, type LucideProps } from 'lucide-react';

// 后台「Feature」页面的 icon 下拉值 → 图标
const icons = {
  sparkles: Sparkles,
  scissors: Scissors,
  leaf: Leaf,
  globe: Globe,
  gem: Gem,
  heart: Heart,
  truck: Truck,
  shield: Shield,
};

export function FeatureIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = icons[name as keyof typeof icons] ?? Circle;
  return <Icon {...props} />;
}
