export function createAccountSession(initial: string | null) {
  let account = initial;
  let revision = 0;
  let controller = new AbortController();
  return {
    setAccount(next: string | null) {
      if (next === account) return;
      controller.abort(); account = next; revision += 1; controller = new AbortController();
    },
    capture() {
      const captured = revision;
      return { account, signal: controller.signal, valid: () => captured === revision,
        assert() { if (captured !== revision) throw new DOMException('Account changed', 'AbortError'); } };
    },
  };
}
