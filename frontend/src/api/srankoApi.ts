import { apiClient } from './axios';
import { getErrorMessage } from '../utils/error';
import { getSrankoViewerId } from '../features/sranko/srankoViewerId';
import type {
  SrankoComment,
  SrankoFitBand,
  SrankoFitPart,
  SrankoItem,
  SrankoLook,
  SrankoLookItem,
  SrankoLookPicker,
  SrankoPlace,
  SrankoPlaceSearchHit,
  SrankoPost,
  SrankoSlot,
  SrankoUserPrefs,
  SrankoWeather,
  SrankoWeatherHourly,
  SrankoWornGarmentSlot,
} from '../features/sranko/types';

const BASE = '/api/v1/sranko';

export type SrankoUploadKind = 'item' | 'look' | 'post' | 'tryon';

export interface SrankoPredictOptions {
  extractWornGarment: boolean;
  targetSlot?: SrankoWornGarmentSlot;
  /** Product-photo path: classify only; call rembg separately. */
  skipBackgroundRemoval?: boolean;
}

export interface SrankoPredictResult {
  imageUrl: string | null;
  imagePngBase64: string | null;
  slot: SrankoSlot | null;
  categoryCode: string | null;
  warmth: number | null;
  taxonomyGroup: string | null;
  classNum: number;
  category1: string;
  category2: string;
  rejected: boolean;
  width: number;
  height: number;
  garmentExtractionApplied: boolean;
  extractionWarning: string | null;
}

export interface SrankoRembgResult {
  imagePngBase64: string;
  width: number;
  height: number;
}

interface SrankoPredictApi extends SrankoPredictResult {}

interface SrankoPrefsApi {
  tryOnConsent: boolean;
  sex?: string | null;
  bodyMeasurements?: Record<string, string> | null;
  places?: SrankoPlaceApi[] | null;
}

interface SrankoPlaceApi {
  id: string;
  label: string;
  kind: string;
  lat: number;
  lon: number;
  query?: string | null;
}

function parsePlaceKind(raw: string | null | undefined): SrankoPlace['kind'] | null {
  const upper = (raw ?? '').trim().toUpperCase();
  if (upper === 'HOME' || upper === 'WORK' || upper === 'FAVORITE') {
    return upper;
  }
  return null;
}

function mapPlace(data: SrankoPlaceApi): SrankoPlace | null {
  const kind = parsePlaceKind(data.kind);
  if (!kind || !Number.isFinite(data.lat) || !Number.isFinite(data.lon)) {
    return null;
  }
  return {
    id: data.id,
    label: data.label,
    kind,
    lat: data.lat,
    lon: data.lon,
    query: data.query ?? null,
  };
}

function parsePrefsSex(raw: string | null | undefined): 'M' | 'F' | null {
  if (raw == null || raw.trim() === '') {
    return null;
  }
  const upper = raw.trim().toUpperCase();
  if (upper === 'F') {
    return 'F';
  }
  if (upper === 'M') {
    return 'M';
  }
  return null;
}

function mapPrefs(data: SrankoPrefsApi): SrankoUserPrefs {
  const places = (data.places ?? [])
    .map(mapPlace)
    .filter((p): p is SrankoPlace => p != null);
  return {
    tryOnConsent: Boolean(data.tryOnConsent),
    sex: parsePrefsSex(data.sex),
    bodyMeasurements: data.bodyMeasurements ?? {},
    places,
  };
}

interface SrankoItemApi {
  id: string;
  slot: SrankoSlot;
  categoryCode: string;
  warmth: number | null;
  name: string;
  brand?: string | null;
  productUrl?: string | null;
  imageUrl: string;
  measurements: Record<string, string>;
  createdAt: string;
}

interface SrankoLookItemApi {
  id: string;
  missing: boolean;
  slot?: string | null;
  categoryCode?: string | null;
  name: string;
  brand?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
}

