package com.streamglass.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class StreamRulesTest {
    @Test public void acceptsSignedDirectLinksWithoutRewriting() {
        assertTrue(StreamRules.direct("https://example.com/movie.mkv?token=abc%2F123&expires=12"));
        assertTrue(StreamRules.direct("http://192.168.68.5:8080/movie.mp4"));
    }
    @Test public void rejectsUnsafeAndNonStreamingSchemes() {
        for(String link:new String[]{"javascript:alert(1)","file:///sdcard/secret","content://private","magnet:?xt=123","https://user:password@example.com/a","not a link"})assertFalse(link,StreamRules.direct(link));
    }
    @Test public void detectsSubtitleFormatWithoutBeingConfusedByQueries() {
        assertEquals("text/vtt",StreamRules.subtitleMime("https://example.com/a.VTT?token=x"));
        assertEquals("text/x-ssa",StreamRules.subtitleMime("https://example.com/a.ass"));
        assertEquals("application/ttml+xml",StreamRules.subtitleMime("https://example.com/a.ttml"));
        assertEquals("application/x-subrip",StreamRules.subtitleMime("https://example.com/subtitle/123?format=srt"));
    }
}
