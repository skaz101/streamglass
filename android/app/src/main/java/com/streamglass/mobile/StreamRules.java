/* Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later. */
package com.streamglass.mobile;

import java.net.URI;
import java.util.Locale;

public final class StreamRules {
    private StreamRules() {}
    public static boolean direct(String value) {
        try {
            URI uri = new URI(value);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (Exception ignored) { return false; }
    }
    public static String subtitleMime(String url) {
        try {
            String path = new URI(url).getPath().toLowerCase(Locale.ROOT);
            if (path.endsWith(".vtt")) return "text/vtt";
            if (path.endsWith(".ttml") || path.endsWith(".xml")) return "application/ttml+xml";
            if (path.endsWith(".ass") || path.endsWith(".ssa")) return "text/x-ssa";
        } catch (Exception ignored) { }
        return "application/x-subrip";
    }
}