interface SrankoLookApi {
  id: string;
  name: string;
  imageUrl: string;
  itemIds: string[];
  items?: SrankoLookItemApi[] | null;
  source: 'COMPOSE' | 'TRY_ON';
  createdAt: string;
}

interface SrankoPostApi {
  id: string;
  subject: string;
  content: string;
  imageUrl: string;
  imageUrls?: string[] | null;
  authorNickname: string;
  authorUserId: string;
  readCount: number;
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
  viewCounted?: boolean | null;
  createdAt: string;
}

interface SrankoCommentApi {
  id: string;
  postId: string;
  parentId?: string | null;
  body: string;
  authorNickname: string;
  authorUserId: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
}

interface SrankoLikeToggleApi {
  likeCount: number;
  likedByMe: boolean;
}

interface SrankoTryOnApi {
  resultImageUrl: string;
  stub: boolean;
  fit?: string | null;
  muchTooSmall?: boolean | null;
  warpApplied?: boolean | null;
  stage2Applied?: boolean | null;
}

interface SrankoFitPartApi {
  key: string;
  bodyCm?: number | null;
  garmentCm?: number | null;
  deltaCm?: number | null;
  band?: string | null;
}

interface SrankoFitCheckApi {
  fit: string;
  muchTooSmall: boolean;
  skipStage2: boolean;
  parts?: SrankoFitPartApi[] | null;
}

interface SrankoUploadApi {
  url: string;
  key: string;
  kind: string;
}

interface SrankoWeatherApi {
  condition: string | null;
  conditionCode: number | null;
  tempC: number;
  humidity: number | null;
  windKph: number | null;
  cached: boolean;
  manualTemp: boolean;
  hourly?: Array<{
    time: string;
    condition?: string | null;
    conditionCode?: number | null;
    tempC: number;
    chanceOfRain?: number | null;
  }> | null;
}

function rethrow(error: unknown, fallback: string): never {
  throw new Error(getErrorMessage(error, fallback));
}

function mapItem(data: SrankoItemApi): SrankoItem {
  return {
    id: data.id,
    slot: data.slot,
    categoryCode: data.categoryCode,
    warmth: data.warmth ?? null,
    name: data.name,
    brand: data.brand?.trim() ? data.brand.trim() : null,
    productUrl: data.productUrl?.trim() ? data.productUrl.trim() : null,
    imageUrl: data.imageUrl,
    measurements: data.measurements ?? {},
    createdAt: data.createdAt,
  };
}

function mapLookItem(data: SrankoLookItemApi): SrankoLookItem {
  const slot =
    data.slot === 'TOP'
    || data.slot === 'BOTTOM'
    || data.slot === 'OUTER'
    || data.slot === 'SHOES'
    || data.slot === 'DRESS'
    || data.slot === 'BAG'
    || data.slot === 'HAT'
    || data.slot === 'JEWELRY'
      ? data.slot
      : null;
  return {
    id: data.id,
    missing: Boolean(data.missing),
    slot,
    categoryCode: data.categoryCode ?? null,
    name: data.name,
    brand: data.brand?.trim() ? data.brand.trim() : null,
    productUrl: data.productUrl?.trim() ? data.productUrl.trim() : null,
    imageUrl: data.imageUrl ?? null,
  };
}

function mapLook(data: SrankoLookApi): SrankoLook {
  const items = (data.items ?? []).map(mapLookItem);
  return {
    id: data.id,
    name: data.name,
    imageUrl: data.imageUrl,
    itemIds: data.itemIds ?? items.map((i) => i.id),
    items,
    source: data.source,
    createdAt: data.createdAt,
  };
}

