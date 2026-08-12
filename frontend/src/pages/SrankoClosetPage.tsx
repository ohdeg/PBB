import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { srankoApi } from '../api/srankoApi';
import { Dialog } from '../components/ui/Dialog';
import { MeasurementFields } from '../features/sranko/MeasurementFields';
import { defaultMannequinSrc } from '../features/sranko/mannequin';
import {
  BODY_MEASUREMENT_FIELDS,
  BODY_MEASUREMENT_SECTIONS,
  ITEM_MEASUREMENT_FIELDS,
  buildStoredMeasurements,
  draftFromStored,
  hasBodyMeasurements,
  type GirthInputMode,
  type LengthUnit,
  type ShoeUnit,
  type WeightUnit,
} from '../features/sranko/measurements';
import {
  SRANKO_COMMUNITY,
  SRANKO_LOOKS,
} from '../features/sranko/paths';
import { resizeImageForUpload } from '../features/sranko/resizeImageForUpload';
import { SrankoFitMap } from '../features/sranko/SrankoFitMap';
import { SrankoZoomableImage } from '../features/sranko/SrankoZoomableImage';
import {
  SRANKO_CATEGORIES,
  SRANKO_FIT_LABEL,
  SRANKO_SLOTS,
  SRANKO_WORN_GARMENT_SLOTS,
  SLOT_LABEL,
  formatSrankoCategoryLabel,
  isLookTryOnSlot,
  isWarmthlessSlot,
  normalizeSrankoCategoryCode,
  type SrankoFit,
  type SrankoFitPart,
  type SrankoItem,
  type SrankoPlace,
  type SrankoPlaceSearchHit,
  type SrankoSlot,
  type SrankoWeather,
  type SrankoWornGarmentSlot,
} from '../features/sranko/types';
import { normalizeGarmentPngFile } from '../features/sranko/normalizeGarmentPng';
import { WeatherIcon } from '../features/sranko/weatherIcon';
import {
  useSrankoItems,
  useSrankoMutations,
  useSrankoPrefs,
} from '../features/sranko/useSrankoStore';
import { useAuthStore } from '../stores/authStore';

type SlotFilter = 'ALL' | SrankoSlot;
type ModalMode =
  | 'add'
  | 'detail'
  | 'tryon'
  | 'tryon-result'
  | 'profile'
  | null;
type AddStep = 'photo' | 'details';

interface GeoCoords {
  lat: number;
  lon: number;
}

/** FE preview of default mannequin when no person photo (BE uses classpath twin). */
function mannequinPreviewSrc(sex: 'M' | 'F' | null | undefined): string {
  return defaultMannequinSrc(sex);
}

function placeKindLabel(kind: SrankoPlace['kind']): string {
  switch (kind) {
    case 'HOME':
      return '집';
    case 'WORK':
      return '회사';
    default:
      return '즐겨찾기';
  }
}

function formatHourLabel(time: string): string {
  const match = time.match(/(\d{1,2}):\d{2}$/);
  if (!match) {
    return time;
  }
  return `${Number(match[1])}시`;
}

function newPlaceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `place-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const MANUAL_FIT_OPTIONS: readonly { value: SrankoFit; label: string }[] = [
  { value: 'slim', label: '슬림' },
  { value: 'regular', label: '보통' },
  { value: 'loose', label: '오버' },
] as const;

const WARMTH_EMOJIS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '🧊',
  2: '💧',
  3: '☁️',
  4: '☀️',
  5: '🔥',
};

const WARMTH_ACCENTS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#3b82f6',
  2: '#60a5fa',
  3: '#a78bfa',
  4: '#f97316',
  5: '#ef4444',
};

function clampWarmth(value: number): 1 | 2 | 3 | 4 | 5 {
  const n = Math.min(5, Math.max(1, Math.round(value)));
  return n as 1 | 2 | 3 | 4 | 5;
}

function warmthEmoji(value: number): string {
  return WARMTH_EMOJIS[clampWarmth(value)];
}

function warmthAccent(value: number): string {
  return WARMTH_ACCENTS[clampWarmth(value)];
}

export function SrankoClosetPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { items, reload: reloadItems } = useSrankoItems();
  const { prefs, savePrefs } = useSrankoPrefs();
  const { saveItem, removeItem, saveLook, tryOn, uploadImage, deleteUpload, predictItem } =
    useSrankoMutations();

  const [slotFilter, setSlotFilter] = useState<SlotFilter>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [addStep, setAddStep] = useState<AddStep>('photo');
  /** When set, ITEM modal upserts this id (edit mode). */
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  /** Kept while editing so save works without re-uploading the photo. */
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Closet item ids for current try-on session (1+ for look try-on). */
  const [tryOnItemIds, setTryOnItemIds] = useState<string[]>([]);
  /** Per-item fit when body measurements are missing (default regular). */
  const [tryOnFitByItemId, setTryOnFitByItemId] = useState<Record<string, SrankoFit>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [tryOnFit, setTryOnFit] = useState<SrankoFit | null>(null);
  const [tryOnMuchTooSmall, setTryOnMuchTooSmall] = useState(false);
  const [fitParts, setFitParts] = useState<SrankoFitPart[]>([]);

  const [name, setName] = useState('');
  const [slot, setSlot] = useState<SrankoSlot>('TOP');
  const [categoryCode, setCategoryCode] = useState(SRANKO_CATEGORIES.TOP[0]);
  const [warmth, setWarmth] = useState<number | null>(3);
  const [pendingPngBase64, setPendingPngBase64] = useState<string | null>(null);
  const [classifiedPreviewUrl, setClassifiedPreviewUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [extractWornGarment, setExtractWornGarment] = useState(false);
  const [targetGarmentSlot, setTargetGarmentSlot] =
    useState<SrankoWornGarmentSlot>('TOP');
  const [garmentExtractionApplied, setGarmentExtractionApplied] = useState(false);
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const classifiedPreviewRef = useRef<string | null>(null);

  const [sexDraft, setSexDraft] = useState<'M' | 'F'>('M');
  const [consent, setConsent] = useState(false);

  const [itemMeasureDraft, setItemMeasureDraft] = useState<Record<string, string>>(
    {},
  );
  const [itemLengthUnits, setItemLengthUnits] = useState<
    Record<string, LengthUnit>
  >({});
  const [itemShoeUnits, setItemShoeUnits] = useState<Record<string, ShoeUnit>>(
    {},
  );
  const [itemWeightUnits, setItemWeightUnits] = useState<
    Record<string, WeightUnit>
  >({});
  /** Default 단면 — clothing tag convention; stored as circumference. */
  const [itemGirthInputMode, setItemGirthInputMode] =
    useState<GirthInputMode>('flat');

  const [bodyDraft, setBodyDraft] = useState<Record<string, string>>({});
  const [bodyLengthUnits, setBodyLengthUnits] = useState<
    Record<string, LengthUnit>
  >({});
  const [bodyShoeUnits, setBodyShoeUnits] = useState<Record<string, ShoeUnit>>(
    {},
  );
  const [bodyWeightUnits, setBodyWeightUnits] = useState<
    Record<string, WeightUnit>
  >({});

  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [weather, setWeather] = useState<SrankoWeather | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [manualTempInput, setManualTempInput] = useState('');
  /** `geo` | `search` | saved place id. */
  const [weatherSource, setWeatherSource] = useState<string>('geo');
  /** Temporary pin from weather search (not saved to prefs). */
  const [weatherSearchPin, setWeatherSearchPin] = useState<{
    name: string;
    lat: number;
    lon: number;
  } | null>(null);
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('');
  const [weatherSearchHits, setWeatherSearchHits] = useState<SrankoPlaceSearchHit[]>(
    [],
  );
  const [weatherSearchBusy, setWeatherSearchBusy] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchHits, setPlaceSearchHits] = useState<SrankoPlaceSearchHit[]>([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);

  useEffect(() => {
    setConsent(Boolean(prefs.tryOnConsent));
  }, [prefs.tryOnConsent]);

  useEffect(() => {
    if (!accessToken || !navigator.geolocation) {
      if (accessToken && !navigator.geolocation) {
        setGeoDenied(true);
      }
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) {
          return;
        }
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoDenied(false);
      },
      () => {
        if (!cancelled) {
          setGeoDenied(true);
          setCoords(null);
        }
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    if (weatherSource === 'geo' || weatherSource === 'search') {
      return;
    }
    if (!prefs.places.some((p) => p.id === weatherSource)) {
      const home = prefs.places.find((p) => p.kind === 'HOME');
      setWeatherSource(home?.id ?? (prefs.places[0]?.id ?? 'geo'));
    }
  }, [accessToken, prefs.places, weatherSource]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setWeatherBusy(true);
      setWeatherError('');
      try {
        let data: SrankoWeather;
        if (weatherSource === 'geo') {
          if (!coords) {
            setWeatherBusy(false);
            return;
          }
          data = await srankoApi.getWeather({ lat: coords.lat, lon: coords.lon });
        } else if (weatherSource === 'search') {
          if (!weatherSearchPin) {
            setWeatherBusy(false);
            return;
          }
          data = await srankoApi.getWeather({
            lat: weatherSearchPin.lat,
            lon: weatherSearchPin.lon,
          });
        } else {
          const place = prefs.places.find((p) => p.id === weatherSource);
          if (!place) {
            setWeatherBusy(false);
            return;
          }
          data = await srankoApi.getWeather({ lat: place.lat, lon: place.lon });
        }
        if (!cancelled) {
          setWeather(data);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setWeatherError(
            e instanceof Error ? e.message : '날씨 정보를 불러오지 못했어요.',
          );
        }
      } finally {
        if (!cancelled) {
          setWeatherBusy(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, coords, weatherSource, weatherSearchPin, prefs.places]);

  const applyManualTemp = async () => {
    if (!accessToken) {
      return;
    }
    const parsed = Number.parseFloat(manualTempInput.trim());
    if (!Number.isFinite(parsed)) {
      setWeatherError('올바른 온도(°C)를 입력해 주세요.');
      return;
    }
    setWeatherBusy(true);
    setWeatherError('');
    try {
      const data = await srankoApi.getWeather({ tempC: parsed });
      setWeather(data);
    } catch (e: unknown) {
      setWeatherError(e instanceof Error ? e.message : '날씨 정보를 불러오지 못했어요.');
    } finally {
      setWeatherBusy(false);
    }
  };

  const persistPlaces = async (next: SrankoPlace[]) => {
    setBusy(true);
    setError('');
    try {
      await savePrefs({ places: next });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '장소를 저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const upsertPlace = async (
    kind: SrankoPlace['kind'],
    input: { label: string; lat: number; lon: number; query?: string | null },
  ) => {
    const favorites = prefs.places.filter((p) => p.kind === 'FAVORITE');
    if (kind === 'FAVORITE' && favorites.length >= 5) {
      setError('즐겨찾기는 최대 5곳까지 등록할 수 있습니다.');
      return;
    }
    let next = [...prefs.places];
    if (kind === 'HOME' || kind === 'WORK') {
      next = next.filter((p) => p.kind !== kind);
    }
    next.push({
      id: newPlaceId(),
      label: input.label.trim() || placeKindLabel(kind),
      kind,
      lat: input.lat,
      lon: input.lon,
      query: input.query ?? null,
    });
    await persistPlaces(next);
    setPlaceSearchHits([]);
    setPlaceSearchQuery('');
  };

  const removePlace = async (id: string) => {
    await persistPlaces(prefs.places.filter((p) => p.id !== id));
    if (weatherSource === id) {
      setWeatherSource('geo');
    }
  };

  const runWeatherPlaceSearch = async () => {
    const q = weatherSearchQuery.trim();
    if (q.length < 2) {
      setWeatherError('장소 검색어를 2자 이상 입력해 주세요.');
      return;
    }
    setWeatherSearchBusy(true);
    setWeatherError('');
    try {
      setWeatherSearchHits(await srankoApi.searchPlaces(q));
    } catch (e: unknown) {
      setWeatherError(
        e instanceof Error ? e.message : '장소 검색에 실패했어요.',
      );
    } finally {
      setWeatherSearchBusy(false);
    }
  };

  const applyWeatherSearchHit = (hit: SrankoPlaceSearchHit) => {
    setWeatherSearchPin({ name: hit.name, lat: hit.lat, lon: hit.lon });
    setWeatherSource('search');
    setWeatherSearchQuery(hit.name);
    setWeatherSearchHits([]);
  };

  const runPlaceSearch = async () => {
    const q = placeSearchQuery.trim();
    if (q.length < 2) {
      setError('장소 검색어를 2자 이상 입력해 주세요.');
      return;
    }
    setPlaceSearchBusy(true);
    setError('');
    try {
      setPlaceSearchHits(await srankoApi.searchPlaces(q));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '장소 검색에 실패했어요.');
    } finally {
      setPlaceSearchBusy(false);
    }
  };

  const savePlaceFromCurrentLocation = async (kind: SrankoPlace['kind']) => {
    if (!coords) {
      setError('현재 위치를 아직 가져오지 못했어요. 위치 권한을 확인해 주세요.');
      return;
    }
    await upsertPlace(kind, {
      label: placeKindLabel(kind),
      lat: coords.lat,
      lon: coords.lon,
      query: '현재 위치',
    });
  };

  const filtered = useMemo(() => {
    if (slotFilter === 'ALL') {
      return items;
    }
    return items.filter((i) => i.slot === slotFilter);
  }, [items, slotFilter]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const tryOnItems = useMemo(() => {
    const out: SrankoItem[] = [];
    for (const id of tryOnItemIds) {
      const item = items.find((i) => i.id === id);
      if (item) out.push(item);
    }
    return out;
  }, [items, tryOnItemIds]);
  const lookSelectedItems = useMemo(() => {
    const out: SrankoItem[] = [];
    for (const id of selectedIds) {
      const item = items.find((i) => i.id === id);
      if (item && isLookTryOnSlot(item.slot)) out.push(item);
    }
    return out;
  }, [items, selectedIds]);

  const toggleSelected = (item: SrankoItem, on: boolean) => {
    setSelectedIds((prev) => {
      if (!on) {
        return prev.filter((id) => id !== item.id);
      }
      const nextIds = prev.filter((id) => {
        const other = items.find((i) => i.id === id);
        if (!other) return false;
        if (other.slot === item.slot) return false;
        if (item.slot === 'DRESS' && (other.slot === 'TOP' || other.slot === 'BOTTOM')) {
          return false;
        }
        if (
          (item.slot === 'TOP' || item.slot === 'BOTTOM') &&
          other.slot === 'DRESS'
        ) {
          return false;
        }
        return true;
      });
      return [...nextIds, item.id];
    });
  };

  const clearLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    setLocalPreviewUrl(null);
  };

  const clearClassifiedPreview = () => {
    if (classifiedPreviewRef.current) {
      URL.revokeObjectURL(classifiedPreviewRef.current);
      classifiedPreviewRef.current = null;
    }
    setClassifiedPreviewUrl(null);
    setPendingPngBase64(null);
    setGarmentExtractionApplied(false);
  };

  const setClassifiedPreviewFromBase64 = (base64: string) => {
    clearClassifiedPreview();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    const preview = URL.createObjectURL(blob);
    classifiedPreviewRef.current = preview;
    setClassifiedPreviewUrl(preview);
    setPendingPngBase64(base64);
  };

  const setLocalPreview = (file: File) => {
    clearLocalPreview();
    const preview = URL.createObjectURL(file);
    localPreviewRef.current = preview;
    setLocalPreviewUrl(preview);
  };

  const resetAddForm = () => {
    clearLocalPreview();
    clearClassifiedPreview();
    setEditingItemId(null);
    setExistingImageUrl(null);
    setName('');
    setSlot('TOP');
    setCategoryCode(SRANKO_CATEGORIES.TOP[0]);
    setWarmth(3);
    setExtractWornGarment(false);
    setTargetGarmentSlot('TOP');
    setGarmentExtractionApplied(false);
    setExtractionWarning(null);
    setItemMeasureDraft({});
    setItemLengthUnits({});
    setItemShoeUnits({});
    setItemWeightUnits({});
    setItemGirthInputMode('flat');
    setAddStep('photo');
    setError('');
  };

  const openAdd = () => {
    resetAddForm();
    setModal('add');
  };

  const openEdit = (item: SrankoItem) => {
    resetAddForm();
    setEditingItemId(item.id);
    setExistingImageUrl(item.imageUrl);
    setName(item.name);
    setSlot(item.slot);
    setCategoryCode(normalizeSrankoCategoryCode(item.slot, item.categoryCode));
    setWarmth(isWarmthlessSlot(item.slot) ? null : (item.warmth ?? 3));
    setItemGirthInputMode('flat');
    setItemMeasureDraft(
      draftFromStored(
        ITEM_MEASUREMENT_FIELDS[item.slot],
        item.measurements,
        'flat',
      ),
    );
    setItemLengthUnits({});
    setItemShoeUnits({});
    setItemWeightUnits({});
    setAddStep('details');
    setModal('add');
  };

  const openProfile = () => {
    setBodyDraft(draftFromStored(BODY_MEASUREMENT_FIELDS, prefs.bodyMeasurements));
    setBodyLengthUnits({});
    setBodyShoeUnits({});
    setBodyWeightUnits({});
    setSexDraft(prefs.sex === 'F' ? 'F' : 'M');
    setError('');
    setModal('profile');
  };

  const openDetail = (item: SrankoItem) => {
    setSelectedId(item.id);
    setError('');
    setModal('detail');
  };

  const deleteSelectedItems = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      return;
    }
    if (
      !window.confirm(
        ids.length === 1
          ? '선택한 아이템을 삭제할까요?'
          : `선택한 ${ids.length}개 아이템을 삭제할까요?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    const results = await Promise.allSettled(ids.map((id) => removeItem(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setSelectedIds([]);
    try {
      await reloadItems();
    } catch {
      // list refresh best-effort
    }
    if (failed > 0) {
      setError(
        failed === ids.length
          ? '선택한 아이템을 삭제하지 못했어요.'
          : `${failed}개 아이템 삭제에 실패했어요.`,
      );
    }
    setBusy(false);
  };

  const openTryOn = (item: SrankoItem) => {
    setSelectedId(item.id);
    setTryOnItemIds([item.id]);
    setTryOnFitByItemId({ [item.id]: 'regular' });
    setTryOnResult(null);
    setTryOnFit(null);
    setTryOnMuchTooSmall(false);
    setFitParts([]);
    setError('');
    setConsent(Boolean(prefs.tryOnConsent));
    setModal('tryon');
    if (hasBodyMeasurements(prefs.bodyMeasurements)) {
      void srankoApi
        .fitCheck(item.id)
        .then((preview) => setFitParts(preview.parts))
        .catch(() => undefined);
    }
  };

  const openLookTryOn = (lookItems: SrankoItem[]) => {
    if (lookItems.length === 0) {
      setError('상의·하의·아우터·원피스·모자·신발만 룩 입어보기에 쓸 수 있어요.');
      return;
    }
    setSelectedId(lookItems[0].id);
    setTryOnItemIds(lookItems.map((i) => i.id));
    setTryOnFitByItemId(
      Object.fromEntries(lookItems.map((i) => [i.id, 'regular' as SrankoFit])),
    );
    setTryOnResult(null);
    setTryOnFit(null);
    setTryOnMuchTooSmall(false);
    setFitParts([]);
    setError('');
    setConsent(Boolean(prefs.tryOnConsent));
    setModal('tryon');
    if (hasBodyMeasurements(prefs.bodyMeasurements) && lookItems[0]) {
      void srankoApi
        .fitCheck(lookItems[0].id)
        .then((preview) => setFitParts(preview.parts))
        .catch(() => undefined);
    }
  };

  const onPickItemImage = async (file: File | null) => {
    if (!file || !accessToken) {
      return;
    }
    clearLocalPreview();
    clearClassifiedPreview();
    setError('');
    setExtractionWarning(null);
    setAddStep('photo');
    setLocalPreview(file);
    setBusy(true);
    try {
      const resized = await resizeImageForUpload(file);
      const predicted = await predictItem(resized, {
        extractWornGarment,
        targetSlot: extractWornGarment ? targetGarmentSlot : undefined,
      });
      setExtractionWarning(predicted.extractionWarning);
      if (extractWornGarment && !predicted.garmentExtractionApplied) {
        clearClassifiedPreview();
        setError('옷만 추출하지 못해 이 사진은 저장할 수 없습니다.');
        return;
      }
      if (predicted.rejected) {
        clearClassifiedPreview();
        setError('옷이 아닌 이미지로 보입니다. 다른 사진을 올려 주세요.');
        return;
      }
      if (
        !predicted.imagePngBase64 ||
        (!extractWornGarment && !predicted.slot) ||
        !predicted.categoryCode
      ) {
        setError('분류 결과가 올바르지 않습니다.');
        return;
      }
      const nextSlot: SrankoSlot = extractWornGarment
        ? targetGarmentSlot
        : predicted.slot && SRANKO_SLOTS.includes(predicted.slot)
          ? predicted.slot
          : 'TOP';
      const options = SRANKO_CATEGORIES[nextSlot];
      const nextCategory = options.includes(predicted.categoryCode)
        ? predicted.categoryCode
        : options[0];
      const nextWarmth = isWarmthlessSlot(nextSlot)
        ? null
        : predicted.warmth !== null &&
            predicted.warmth >= 1 &&
            predicted.warmth <= 5
          ? predicted.warmth
          : 3;
      setClassifiedPreviewFromBase64(predicted.imagePngBase64);
      setGarmentExtractionApplied(predicted.garmentExtractionApplied);
      setSlot(nextSlot);
      setCategoryCode(nextCategory);
      setWarmth(nextWarmth);
      setName(`${SLOT_LABEL[nextSlot]} · ${nextCategory}`);
      setItemMeasureDraft({});
      setItemLengthUnits({});
      setItemShoeUnits({});
      setItemWeightUnits({});
      clearLocalPreview();
      setAddStep('details');
    } catch (e: unknown) {
      clearClassifiedPreview();
      setError(e instanceof Error ? e.message : '옷 분류에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const backToPhotoStep = () => {
    clearLocalPreview();
    clearClassifiedPreview();
    setGarmentExtractionApplied(false);
    setExtractionWarning(null);
    setAddStep('photo');
    setError('');
  };

  const closeAddModal = () => {
    if (!busy) {
      setModal(null);
      resetAddForm();
    }
  };

  const clearBodySizes = async () => {
    if (!hasBodyMeasurements(prefs.bodyMeasurements)) {
      setBodyDraft(draftFromStored(BODY_MEASUREMENT_FIELDS, {}));
      setBodyLengthUnits({});
      setBodyShoeUnits({});
      setBodyWeightUnits({});
      return;
    }
    if (!window.confirm('저장된 내 사이즈를 모두 삭제할까요?')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await savePrefs({ bodyMeasurements: {} });
      setBodyDraft(draftFromStored(BODY_MEASUREMENT_FIELDS, {}));
      setBodyLengthUnits({});
      setBodyShoeUnits({});
      setBodyWeightUnits({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '사이즈 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = async () => {
    if (!accessToken) {
      return;
    }
    if (!pendingPngBase64 && !existingImageUrl) {
      setError('옷 사진을 올려 주세요.');
      return;
    }
    if (
      pendingPngBase64 &&
      extractWornGarment &&
      !garmentExtractionApplied
    ) {
      setError('착용 사진 옷 추출이 완료되지 않아 저장할 수 없습니다.');
      return;
    }
    setBusy(true);
    setError('');
    let uploadedUrl: string | null = null;
    try {
      let imageUrl: string;
      if (pendingPngBase64) {
        const binary = atob(pendingPngBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const rawFile = new File([bytes], 'item.png', { type: 'image/png' });
        const file = await normalizeGarmentPngFile(rawFile);
        const uploaded = await uploadImage('item', file);
        uploadedUrl = uploaded.url;
        imageUrl = uploaded.url;
      } else if (existingImageUrl) {
        imageUrl = existingImageUrl;
      } else {
        setError('옷 사진을 올려 주세요.');
        setBusy(false);
        return;
      }
      await saveItem({
        id: editingItemId ?? undefined,
        name: name.trim() || `${SLOT_LABEL[slot]} 아이템`,
        slot,
        categoryCode,
        warmth: isWarmthlessSlot(slot) ? null : warmth,
        imageUrl,
        measurements: buildStoredMeasurements(
          ITEM_MEASUREMENT_FIELDS[slot],
          itemMeasureDraft,
          itemLengthUnits,
          itemShoeUnits,
          itemWeightUnits,
          itemGirthInputMode,
        ),
      });
      await reloadItems();
      setModal(null);
      resetAddForm();
    } catch (e: unknown) {
      if (uploadedUrl) {
        try {
          await deleteUpload(uploadedUrl);
        } catch {
          // best-effort orphan cleanup
        }
      }
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const saveBodySizes = async () => {
    if (!accessToken) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await savePrefs({
        sex: sexDraft,
        bodyMeasurements: buildStoredMeasurements(
          BODY_MEASUREMENT_FIELDS,
          bodyDraft,
          bodyLengthUnits,
          bodyShoeUnits,
          bodyWeightUnits,
        ),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '신체 사이즈 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const clearTryOnSession = () => {
    setModal(null);
    setSelectedId(null);
    setTryOnItemIds([]);
    setTryOnFitByItemId({});
    setTryOnResult(null);
    setTryOnFit(null);
    setTryOnMuchTooSmall(false);
    setFitParts([]);
    setError('');
  };

  const runTryOn = async () => {
    const garments = tryOnItems.length > 0 ? tryOnItems : selected ? [selected] : [];
    if (garments.length === 0) {
      setError('입어볼 옷을 선택해 주세요.');
      return;
    }
    if (!consent) {
      setError('입어보기 AI(Vertex) 이용에 동의해 주세요.');
      return;
    }
    const bodyReady = hasBodyMeasurements(prefs.bodyMeasurements);
    setBusy(true);
    setError('');
    try {
      if (bodyReady && garments.length === 1) {
        const preview = await srankoApi.fitCheck(garments[0].id);
        setFitParts(preview.parts);
        if (preview.muchTooSmall) {
          setBusy(false);
          const ok = window.confirm(
            '선택한 옷이 등록된 신체 사이즈보다 많이 작아 보입니다. 타이트하게 착용한 모습으로 볼까요?',
          );
          if (!ok) {
            return;
          }
          setBusy(true);
        }
      }
      await savePrefs({
        tryOnConsent: true,
      });
      const fitByItemId = bodyReady
        ? undefined
        : Object.fromEntries(
            garments.map((g) => [g.id, tryOnFitByItemId[g.id] ?? 'regular'] as const),
          );
      const result = await tryOn({
        itemIds: garments.map((g) => g.id),
        fitByItemId,
      });
      setTryOnResult(result.resultImageUrl);
      setTryOnFit(result.fit);
      setTryOnMuchTooSmall(Boolean(result.muchTooSmall));
      setModal('tryon-result');
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : '미리보기 생성에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveTryOnLook = async () => {
    const garments = tryOnItems.length > 0 ? tryOnItems : selected ? [selected] : [];
    if (!accessToken || !tryOnResult || garments.length === 0) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const name =
        garments.length === 1
          ? `${garments[0].name} 착용`
          : `룩 · ${garments.map((g) => SLOT_LABEL[g.slot]).join('+')}`;
      await saveLook({
        name,
        imageUrl: tryOnResult,
        itemIds: garments.map((g) => g.id),
        source: 'TRY_ON',
      });
      setSelectedIds([]);
      clearTryOnSession();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '룩 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const retryTryOnConfirm = () => {
    setTryOnResult(null);
    setTryOnFit(null);
    setTryOnMuchTooSmall(false);
    setError('');
    setModal('tryon');
  };

  if (!accessToken) {
    return (
      <section className="sranko-panel">
        <h1>옷장</h1>
        <div className="sranko-empty">
          옷장·입어보기는{' '}
          <Link className="sranko-link" to="/login" state={{ from: '/hobbies/sranko/closet' }}>
            로그인
          </Link>
          이 필요합니다.
        </div>
      </section>
    );
  }

  return (
    <section className="sranko-panel">
      <div className="sranko-panel__head">
        <div>
          <h1>옷장</h1>
          <p className="sranko-panel__lede">
            옷을 나열해 두고, 골라서 입어볼 수 있어요.
          </p>
        </div>
        <div className="sranko-panel__actions">
          <button
            type="button"
            className="sranko-btn sranko-btn--ghost"
            disabled={busy}
            onClick={openProfile}
          >
            정보 수정
          </button>
          <button
            type="button"
            className="sranko-btn sranko-btn--primary"
            disabled={busy}
            onClick={openAdd}
          >
            ITEM +
          </button>
        </div>
      </div>
      {!modal && error ? <p className="sranko-error">{error}</p> : null}

      <div className="sranko-weather" aria-live="polite">
        <div className="sranko-weather__head">
          <strong>오늘 날씨</strong>
        </div>
        <div className="sranko-weather__places" role="tablist" aria-label="날씨 장소">
          <button
            type="button"
            role="tab"
            className={`sranko-weather__place-chip${weatherSource === 'geo' ? ' is-active' : ''}`}
            aria-selected={weatherSource === 'geo'}
            disabled={weatherBusy}
            onClick={() => setWeatherSource('geo')}
          >
            내 위치
          </button>
          {weatherSearchPin ? (
            <button
              type="button"
              role="tab"
              className={`sranko-weather__place-chip${weatherSource === 'search' ? ' is-active' : ''}`}
              aria-selected={weatherSource === 'search'}
              disabled={weatherBusy}
              onClick={() => setWeatherSource('search')}
            >
              {weatherSearchPin.name}
            </button>
          ) : null}
          {prefs.places.map((place) => (
            <button
              key={place.id}
              type="button"
              role="tab"
              className={`sranko-weather__place-chip${weatherSource === place.id ? ' is-active' : ''}`}
              aria-selected={weatherSource === place.id}
              disabled={weatherBusy}
              onClick={() => setWeatherSource(place.id)}
            >
              {place.kind === 'FAVORITE' ? place.label : placeKindLabel(place.kind)}
            </button>
          ))}
        </div>
        <div className="sranko-place-search">
          <input
            type="search"
            value={weatherSearchQuery}
            onChange={(e) => setWeatherSearchQuery(e.target.value)}
            placeholder="다른 지역 날씨 검색 (예: 강남)"
            disabled={weatherBusy || weatherSearchBusy}
            aria-label="다른 지역 날씨 검색"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runWeatherPlaceSearch();
              }
            }}
          />
          <button
            type="button"
            className="sranko-btn sranko-btn--ghost sranko-btn--sm"
            disabled={weatherBusy || weatherSearchBusy}
            onClick={() => void runWeatherPlaceSearch()}
          >
            {weatherSearchBusy ? '검색 중…' : '검색'}
          </button>
        </div>
        {weatherSearchHits.length > 0 ? (
          <ul className="sranko-place-hits sranko-place-hits--pick">
            {weatherSearchHits.map((hit) => (
              <li key={`${hit.name}-${hit.lat}-${hit.lon}`}>
                <button
                  type="button"
                  className="sranko-place-hits__pick"
                  disabled={weatherBusy}
                  onClick={() => applyWeatherSearchHit(hit)}
                >
                  <strong>{hit.name}</strong>
                  <span>
                    {[hit.region, hit.country].filter(Boolean).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {weatherBusy && !weather ? (
          <p className="sranko-muted">날씨를 불러오는 중…</p>
        ) : null}
        {weather ? (
          <>
            <dl className="sranko-weather__grid">
              <div>
                <dt>날씨</dt>
                <dd
                  className="sranko-weather__icon"
                  aria-label={weather.condition ?? '날씨'}
                >
                  <WeatherIcon weather={weather} />
                </dd>
              </div>
              <div>
                <dt>습도</dt>
                <dd>{weather.humidity != null ? `${weather.humidity}%` : '—'}</dd>
              </div>
              <div>
                <dt>온도</dt>
                <dd>{`${weather.tempC.toFixed(1)}°C`}</dd>
              </div>
              <div>
                <dt>풍속</dt>
                <dd>
                  {weather.windKph != null ? `${weather.windKph.toFixed(1)} kph` : '—'}
                </dd>
              </div>
            </dl>
            {weather.hourly.length > 0 ? (
              <div className="sranko-weather__hourly" aria-label="앞으로 12시간 예보">
                {weather.hourly.map((hour) => (
                  <div key={hour.time} className="sranko-weather__hour">
                    <span className="sranko-weather__hour-time">
                      {formatHourLabel(hour.time)}
                    </span>
                    <span
                      className="sranko-weather__hour-icon"
                      aria-label={hour.condition ?? '예보'}
                    >
                      <WeatherIcon
                        weather={{
                          condition: hour.condition,
                          conditionCode: hour.conditionCode,
                        }}
                        size={18}
                      />
                    </span>
                    <strong>{`${Math.round(hour.tempC)}°`}</strong>
                    <span className="sranko-weather__hour-rain">
                      {hour.chanceOfRain != null ? `${hour.chanceOfRain}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {(geoDenied || (!coords && weatherSource === 'geo' && !weatherBusy && !weather)) && (
          <div className="sranko-weather__manual">
            <label htmlFor="sranko-manual-temp">
              위치를 쓸 수 없을 때 온도(°C)
            </label>
            <div className="sranko-weather__manual-row">
              <input
                id="sranko-manual-temp"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={manualTempInput}
                onChange={(e) => setManualTempInput(e.target.value)}
                placeholder="예: 22"
              />
              <button
                type="button"
                className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                disabled={weatherBusy}
                onClick={() => void applyManualTemp()}
              >
                적용
              </button>
            </div>
          </div>
        )}
        {weatherError ? <p className="sranko-error">{weatherError}</p> : null}
        <a
          className="sranko-weather__credit"
          href="https://www.weatherapi.com/"
          target="_blank"
          rel="noreferrer"
        >
          Weather data by WeatherAPI.com
        </a>
      </div>

      <div className="sranko-tabs" role="tablist" aria-label="카테고리">
        <button
          type="button"
          className={slotFilter === 'ALL' ? 'is-active' : undefined}
          onClick={() => setSlotFilter('ALL')}
        >
          ALL
        </button>
        {SRANKO_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            className={slotFilter === s ? 'is-active' : undefined}
            onClick={() => setSlotFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="sranko-empty">등록된 ITEM이 없습니다.</div>
      ) : (
        <div className="sranko-grid">
          {filtered.map((item) => {
            const checked = selectedIds.includes(item.id);
            return (
              <article
                key={item.id}
                className={`sranko-card sranko-card--clickable${checked ? ' is-selected' : ''}`}
              >
                <label className="sranko-card__check">
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={`${item.name} 선택`}
                    onChange={(e) => toggleSelected(item, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <button
                  type="button"
                  className="sranko-card__hit"
                  aria-label={`${item.name} 상세보기`}
                  onClick={() => openDetail(item)}
                >
                  <img src={item.imageUrl} alt="" />
                  <div className="sranko-card__body">
                    <strong>{item.name}</strong>
                    <span>
                      {SLOT_LABEL[item.slot]} ·{' '}
                      {formatSrankoCategoryLabel(item.slot, item.categoryCode)}
                      {item.warmth != null ? ` · 따뜻함 ${item.warmth}` : ''}
                    </span>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div className="sranko-select-bar" role="region" aria-label="선택한 아이템">
          <span>{selectedIds.length}개 선택</span>
          <div className="sranko-select-bar__actions">
            <button
              type="button"
              className="sranko-btn sranko-btn--ghost sranko-btn--sm"
              disabled={busy}
              onClick={() => setSelectedIds([])}
            >
              선택 해제
            </button>
            <button
              type="button"
              className="sranko-btn sranko-btn--ghost sranko-btn--sm"
              disabled={busy}
              onClick={() => void deleteSelectedItems()}
            >
              {busy ? '삭제 중…' : '삭제'}
            </button>
            <button
              type="button"
              className="sranko-btn sranko-btn--primary sranko-btn--sm"
              disabled={busy || lookSelectedItems.length === 0}
              onClick={() => {
                setError('');
                openLookTryOn(lookSelectedItems);
              }}
            >
              룩 입어보기
            </button>
          </div>
        </div>
      ) : null}

      <p className="sranko-footer-links">
        <Link className="sranko-link" to={SRANKO_LOOKS}>
          내 룩
        </Link>
        {' · '}
        <Link className="sranko-link" to={SRANKO_COMMUNITY}>
          커뮤니티
        </Link>
      </p>

      {modal === 'detail' && selected ? (
        <Dialog
          open
          title="아이템 상세"
          onClose={() => {
            setModal(null);
            setSelectedId(null);
            setError('');
          }}
          closeOnBackdrop
          closeOnEscape
          backdropClassName="sranko-modal"
          panelClassName="sranko-modal__card"
        >
          {({ titleId }) => (
            <>
              <h2 id={titleId}>{selected.name}</h2>
              <img
                className="sranko-preview sranko-detail__image"
                src={selected.imageUrl}
                alt={selected.name}
              />
              <p className="sranko-detail__meta">
                {SLOT_LABEL[selected.slot]} ·{' '}
                {formatSrankoCategoryLabel(selected.slot, selected.categoryCode)}
                {selected.warmth != null ? ` · 따뜻함 ${selected.warmth}` : ''}
              </p>
              {ITEM_MEASUREMENT_FIELDS[selected.slot].length > 0 ? (
                <>
                  <h3 className="sranko-detail__section">옷 사이즈</h3>
                  <dl className="sranko-detail__measures">
                    {ITEM_MEASUREMENT_FIELDS[selected.slot].map((field) => {
                      const raw = selected.measurements[field.key]?.trim() ?? '';
                      const unit =
                        field.kind === 'shoe'
                          ? 'mm'
                          : field.kind === 'weight'
                            ? 'kg'
                            : 'cm';
                      return (
                        <div key={field.key} className="sranko-detail__measure-row">
                          <dt>{field.label}</dt>
                          <dd>{raw ? `${raw}${unit}` : '—'}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </>
              ) : null}
              {error ? <p className="sranko-error">{error}</p> : null}
              <div className="sranko-modal__actions">
                {selected.slot !== 'BAG' && selected.slot !== 'JEWELRY' ? (
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--primary"
                    onClick={() => openTryOn(selected)}
                  >
                    입어보기
                  </button>
                ) : null}
                <button
                  type="button"
                  className="sranko-btn sranko-btn--ghost"
                  onClick={() => openEdit(selected)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="sranko-btn sranko-btn--ghost"
                  onClick={() => {
                    if (window.confirm('이 아이템을 삭제할까요?')) {
                      void removeItem(selected.id).then(() => {
                        setModal(null);
                        setSelectedId(null);
                        return reloadItems();
                      });
                    }
                  }}
                >
                  삭제
                </button>
              </div>
            </>
          )}
        </Dialog>
      ) : null}

      {modal === 'add' ? (
        <Dialog
          open
          title={editingItemId ? '아이템 수정' : '아이템 등록'}
          onClose={closeAddModal}
          closeOnBackdrop={false}
          closeOnEscape={!busy}
          backdropClassName="sranko-modal"
          panelClassName="sranko-modal__card"
        >
          {({ titleId }) => (
            <>
            <h2 id={titleId}>{editingItemId ? 'ITEM 수정' : 'ITEM +'}</h2>
            <ol className="sranko-add-steps" aria-label={editingItemId ? '수정 단계' : '등록 단계'}>
              <li
                className={
                  addStep === 'photo'
                    ? 'is-active'
                    : editingItemId && !pendingPngBase64
                      ? undefined
                      : 'is-done'
                }
              >
                1. 사진
              </li>
              <li className={addStep === 'details' ? 'is-active' : undefined}>
                2. 이름·분류
              </li>
            </ol>

            {addStep === 'photo' ? (
              <div key="add-step-photo" className="sranko-add-panel">
                <p className="sranko-muted">
                  {editingItemId
                    ? '새 옷 사진을 올리면 분류와 배경 제거 후 이름·분류 화면으로 돌아갑니다. 기존 사진을 유지하려면 이전을 누르세요.'
                    : '옷 사진을 올리면 분류와 배경 제거를 진행한 뒤, 이름·분류 화면으로 넘어갑니다.'}
                </p>
                <label className="sranko-check sranko-check--garment">
                  <input
                    type="checkbox"
                    checked={extractWornGarment}
                    disabled={busy}
                    onChange={(e) => {
                      setExtractWornGarment(e.target.checked);
                      clearLocalPreview();
                      clearClassifiedPreview();
                      setExtractionWarning(null);
                      setError('');
                    }}
                  />
                  착용 사진에서 옷만 추출
                </label>
                {extractWornGarment ? (
                  <>
                    <label className="sranko-field">
                      <span>추출할 옷 종류 (필수)</span>
                      <select
                        value={targetGarmentSlot}
                        disabled={busy}
                        required
                        onChange={(e) => {
                          setTargetGarmentSlot(e.target.value as SrankoWornGarmentSlot);
                          clearLocalPreview();
                          clearClassifiedPreview();
                          setExtractionWarning(null);
                          setError('');
                        }}
                      >
                        {SRANKO_WORN_GARMENT_SLOTS.map((target) => (
                          <option key={target} value={target}>
                            {SLOT_LABEL[target]} ({target})
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="sranko-muted sranko-garment-hint">
                      사진에 실제로 보이는 옷 부분만 추출합니다. 가려진 부분은 생성하지 않습니다.
                    </p>
                  </>
                ) : null}
                <label className="sranko-field">
                  <span>옷 사진</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={(e) => {
                      void onPickItemImage(e.target.files?.[0] ?? null);
                      e.target.value = '';
                    }}
                  />
                </label>
                {localPreviewUrl ? (
                  <img className="sranko-preview" src={localPreviewUrl} alt="선택한 사진" />
                ) : null}
                {busy ? (
                  <p className="sranko-status sranko-status--row" role="status">
                    <span className="sranko-spinner" aria-hidden />
                    <span>
                      {extractWornGarment
                        ? '착용 사진에서 옷 추출·분류 중… 잠시만 기다려 주세요.'
                        : '분류·배경제거 중… 잠시만 기다려 주세요.'}
                    </span>
                  </p>
                ) : null}
                {extractionWarning ? (
                  <p className="sranko-warning" role="status">
                    {extractionWarning}
                  </p>
                ) : null}
                {error ? <p className="sranko-error">{error}</p> : null}
                <div className="sranko-modal__actions">
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost"
                    disabled={busy}
                    onClick={() => {
                      if (editingItemId && existingImageUrl) {
                        clearLocalPreview();
                        clearClassifiedPreview();
                        setGarmentExtractionApplied(false);
                        setExtractionWarning(null);
                        setError('');
                        setAddStep('details');
                        return;
                      }
                      closeAddModal();
                    }}
                  >
                    {editingItemId && existingImageUrl ? '이전' : '취소'}
                  </button>
                </div>
              </div>
            ) : (
              <div key="add-step-details" className="sranko-add-panel">
                {classifiedPreviewUrl || existingImageUrl ? (
                  <img
                    className="sranko-preview"
                    src={classifiedPreviewUrl ?? existingImageUrl ?? undefined}
                    alt={editingItemId ? '아이템 사진' : '분류된 옷'}
                  />
                ) : null}
                {extractionWarning ? (
                  <p className="sranko-warning" role="status">
                    {extractionWarning}
                  </p>
                ) : null}
                <label className="sranko-field">
                  <span>이름</span>
                  <input
                    value={name ?? ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 네이비 니트"
                  />
                </label>
                <label className="sranko-field">
                  <span>대분류</span>
                  <select
                    value={slot ?? 'TOP'}
                    onChange={(e) => {
                      const next = e.target.value as SrankoSlot;
                      setSlot(next);
                      setCategoryCode(SRANKO_CATEGORIES[next][0]);
                      setWarmth(isWarmthlessSlot(next) ? null : (warmth ?? 3));
                      setItemMeasureDraft({});
                      setItemLengthUnits({});
                      setItemShoeUnits({});
                      setItemWeightUnits({});
                    }}
                  >
                    {SRANKO_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {SLOT_LABEL[s]} ({s})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sranko-field">
                  <span>
                    {slot === 'DRESS'
                      ? '소매 타입'
                      : slot === 'BOTTOM'
                        ? '소분류 (기장)'
                        : '소분류'}
                  </span>
                  <select
                    value={categoryCode ?? SRANKO_CATEGORIES[slot ?? 'TOP'][0]}
                    onChange={(e) => setCategoryCode(e.target.value)}
                  >
                    {SRANKO_CATEGORIES[slot ?? 'TOP'].map((c) => (
                      <option key={c} value={c}>
                        {slot === 'DRESS' ? `원피스 · ${c}` : c}
                      </option>
                    ))}
                  </select>
                </label>
                {slot === 'DRESS' ? (
                  <p className="sranko-muted">
                    원피스 소매 길이입니다. 핏맵 소매는 이 타입 기준으로 판정합니다.
                  </p>
                ) : null}
                {slot === 'BOTTOM' ? (
                  <p className="sranko-muted">
                    반바지=짧은 기장, 데님·면바지·슬랙스=긴 기장, 치마=넓은 기장
                    허용. 핏맵 기장 판정에 쓰입니다.
                  </p>
                ) : null}
                <div className="sranko-field">
                  <span>따뜻함 (1–5)</span>
                  {isWarmthlessSlot(slot) ? (
                    <p className="sranko-warmth-na">해당 없음</p>
                  ) : (
                    <div
                      className="sranko-warmth-slider"
                      style={
                        {
                          '--warmth-accent': warmthAccent(warmth ?? 3),
                        } as CSSProperties
                      }
                    >
                      <span
                        className="sranko-warmth-slider__value"
                        aria-live="polite"
                      >
                        {warmthEmoji(warmth ?? 3)} {warmth ?? 3}
                      </span>
                      <input
                        type="range"
                        className="sranko-warmth-slider__input"
                        min={1}
                        max={5}
                        step={1}
                        value={warmth ?? 3}
                        disabled={busy}
                        aria-label="따뜻함"
                        onChange={(e) => setWarmth(Number(e.target.value))}
                      />
                      <div className="sranko-warmth-slider__ends" aria-hidden>
                        <span>
                          {WARMTH_EMOJIS[1]} 1
                        </span>
                        <span>
                          {WARMTH_EMOJIS[5]} 5
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {ITEM_MEASUREMENT_FIELDS[slot].length > 0 ? (
                  <>
                    <p className="sranko-field-label">옷 사이즈 (선택)</p>
                    <MeasurementFields
                      fields={ITEM_MEASUREMENT_FIELDS[slot]}
                      draft={itemMeasureDraft}
                      lengthUnits={itemLengthUnits}
                      shoeUnits={itemShoeUnits}
                      weightUnits={itemWeightUnits}
                      disabled={busy}
                      girthInputMode={itemGirthInputMode}
                      onGirthInputModeChange={setItemGirthInputMode}
                      onDraftChange={(key, value) =>
                        setItemMeasureDraft((prev) => ({ ...prev, [key]: value }))
                      }
                      onDraftReplace={setItemMeasureDraft}
                      onLengthUnitChange={(key, unit) =>
                        setItemLengthUnits((prev) => ({ ...prev, [key]: unit }))
                      }
                      onShoeUnitChange={(key, unit) =>
                        setItemShoeUnits((prev) => ({ ...prev, [key]: unit }))
                      }
                      onWeightUnitChange={(key, unit) =>
                        setItemWeightUnits((prev) => ({ ...prev, [key]: unit }))
                      }
                    />
                  </>
                ) : null}
                {error ? <p className="sranko-error">{error}</p> : null}
                <div className="sranko-modal__actions">
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost"
                    disabled={busy}
                    onClick={backToPhotoStep}
                  >
                    사진 다시
                  </button>
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost"
                    disabled={busy}
                    onClick={closeAddModal}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--primary"
                    disabled={
                      busy ||
                      (!pendingPngBase64 && !existingImageUrl) ||
                      (Boolean(pendingPngBase64) &&
                        extractWornGarment &&
                        !garmentExtractionApplied)
                    }
                    onClick={() => void submitAdd()}
                  >
                    {busy ? '저장 중…' : editingItemId ? '수정 저장' : '저장'}
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </Dialog>
      ) : null}

      {modal === 'tryon' && (tryOnItems.length > 0 || selected) ? (
        <Dialog
          open
          title={tryOnItems.length > 1 ? '룩 입어보기' : '입어보기'}
          onClose={clearTryOnSession}
          closeOnBackdrop={false}
          closeOnEscape={!busy}
          backdropClassName="sranko-modal"
          panelClassName={`sranko-modal__card sranko-modal__card--wide${busy ? ' sranko-modal__card--tryon-busy' : ''}`}
        >
          {({ titleId }) => {
            const garments =
              tryOnItems.length > 0 ? tryOnItems : selected ? [selected] : [];
            const primary = garments[0];
            return (
              <>
                {busy ? (
                  <div className="sranko-tryon-busy" role="status" aria-live="polite">
                    <div className="sranko-tryon-busy__inner">
                      <span className="sranko-spinner sranko-spinner--lg" aria-hidden />
                      <p>미리보기 생성 중…</p>
                    </div>
                  </div>
                ) : null}
                <h2 id={titleId}>
                  {garments.length > 1 ? '룩 입어보기' : '입어보기'}
                </h2>
                <p className="sranko-muted">
                  {garments.length > 1
                    ? `선택한 ${garments.length}벌 · Gemini 풀룩 착용`
                    : (
                      <>
                        선택한 옷: <strong>{primary?.name}</strong> · Gemini 착용
                      </>
                    )}
                </p>
                <div className="sranko-tryon-cols">
                  <div>
                    <p className="sranko-field-label">의류</p>
                    {garments.length > 1 ? (
                      <div className="sranko-tryon-garments">
                        {garments.map((g) => (
                          <figure key={g.id} className="sranko-tryon-garments__item">
                            <img src={g.imageUrl} alt={g.name} />
                            <figcaption>{SLOT_LABEL[g.slot]}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : primary ? (
                      <img
                        className="sranko-preview"
                        src={primary.imageUrl}
                        alt={primary.name}
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="sranko-field-label">기본 마네킹</p>
                    <img
                      className="sranko-preview"
                      src={mannequinPreviewSrc(prefs.sex)}
                      alt="기본 마네킹"
                    />
                    <p className="sranko-muted sranko-tryon-person-hint">
                      성별에 맞는 기본 마네킹에 입혀 보입니다.
                    </p>
                  </div>
                </div>
                {primary ? (
                  <SrankoFitMap
                    slot={primary.slot}
                    parts={fitParts}
                    mannequinSrc={mannequinPreviewSrc(prefs.sex)}
                  />
                ) : null}
                {!hasBodyMeasurements(prefs.bodyMeasurements) &&
                garments.some((g) => !isWarmthlessSlot(g.slot)) ? (
                  <div className="sranko-manual-fit">
                    <p className="sranko-field-label">옷별 핏 (신체 사이즈 없음)</p>
                    <p className="sranko-muted sranko-manual-fit__hint">
                      슬림·보통·오버 중 고른 뒤 입어봅니다. 기본값은 보통입니다.
                    </p>
                    <ul className="sranko-manual-fit__list">
                      {garments
                        .filter((g) => !isWarmthlessSlot(g.slot))
                        .map((g) => {
                        const picked = tryOnFitByItemId[g.id] ?? 'regular';
                        return (
                          <li key={g.id} className="sranko-manual-fit__row">
                            <span className="sranko-manual-fit__name">
                              {SLOT_LABEL[g.slot]} · {g.name}
                            </span>
                            <div
                              className="sranko-manual-fit__options"
                              role="radiogroup"
                              aria-label={`${g.name} 핏`}
                            >
                              {MANUAL_FIT_OPTIONS.map((opt) => (
                                <label key={opt.value} className="sranko-manual-fit__opt">
                                  <input
                                    type="radio"
                                    name={`tryon-fit-${g.id}`}
                                    checked={picked === opt.value}
                                    disabled={busy}
                                    onChange={() =>
                                      setTryOnFitByItemId((prev) => ({
                                        ...prev,
                                        [g.id]: opt.value,
                                      }))
                                    }
                                  />
                                  {opt.label}
                                </label>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                <label className="sranko-check">
                  <input
                    type="checkbox"
                    checked={consent === true}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  Vertex AI 가상 피팅(프로토타입) 이용에 동의합니다
                </label>
                {error ? <p className="sranko-error">{error}</p> : null}
                <div className="sranko-modal__actions">
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost"
                    disabled={busy}
                    onClick={clearTryOnSession}
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--primary"
                    disabled={busy || garments.length === 0}
                    onClick={() => void runTryOn()}
                  >
                    {busy ? (
                      <span className="sranko-status--row">
                        <span className="sranko-spinner" aria-hidden />
                        생성 중…
                      </span>
                    ) : garments.length > 1 ? (
                      '룩 입어보기 실행'
                    ) : (
                      '입어보기 실행'
                    )}
                  </button>
                </div>
              </>
            );
          }}
        </Dialog>
      ) : null}

      {modal === 'tryon-result' && tryOnResult && (tryOnItems.length > 0 || selected) ? (
        <Dialog
          open
          title="입어보기 결과"
          onClose={clearTryOnSession}
          closeOnBackdrop={false}
          closeOnEscape={!busy}
          backdropClassName="sranko-modal"
          panelClassName="sranko-modal__card sranko-modal__card--wide sranko-modal__card--tryon-result"
        >
          {({ titleId }) => {
            const garments =
              tryOnItems.length > 0 ? tryOnItems : selected ? [selected] : [];
            const primary = garments[0];
            const titleLabel =
              garments.length > 1
                ? garments.map((g) => SLOT_LABEL[g.slot]).join(' + ')
                : primary?.name ?? '';
            return (
              <>
                <h2 id={titleId}>입어보기 결과</h2>
                <p className="sranko-muted">
                  <strong>{titleLabel}</strong>
                  {tryOnMuchTooSmall ? (
                    <>
                      {' '}
                      <span className="sranko-badge sranko-badge--fit">
                        타이트 · 옷이 작음
                      </span>
                    </>
                  ) : tryOnFit ? (
                    <>
                      {' '}
                      <span className="sranko-badge sranko-badge--fit">
                        {SRANKO_FIT_LABEL[tryOnFit]}
                      </span>
                    </>
                  ) : (
                    <>
                      {' '}
                      <span className="sranko-badge sranko-badge--fit sranko-badge--fit-muted">
                        핏 미적용 · 착용 모습만
                      </span>
                    </>
                  )}
                </p>
                <SrankoZoomableImage
                  className="sranko-tryon-result-frame"
                  imageClassName="sranko-preview sranko-preview--lg sranko-preview--in-frame"
                  src={tryOnResult}
                  alt="착용 결과"
                />
                {primary ? (
                  <SrankoFitMap
                    slot={primary.slot}
                    parts={fitParts}
                    mannequinSrc={mannequinPreviewSrc(prefs.sex)}
                  />
                ) : null}
                {error ? <p className="sranko-error">{error}</p> : null}
                <div className="sranko-modal__actions">
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost"
                    disabled={busy}
                    onClick={clearTryOnSession}
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost"
                    disabled={busy}
                    onClick={retryTryOnConfirm}
                  >
                    다시
                  </button>
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--primary"
                    disabled={busy}
                    onClick={() => void saveTryOnLook()}
                  >
                    {busy ? '저장 중…' : '내 룩에 저장'}
                  </button>
                </div>
              </>
            );
          }}
        </Dialog>
      ) : null}

      {modal === 'profile' ? (
        <Dialog
          open
          title="정보 수정"
          onClose={() => {
            if (!busy) {
              setModal(null);
            }
          }}
          closeOnBackdrop={false}
          closeOnEscape={!busy}
          backdropClassName="sranko-modal"
          panelClassName="sranko-modal__card sranko-modal__card--wide"
        >
          {({ titleId }) => (
            <>
              <h2 id={titleId}>정보 수정</h2>
              <p className="sranko-muted">
                입어보기 마네킹 성별과 신체 사이즈를 관리합니다.
              </p>

              <section className="sranko-profile-section">
                <h3 className="sranko-profile-section__title">성별</h3>
                <p className="sranko-muted sranko-profile-section__hint">
                  기본 마네킹에 사용됩니다. 「사이즈 저장」과 함께 저장됩니다.
                </p>
                <div className="sranko-sex-toggle" role="group" aria-label="성별">
                  <button
                    type="button"
                    className={`sranko-btn sranko-btn--sm${sexDraft === 'M' ? ' sranko-btn--primary' : ' sranko-btn--ghost'}`}
                    disabled={busy}
                    aria-pressed={sexDraft === 'M'}
                    onClick={() => setSexDraft('M')}
                  >
                    남자
                  </button>
                  <button
                    type="button"
                    className={`sranko-btn sranko-btn--sm${sexDraft === 'F' ? ' sranko-btn--primary' : ' sranko-btn--ghost'}`}
                    disabled={busy}
                    aria-pressed={sexDraft === 'F'}
                    onClick={() => setSexDraft('F')}
                  >
                    여자
                  </button>
                </div>
                <div className="sranko-profile-mannequin-preview">
                  <img
                    src={mannequinPreviewSrc(sexDraft)}
                    alt={sexDraft === 'F' ? '여자 기본 마네킹' : '남자 기본 마네킹'}
                  />
                </div>
              </section>

              <section className="sranko-profile-section">
                <h3 className="sranko-profile-section__title">자주 가는 곳</h3>
                <p className="sranko-muted sranko-profile-section__hint">
                  집·회사·즐겨찾기(최대 5)를 등록하면 옷장 날씨 칩으로 바로 볼 수
                  있습니다. 일회성 지역 조회는 옷장 「오늘 날씨」 검색을 쓰세요.
                </p>
                <div className="sranko-place-search">
                  <input
                    type="search"
                    value={placeSearchQuery}
                    onChange={(e) => setPlaceSearchQuery(e.target.value)}
                    placeholder="지역·주소 검색 (예: 강남)"
                    disabled={busy || placeSearchBusy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void runPlaceSearch();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                    disabled={busy || placeSearchBusy}
                    onClick={() => void runPlaceSearch()}
                  >
                    {placeSearchBusy ? '검색 중…' : '검색'}
                  </button>
                </div>
                {placeSearchHits.length > 0 ? (
                  <ul className="sranko-place-hits">
                    {placeSearchHits.map((hit) => (
                      <li key={`${hit.name}-${hit.lat}-${hit.lon}`}>
                        <div>
                          <strong>{hit.name}</strong>
                          <span>
                            {[hit.region, hit.country].filter(Boolean).join(', ')}
                          </span>
                        </div>
                        <div className="sranko-place-hits__actions">
                          <button
                            type="button"
                            className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                            disabled={busy}
                            onClick={() =>
                              void upsertPlace('HOME', {
                                label: '집',
                                lat: hit.lat,
                                lon: hit.lon,
                                query: hit.name,
                              })
                            }
                          >
                            집
                          </button>
                          <button
                            type="button"
                            className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                            disabled={busy}
                            onClick={() =>
                              void upsertPlace('WORK', {
                                label: '회사',
                                lat: hit.lat,
                                lon: hit.lon,
                                query: hit.name,
                              })
                            }
                          >
                            회사
                          </button>
                          <button
                            type="button"
                            className="sranko-btn sranko-btn--primary sranko-btn--sm"
                            disabled={busy}
                            onClick={() =>
                              void upsertPlace('FAVORITE', {
                                label: hit.name,
                                lat: hit.lat,
                                lon: hit.lon,
                                query: hit.name,
                              })
                            }
                          >
                            즐겨찾기
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="sranko-profile-section__actions">
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                    disabled={busy || !coords}
                    onClick={() => void savePlaceFromCurrentLocation('HOME')}
                  >
                    현재 위치 → 집
                  </button>
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                    disabled={busy || !coords}
                    onClick={() => void savePlaceFromCurrentLocation('WORK')}
                  >
                    현재 위치 → 회사
                  </button>
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                    disabled={busy || !coords}
                    onClick={() => void savePlaceFromCurrentLocation('FAVORITE')}
                  >
                    현재 위치 → 즐겨찾기
                  </button>
                </div>
                {prefs.places.length === 0 ? (
                  <p className="sranko-muted">등록된 장소가 없습니다.</p>
                ) : (
                  <ul className="sranko-place-list">
                    {prefs.places.map((place) => (
                      <li key={place.id}>
                        <div>
                          <strong>
                            {placeKindLabel(place.kind)}
                            {place.kind === 'FAVORITE' ? ` · ${place.label}` : ''}
                          </strong>
                          <span>
                            {place.query ?? `${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                          disabled={busy}
                          onClick={() => void removePlace(place.id)}
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="sranko-profile-section">
                <h3 className="sranko-profile-section__title">내 사이즈</h3>
                <p className="sranko-muted sranko-profile-section__hint">
                  길이는 cm, 몸무게는 kg, 발 사이즈는 mm로 저장됩니다. 가슴·허리·엉덩이·허벅지
                  등은 둘레(cm)입니다.
                </p>
                {BODY_MEASUREMENT_SECTIONS.map((section) => (
                  <section key={section.id} className="sranko-measure-section">
                    <h4 className="sranko-measure-section__title">{section.title}</h4>
                    <MeasurementFields
                      fields={section.fields}
                      draft={bodyDraft}
                      lengthUnits={bodyLengthUnits}
                      shoeUnits={bodyShoeUnits}
                      weightUnits={bodyWeightUnits}
                      disabled={busy}
                      onDraftChange={(key, value) =>
                        setBodyDraft((prev) => ({ ...prev, [key]: value }))
                      }
                      onLengthUnitChange={(key, unit) =>
                        setBodyLengthUnits((prev) => ({ ...prev, [key]: unit }))
                      }
                      onShoeUnitChange={(key, unit) =>
                        setBodyShoeUnits((prev) => ({ ...prev, [key]: unit }))
                      }
                      onWeightUnitChange={(key, unit) =>
                        setBodyWeightUnits((prev) => ({ ...prev, [key]: unit }))
                      }
                    />
                  </section>
                ))}
                <div className="sranko-profile-section__actions">
                  {hasBodyMeasurements(prefs.bodyMeasurements) ? (
                    <button
                      type="button"
                      className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                      disabled={busy}
                      onClick={() => void clearBodySizes()}
                    >
                      {busy ? '삭제 중…' : '사이즈 삭제'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="sranko-btn sranko-btn--primary sranko-btn--sm"
                    disabled={busy}
                    onClick={() => void saveBodySizes()}
                  >
                    {busy ? '저장 중…' : '사이즈 저장'}
                  </button>
                </div>
              </section>

              {error ? <p className="sranko-error">{error}</p> : null}
              <div className="sranko-modal__actions">
                <button
                  type="button"
                  className="sranko-btn sranko-btn--ghost"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </Dialog>
      ) : null}
    </section>
  );
}
