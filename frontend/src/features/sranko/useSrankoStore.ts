import { useCallback, useEffect, useState } from 'react';
import { srankoApi, type SrankoPredictOptions } from '../../api/srankoApi';
import { useAuthStore } from '../../stores/authStore';
import type {
  SrankoItem,
  SrankoLook,
  SrankoPost,
  SrankoUserPrefs,
} from './types';

const EMPTY_PREFS: SrankoUserPrefs = {
  tryOnConsent: false,
  sex: null,
  bodyMeasurements: {},
  places: [],
};

export function useSrankoItems(): {
  items: SrankoItem[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<SrankoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setItems(await srankoApi.listItems());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '옷장을 불러오지 못했어요.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}

export function useSrankoLooks(): {
  looks: SrankoLook[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [looks, setLooks] = useState<SrankoLook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!accessToken) {
      setLooks([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setLooks(await srankoApi.listLooks());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '룩을 불러오지 못했어요.');
      setLooks([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { looks, loading, error, reload };
}

export function useSrankoPrefs(): {
  prefs: SrankoUserPrefs;
  loading: boolean;
  reload: () => Promise<void>;
  savePrefs: (patch: Partial<SrankoUserPrefs>) => Promise<SrankoUserPrefs>;
} {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [prefs, setPrefs] = useState<SrankoUserPrefs>(EMPTY_PREFS);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!accessToken) {
      setPrefs(EMPTY_PREFS);
      return;
    }
    setLoading(true);
    try {
      setPrefs(await srankoApi.getPrefs());
    } catch {
      setPrefs(EMPTY_PREFS);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const savePrefs = useCallback(async (patch: Partial<SrankoUserPrefs>) => {
    const next = await srankoApi.patchPrefs(patch);
    setPrefs(next);
    return next;
  }, []);

  return { prefs, loading, reload, savePrefs };
}

export function useSrankoPosts(sort: 'new' | 'view' = 'new'): {
  posts: SrankoPost[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} {
  const [posts, setPosts] = useState<SrankoPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPosts(await srankoApi.listPosts(sort));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '커뮤니티를 불러오지 못했어요.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { posts, loading, error, reload };
}

export function useSrankoMutations() {
  const saveItem = useCallback(
    async (input: {
      id?: string;
      slot: SrankoItem['slot'];
      categoryCode: string;
      warmth?: number | null;
      name: string;
      brand?: string | null;
      productUrl?: string | null;
      imageUrl: string;
      measurements?: Record<string, string>;
    }) => srankoApi.upsertItem(input),
    [],
  );

  const removeItem = useCallback(
    async (itemId: string) => srankoApi.deleteItem(itemId),
    [],
  );

  const saveLook = useCallback(
    async (input: {
      name: string;
      imageUrl: string;
      itemIds: string[];
      source: SrankoLook['source'];
    }) => srankoApi.createLook(input),
    [],
  );

  const removeLook = useCallback(
    async (lookId: string) => srankoApi.deleteLook(lookId),
    [],
  );

  const savePost = useCallback(
    async (input: { subject: string; content: string; imageUrls: string[] }) =>
      srankoApi.createPost(input),
    [],
  );

  const removePost = useCallback(
    async (postId: string) => srankoApi.deletePost(postId),
    [],
  );

  const openPost = useCallback(
    async (postId: string) => srankoApi.bumpRead(postId),
    [],
  );

  const tryOn = useCallback(
    async (input: {
      garmentImageUrl?: string;
      itemId?: string;
      itemIds?: string[];
      skipFit?: boolean;
      fitByItemId?: Record<string, 'slim' | 'regular' | 'loose'>;
    }) => srankoApi.tryOn(input),
    [],
  );

  const uploadImage = useCallback(
    async (kind: 'item' | 'look' | 'post' | 'tryon', file: File) =>
      srankoApi.upload(kind, file),
    [],
  );

  const deleteUpload = useCallback(
    async (url: string) => srankoApi.deleteUpload(url),
    [],
  );

  const predictItem = useCallback(
    async (
      file: File,
      options: SrankoPredictOptions = { extractWornGarment: false },
    ) => srankoApi.predict(file, options),
    [],
  );

  return {
    saveItem,
    removeItem,
    saveLook,
    removeLook,
    savePost,
    removePost,
    openPost,
    tryOn,
    uploadImage,
    deleteUpload,
    predictItem,
  };
}
