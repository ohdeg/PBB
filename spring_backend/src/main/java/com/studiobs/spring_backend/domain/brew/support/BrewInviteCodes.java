package com.studiobs.spring_backend.domain.brew.support;

import java.security.SecureRandom;

public final class BrewInviteCodes {

    private static final char[] ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private BrewInviteCodes() {
    }

    public static String generate() {
        char[] chars = new char[LENGTH];
        for (int i = 0; i < LENGTH; i += 1) {
            chars[i] = ALPHABET[RANDOM.nextInt(ALPHABET.length)];
        }
        return new String(chars);
    }

    /** 검색어가 초대 코드 형식인지 (정확히 8자 영숫자) */
    public static boolean looksLikeCode(String raw) {
        if (raw == null) {
            return false;
        }
        String q = raw.trim();
        if (q.length() != LENGTH) {
            return false;
        }
        for (int i = 0; i < q.length(); i += 1) {
            if (!Character.isLetterOrDigit(q.charAt(i))) {
                return false;
            }
        }
        return true;
    }
}