function mapPost(data: SrankoPostApi): SrankoPost {
  const imageUrls =
    data.imageUrls && data.imageUrls.length > 0
      ? data.imageUrls
      : data.imageUrl
        ? [data.imageUrl]
        : [];
  return {
    id: data.id,
    subject: data.subject,
    content: data.content,
    imageUrl: imageUrls[0] ?? data.imageUrl,
    imageUrls,
    authorNickname: data.authorNickname,
    authorUserId: data.authorUserId,
    readCount: data.readCount,
    likeCount: data.likeCount ?? 0,
    commentCount: data.commentCount ?? 0,
    likedByMe: Boolean(data.likedByMe),
    viewCounted: data.viewCounted ?? null,
    createdAt: data.createdAt,
  };
}

function mapComment(data: SrankoCommentApi): SrankoComment {
  return {
    id: data.id,
    postId: data.postId,
    parentId: data.parentId ?? null,
    body: data.body,
    authorNickname: data.authorNickname,
    authorUserId: data.authorUserId,
    likeCount: data.likeCount,
    likedByMe: Boolean(data.likedByMe),
    createdAt: data.createdAt,
  };
}

function mapFitPart(data: SrankoFitPartApi): SrankoFitPart {
  const rawBand = (data.band ?? 'unknown').toLowerCase();
  const band: SrankoFitBand =
    rawBand === 'small' || rawBand === 'ok' || rawBand === 'large'
      ? rawBand
      : 'unknown';
  return {
    key: data.key,
    bodyCm: typeof data.bodyCm === 'number' ? data.bodyCm : null,
    garmentCm: typeof data.garmentCm === 'number' ? data.garmentCm : null,
    deltaCm: typeof data.deltaCm === 'number' ? data.deltaCm : null,
    band,
  };
}

function mapWeather(data: SrankoWeatherApi): SrankoWeather {
  const hourly: SrankoWeatherHourly[] = (data.hourly ?? [])
    .filter((h) => h != null && typeof h.tempC === 'number')
    .map((h) => ({
      time: h.time,
      condition: h.condition ?? null,
      conditionCode: h.conditionCode ?? null,
      tempC: h.tempC,
      chanceOfRain: typeof h.chanceOfRain === 'number' ? h.chanceOfRain : null,
    }));
  return {
    condition: data.condition ?? null,
    conditionCode: data.conditionCode ?? null,
    tempC: data.tempC,
    humidity: data.humidity ?? null,
    windKph: data.windKph ?? null,
    cached: Boolean(data.cached),
    manualTemp: Boolean(data.manualTemp),
    hourly,
  };
}

