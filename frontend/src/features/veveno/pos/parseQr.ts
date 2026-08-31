const PREFIX = 'pbb-pos:v1:';
const PAYLOAD =
  /^pbb-pos:v1:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}):([a-fA-F0-9]{16,64})$/;

export interface PosQrPayload {
  pairId: string;
  secret: string;
}

export function parsePosQr(raw: string): PosQrPayload | null {
  const trimmed = raw.trim();
  const match = PAYLOAD.exec(trimmed);
  if (!match) {
    return null;
  }
  return { pairId: match[1], secret: match[2] };
}

export function isPosQrPrefix(raw: string): boolean {
  return raw.trim().startsWith(PREFIX);
}
