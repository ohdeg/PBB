import type { LucideIcon } from 'lucide-react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Thermometer,
} from 'lucide-react';
import type { CSSProperties } from 'react';

/** WeatherAPI.com condition codes → Lucide icon. */
const CODE_ICON: Readonly<Record<number, LucideIcon>> = {
  1000: Sun,
  1003: CloudSun,
  1006: Cloud,
  1009: Cloud,
  1030: CloudFog,
  1063: CloudDrizzle,
  1066: CloudSnow,
  1069: CloudSnow,
  1072: CloudRain,
  1087: CloudLightning,
  1114: CloudSnow,
  1117: CloudSnow,
  1135: CloudFog,
  1147: CloudFog,
  1150: CloudDrizzle,
  1153: CloudDrizzle,
  1168: CloudRain,
  1171: CloudRain,
  1180: CloudDrizzle,
  1183: CloudRain,
  1186: CloudRain,
  1189: CloudRain,
  1192: CloudRain,
  1195: CloudRain,
  1198: CloudRain,
  1201: CloudRain,
  1204: CloudSnow,
  1207: CloudSnow,
  1210: CloudSnow,
  1213: CloudSnow,
  1216: CloudSnow,
  1219: CloudSnow,
  1222: CloudSnow,
  1225: CloudSnow,
  1237: CloudSnow,
  1240: CloudDrizzle,
  1243: CloudDrizzle,
  1246: CloudDrizzle,
  1249: CloudSnow,
  1252: CloudSnow,
  1255: CloudSnow,
  1258: CloudSnow,
  1261: CloudSnow,
  1264: CloudSnow,
  1273: CloudLightning,
  1276: CloudLightning,
  1279: CloudLightning,
  1282: CloudLightning,
};

const DEFAULT_ICON: LucideIcon = Thermometer;

function iconFromConditionText(
  condition: string | null | undefined,
): LucideIcon {
  if (!condition) return DEFAULT_ICON;
  const t = condition.toLowerCase();
  if (/thunder|storm/.test(t)) return CloudLightning;
  if (/snow|blizzard|sleet|ice/.test(t)) return CloudSnow;
  if (/drizzle|light rain/.test(t)) return CloudDrizzle;
  if (/rain|shower/.test(t)) return CloudRain;
  if (/mist|fog|haze/.test(t)) return CloudFog;
  if (/partly cloudy|partial/.test(t)) return CloudSun;
  if (/sun|clear/.test(t)) return Sun;
  if (/cloud|overcast/.test(t)) return Cloud;
  return DEFAULT_ICON;
}

export function weatherIconComponent(weather: {
  conditionCode: number | null;
  condition: string | null;
}): LucideIcon {
  if (weather.conditionCode != null) {
    const fromCode = CODE_ICON[weather.conditionCode];
    if (fromCode) return fromCode;
  }
  return iconFromConditionText(weather.condition);
}

interface WeatherIconProps {
  weather: {
    conditionCode: number | null;
    condition: string | null;
  };
  className?: string;
  style?: CSSProperties;
  size?: number;
}

export function WeatherIcon({
  weather,
  className,
  style,
  size = 22,
}: WeatherIconProps) {
  const Icon = weatherIconComponent(weather);
  return (
    <Icon
      className={className}
      style={style}
      size={size}
      strokeWidth={1.75}
      aria-hidden
    />
  );
}
