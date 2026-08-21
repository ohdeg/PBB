import { useThemeStore } from '../stores/themeStore';

interface HobbyProductShotProps {
  light?: string;
  dark?: string;
  fallback: string;
}

export function HobbyProductShot({
  light,
  dark,
  fallback,
}: HobbyProductShotProps) {
  const theme = useThemeStore((state) => state.theme);
  const src = theme === 'dark' ? (dark ?? light) : (light ?? dark);

  if (!src) {
    return <span className="figma-block__fallback">{fallback}</span>;
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      width={320}
      height={320}
      draggable={false}
    />
  );
}
