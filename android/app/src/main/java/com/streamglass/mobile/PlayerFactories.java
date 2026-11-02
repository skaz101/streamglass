/* Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later. */
package com.streamglass.mobile;

import android.content.Context;
import android.os.Looper;
import androidx.media3.datasource.DataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.Renderer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.text.TextOutput;
import androidx.media3.exoplayer.text.TextRenderer;
import java.util.ArrayList;

/** Shared production/test configuration for the pinned Media3 runtime. */
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
@SuppressWarnings("deprecation")
final class PlayerFactories {
    private PlayerFactories() { }
    static DefaultRenderersFactory renderers(Context context) {
        return new DefaultRenderersFactory(context) {
            @Override protected void buildTextRenderers(Context context,TextOutput output,Looper looper,int extensionMode,ArrayList<Renderer> renderers) {
                TextRenderer text=new TextRenderer(output,looper);
                text.experimentalSetLegacyDecodingEnabled(true);
                renderers.add(text);
            }
        }.setEnableDecoderFallback(true);
    }
    static DefaultMediaSourceFactory sources(DataSource.Factory data) {
        // Media3 1.5.1's extraction path loses an already-started external cue
        // when enabled after seeking. Keep source and text renderer in matching
        // legacy mode until upgrading the runtime; the native test covers this.
        return new DefaultMediaSourceFactory(data).experimentalParseSubtitlesDuringExtraction(false);
    }
}
