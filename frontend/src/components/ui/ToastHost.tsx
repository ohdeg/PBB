import { useToastStore } from '../../stores/toastStore';

const KIND_CLASS: Record<string, string> = {
  success: 'bg-[#34C759] text-white',
  error: 'bg-[#FF3B30] text-white',
  info: 'bg-[#1D1D1F] text-white',
  loading: 'bg-[#1D1D1F] text-white',
};

export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`pointer-events-auto max-w-md w-full rounded-[18px] border border-white/10 px-5 py-3.5 text-left text-[17px] font-normal tracking-[-0.374px] transition-transform duration-150 ease-out active:scale-95 animate-[toast-in_0.28s_ease-out] ${KIND_CLASS[item.kind] ?? KIND_CLASS.info}`}
          onClick={() => dismiss(item.id)}
        >
          {item.kind === 'loading' ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
              {item.message}
            </span>
          ) : (
            item.message
          )}
        </button>
      ))}
    </div>
  );
}