export const srankoApi = {
  async upload(kind: SrankoUploadKind, file: File): Promise<{ url: string; key: string }> {
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<SrankoUploadApi>(`${BASE}/uploads`, form, {
        params: { kind },
      });
      return { url: data.url, key: data.key };
    } catch (error) {
      rethrow(error, '이미지 업로드에 실패했어요.');
    }
  },

  async deleteUpload(url: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/uploads`, { params: { url } });
    } catch (error) {
      rethrow(error, '업로드 이미지 삭제에 실패했어요.');
    }
  },

  async getPrefs(): Promise<SrankoUserPrefs> {
    try {
      const { data } = await apiClient.get<SrankoPrefsApi>(`${BASE}/prefs`);
      return mapPrefs(data);
    } catch (error) {
      rethrow(error, '설정을 불러오지 못했어요.');
    }
  },

  async patchPrefs(patch: Partial<SrankoUserPrefs>): Promise<SrankoUserPrefs> {
    try {
      const { data } = await apiClient.patch<SrankoPrefsApi>(`${BASE}/prefs`, {
        tryOnConsent: patch.tryOnConsent,
        sex: patch.sex === undefined ? undefined : (patch.sex ?? ''),
        bodyMeasurements: patch.bodyMeasurements,
        places: patch.places,
      });
      return mapPrefs(data);
    } catch (error) {
      rethrow(error, '설정을 저장하지 못했어요.');
    }
  },

  async listItems(): Promise<SrankoItem[]> {
    try {
      const { data } = await apiClient.get<SrankoItemApi[]>(`${BASE}/items`);
      return data.map(mapItem);
    } catch (error) {
      rethrow(error, '옷장을 불러오지 못했어요.');
    }
  },

  async upsertItem(input: {
    id?: string;
    slot: SrankoSlot;
    categoryCode: string;
    warmth?: number | null;
    name: string;
    brand?: string | null;
    productUrl?: string | null;
    imageUrl: string;
    measurements?: Record<string, string>;
  }): Promise<SrankoItem> {
    try {
      const { data } = await apiClient.put<SrankoItemApi>(`${BASE}/items`, {
        id: input.id ?? null,
        slot: input.slot,
        categoryCode: input.categoryCode,
        warmth: input.warmth ?? null,
        name: input.name,
        brand: input.brand?.trim() ? input.brand.trim() : null,
        productUrl: input.productUrl?.trim() ? input.productUrl.trim() : null,
        imageUrl: input.imageUrl,
        measurements: input.measurements ?? {},
      });
      return mapItem(data);
    } catch (error) {
      rethrow(error, '아이템을 저장하지 못했어요.');
    }
  },

  async deleteItem(itemId: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/items/${itemId}`);
    } catch (error) {
      rethrow(error, '아이템을 삭제하지 못했어요.');
    }
  },

  async listLooks(): Promise<SrankoLook[]> {
    try {
      const { data } = await apiClient.get<SrankoLookApi[]>(`${BASE}/looks`);
      return data.map(mapLook);
    } catch (error) {
      rethrow(error, '룩을 불러오지 못했어요.');
    }
  },

  /** Community write — no items hydrate (1 query on server). */
  async listLooksPicker(): Promise<SrankoLookPicker[]> {
    try {
      const { data } = await apiClient.get<
        Array<{ id: string; name: string; imageUrl: string; createdAt: string }>
      >(`${BASE}/looks/picker`);
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt,
      }));
    } catch (error) {
      rethrow(error, '룩을 불러오지 못했어요.');
    }
  },

  async getLook(lookId: string): Promise<SrankoLook> {
    try {
      const { data } = await apiClient.get<SrankoLookApi>(`${BASE}/looks/${lookId}`);
      return mapLook(data);
    } catch (error) {
      rethrow(error, '룩을 불러오지 못했어요.');
    }
  },

  async createLook(input: {
    name: string;
    imageUrl: string;
    itemIds: string[];
    source: 'COMPOSE' | 'TRY_ON';
  }): Promise<SrankoLook> {
    try {
      const { data } = await apiClient.post<SrankoLookApi>(`${BASE}/looks`, input);
      return mapLook(data);
    } catch (error) {
      rethrow(error, '룩을 저장하지 못했어요.');
    }
  },

  async deleteLook(lookId: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/looks/${lookId}`);
    } catch (error) {
      rethrow(error, '룩을 삭제하지 못했어요.');
    }
  },

  async listPosts(sort: 'new' | 'view' = 'new'): Promise<SrankoPost[]> {
    try {
      const { data } = await apiClient.get<SrankoPostApi[]>(`${BASE}/posts`, {
        params: { sort },
      });
      return data.map(mapPost);
    } catch (error) {
      rethrow(error, '커뮤니티를 불러오지 못했어요.');
    }
  },

  async listMyPosts(): Promise<SrankoPost[]> {
    try {
      const { data } = await apiClient.get<SrankoPostApi[]>(`${BASE}/posts/mine`);
      return data.map(mapPost);
    } catch (error) {
      rethrow(error, '내 게시글을 불러오지 못했어요.');
    }
  },

  async getPost(postId: string): Promise<SrankoPost> {
    try {
      const { data } = await apiClient.get<SrankoPostApi>(`${BASE}/posts/${postId}`);
      return mapPost(data);
    } catch (error) {
      rethrow(error, '게시글을 불러오지 못했어요.');
    }
  },

  async createPost(input: {
    subject: string;
    content: string;
    imageUrls: string[];
  }): Promise<SrankoPost> {
    try {
      const { data } = await apiClient.post<SrankoPostApi>(`${BASE}/posts`, input);
      return mapPost(data);
    } catch (error) {
      rethrow(error, '게시글을 작성하지 못했어요.');
    }
  },

  async deletePost(postId: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/posts/${postId}`);
    } catch (error) {
      rethrow(error, '게시글을 삭제하지 못했어요.');
    }
  },

  async bumpRead(postId: string): Promise<SrankoPost> {
    try {
      const { data } = await apiClient.post<SrankoPostApi>(
        `${BASE}/posts/${postId}/read`,
        null,
        { headers: { 'X-Sranko-Viewer': getSrankoViewerId() } },
      );
      return mapPost(data);
    } catch (error) {
      rethrow(error, '조회수를 갱신하지 못했어요.');
    }
  },

  async togglePostLike(postId: string): Promise<{ likeCount: number; likedByMe: boolean }> {
    try {
      const { data } = await apiClient.post<SrankoLikeToggleApi>(
        `${BASE}/posts/${postId}/like`,
      );
      return { likeCount: data.likeCount, likedByMe: Boolean(data.likedByMe) };
    } catch (error) {
      rethrow(error, '좋아요를 처리하지 못했어요.');
    }
  },

  async listComments(postId: string): Promise<SrankoComment[]> {
    try {
      const { data } = await apiClient.get<SrankoCommentApi[]>(
        `${BASE}/posts/${postId}/comments`,
      );
      return data.map(mapComment);
    } catch (error) {
      rethrow(error, '댓글을 불러오지 못했어요.');
    }
  },

  async createComment(
    postId: string,
    input: { body: string; parentId?: string | null },
  ): Promise<SrankoComment> {
    try {
      const { data } = await apiClient.post<SrankoCommentApi>(
        `${BASE}/posts/${postId}/comments`,
        {
          body: input.body,
          parentId: input.parentId ?? null,
        },
      );
      return mapComment(data);
    } catch (error) {
      rethrow(error, '댓글을 작성하지 못했어요.');
    }
  },

  async deleteComment(postId: string, commentId: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/posts/${postId}/comments/${commentId}`);
    } catch (error) {
      rethrow(error, '댓글을 삭제하지 못했어요.');
    }
  },

  async toggleCommentLike(
    postId: string,
    commentId: string,
  ): Promise<{ likeCount: number; likedByMe: boolean }> {
    try {
      const { data } = await apiClient.post<SrankoLikeToggleApi>(
        `${BASE}/posts/${postId}/comments/${commentId}/like`,
      );
      return { likeCount: data.likeCount, likedByMe: Boolean(data.likedByMe) };
    } catch (error) {
      rethrow(error, '댓글 좋아요를 처리하지 못했어요.');
    }
  },

  async fitCheck(itemId: string): Promise<{
    fit: 'slim' | 'regular' | 'loose';
    muchTooSmall: boolean;
    skipStage2: boolean;
    parts: SrankoFitPart[];
  }> {
    try {
      const { data } = await apiClient.get<SrankoFitCheckApi>(`${BASE}/fit-check`, {
        params: { itemId },
      });
      const rawFit = (data.fit ?? 'regular').toLowerCase();
      const fit: 'slim' | 'regular' | 'loose' =
        rawFit === 'slim' || rawFit === 'loose' ? rawFit : 'regular';
      return {
        fit,
        muchTooSmall: Boolean(data.muchTooSmall),
        skipStage2: Boolean(data.skipStage2),
        parts: (data.parts ?? []).map(mapFitPart),
      };
    } catch (error) {
      rethrow(error, '핏 미리보기에 실패했어요.');
    }
  },

  async tryOn(input: {
    garmentImageUrl?: string;
    itemId?: string;
      /** Multi-garment look try-on (preferred). */
      itemIds?: string[];
      /** @deprecated Prefer fitByItemId when body sizes are missing. */
      skipFit?: boolean;
      /** Per closet item fit when body measurements are missing. */
      fitByItemId?: Record<string, 'slim' | 'regular' | 'loose'>;
    }): Promise<{
      resultImageUrl: string;
    stub: boolean;
    fit: 'slim' | 'regular' | 'loose' | null;
    muchTooSmall: boolean | null;
  }> {
    try {
      const { data } = await apiClient.post<SrankoTryOnApi>(`${BASE}/ml/try-on`, input);
      if (data.fit == null || data.fit === '') {
        return {
          resultImageUrl: data.resultImageUrl,
          stub: Boolean(data.stub),
          fit: null,
          muchTooSmall: null,
        };
      }
      const rawFit = data.fit.toLowerCase();
      const fit: 'slim' | 'regular' | 'loose' =
        rawFit === 'slim' || rawFit === 'loose' ? rawFit : 'regular';
      return {
        resultImageUrl: data.resultImageUrl,
        stub: Boolean(data.stub),
        fit,
        muchTooSmall: data.muchTooSmall == null ? null : Boolean(data.muchTooSmall),
      };
    } catch (error) {
      rethrow(error, '입어보기에 실패했어요.');
    }
  },

  async predict(
    file: File,
    options: SrankoPredictOptions = { extractWornGarment: false },
  ): Promise<SrankoPredictResult> {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('extractWornGarment', String(options.extractWornGarment));
      form.append(
        'skipBackgroundRemoval',
        String(Boolean(options.skipBackgroundRemoval)),
      );
      if (options.extractWornGarment && options.targetSlot) {
        form.append('targetSlot', options.targetSlot);
      }
      const { data } = await apiClient.post<SrankoPredictApi>(`${BASE}/ml/predict`, form);
      return {
        imageUrl: data.imageUrl ?? null,
        imagePngBase64: data.imagePngBase64 ?? null,
        slot: data.slot ?? null,
        categoryCode: data.categoryCode ?? null,
        warmth: data.warmth ?? null,
        taxonomyGroup: data.taxonomyGroup ?? null,
        classNum: data.classNum,
        category1: data.category1,
        category2: data.category2,
        rejected: Boolean(data.rejected),
        width: data.width,
        height: data.height,
        garmentExtractionApplied: Boolean(data.garmentExtractionApplied),
        extractionWarning: data.extractionWarning ?? null,
      };
    } catch (error) {
      rethrow(error, '옷 분류에 실패했어요.');
    }
  },

  async rembg(file: File): Promise<SrankoRembgResult> {
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<{
        imagePngBase64: string;
        width: number;
        height: number;
      }>(`${BASE}/ml/rembg`, form);
      if (!data.imagePngBase64) {
        throw new Error('배경제거 결과가 비어 있습니다.');
      }
      return {
        imagePngBase64: data.imagePngBase64,
        width: data.width,
        height: data.height,
      };
    } catch (error) {
      rethrow(error, '배경 제거에 실패했어요.');
    }
  },

  async getWeather(params: {
    lat?: number;
    lon?: number;
    tempC?: number;
  }): Promise<SrankoWeather> {
    try {
      const { data } = await apiClient.get<SrankoWeatherApi>(`${BASE}/weather`, {
        params: {
          lat: params.lat,
          lon: params.lon,
          tempC: params.tempC,
        },
      });
      return mapWeather(data);
    } catch (error) {
      rethrow(error, '날씨 정보를 불러오지 못했어요.');
    }
  },

  async searchPlaces(q: string): Promise<SrankoPlaceSearchHit[]> {
    try {
      const { data } = await apiClient.get<
        Array<{
          name: string;
          region?: string | null;
          country?: string | null;
          lat: number;
          lon: number;
        }>
      >(`${BASE}/places/search`, { params: { q } });
      return (data ?? []).map((hit) => ({
        name: hit.name,
        region: hit.region ?? null,
        country: hit.country ?? null,
        lat: hit.lat,
        lon: hit.lon,
      }));
    } catch (error) {
      rethrow(error, '장소 검색에 실패했어요.');
    }
  },
};
