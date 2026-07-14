export interface AccessTokenPayload {
  sub: string;
  nickname: string;
  userId: string;
  type: string;
  exp?: number;
  iat?: number;
}

export function parseAccessTokenPayload(
  token: string,
): AccessTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      Array.from(atob(padded), (char) =>
        `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
      ).join(''),
    );

    const payload = JSON.parse(json) as AccessTokenPayload;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.nickname !== 'string'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
