/* Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later.
 * Independent Android host for the StreamGlass shell. No Stremio Web UI. */
package com.streamglass.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START = ORIGIN + "/assets/app/index.html";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private WebView web;
    private ExoPlayer player;
    private StreamPlayerView playerView;
    private int previousOrientation=ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    private int playbackOrientation=ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
    private int session;
    private boolean ending;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (player == null) return;
            emit("progress", false);
            handler.postDelayed(this, 1000);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8,8,8));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                if(playerView!=null){
                    view.setPadding(0,0,0,0);
                    android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.displayCutout());
                    playerView.setSafeInsets(safe.left,safe.top,safe.right,safe.bottom);
                }else{
                    android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                    view.setPadding(bars.left,bars.top,bars.right,bars.bottom);
                }
                return insets;
            });
        } else root.setFitsSystemWindows(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8,8,8));
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && "appassets.androidplatform.net".equals(url.getHost())
                        && "/assets/app/index.html".equals(url.getPath())) return false;
                if (request.isForMainFrame() && request.hasGesture() && StreamRules.direct(url.toString())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            new AlertDialog.Builder(this).setTitle("Update Android System WebView")
                    .setMessage("Update Android System WebView and Chrome, then reopen StreamGlass.")
                    .setPositiveButton("Close", (dialog, which) -> finish()).show();
            return;
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
        WebViewCompat.addWebMessageListener(web, "StreamGlassNative", Collections.singleton(ORIGIN),
                (view, message, sourceOrigin, isMainFrame, reply) -> {
                    if (!isMainFrame || !ORIGIN.equals(sourceOrigin.toString())) return;
                    String data = message.getData();
                    if (data == null || data.length() > 262144) return;
                    try {
                        JSONObject command = new JSONObject(data);
                        String action = command.optString("action");
                        if ("play".equals(action) && player == null) {
                            session = command.getInt("session");
                            openPlayer(command.getJSONObject("payload"));
                        } else if ("close".equals(action) && command.optInt("session") == session) closePlayer(false);
                        else if ("subtitles".equals(action) && command.optInt("session") == session && player != null) updateSubtitles(command.optJSONArray("payload"));
                    } catch (Exception ignored) {
                        if (player != null) closePlayer(false);
                        else sendClosed();
                        showError("The stream could not open. Try another direct stream.");
                    }
                });
        }
        web.loadUrl(START);
    }

    private void openPlayer(JSONObject payload) throws Exception {
        String url = payload.getString("url");
        if (!StreamRules.direct(url)) throw new IllegalArgumentException("Direct stream required");
        Uri mediaUri = Uri.parse(url);
        Map<String,String> headers = new HashMap<>();
        JSONObject supplied = payload.optJSONObject("headers");
        if (supplied != null) for (Iterator<String> it=supplied.keys(); it.hasNext();) {
            String name = it.next(), value = supplied.optString(name);
            if (name.matches("[A-Za-z0-9-]{1,64}") && !value.contains("\r") && !value.contains("\n")
                    && !name.matches("(?i)host|connection|content-length|transfer-encoding|cookie|authorization")) headers.put(name,value);
        }
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent("StreamGlass/0.6.0").setConnectTimeoutMs(15000).setReadTimeoutMs(20000);
        ResolvingDataSource.Factory scoped = new ResolvingDataSource.Factory(http, spec ->
                mediaUri.getAuthority().equals(spec.uri.getAuthority()) ? spec.withAdditionalHeaders(headers) : spec);
        player = new ExoPlayer.Builder(this,PlayerFactories.renderers(this)).setMediaSourceFactory(PlayerFactories.sources(new DefaultDataSource.Factory(this, scoped)))
                .setSeekBackIncrementMs(10000).setSeekForwardIncrementMs(10000).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),true);
        player.setHandleAudioBecomingNoisy(true);
        String audio = payload.optString("audioLanguage"), text = payload.optString("subtitleLanguage");
        player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon()
                .setPreferredAudioLanguage(audio.isEmpty()?null:audio)
                .setPreferredTextLanguage(text.isEmpty()?null:text)
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT,text.isEmpty()).build());
        List<MediaItem.SubtitleConfiguration> subtitles = new ArrayList<>();
        JSONArray choices = payload.optJSONArray("subtitles");
        if (choices != null) for (int i=0;i<Math.min(choices.length(),120);i++) {
            JSONObject choice = choices.optJSONObject(i); if (choice == null) continue;
            String link = choice.optString("url"); if (!StreamRules.direct(link)) continue;
            subtitles.add(new MediaItem.SubtitleConfiguration.Builder(Uri.parse(link))
                    .setMimeType(StreamRules.subtitleMime(link)).setLanguage(choice.optString("lang"))
                    .setLabel(choice.optString("label",choice.optString("lang","Subtitle"))).setId("external-"+i).build());
        }
        previousOrientation=getRequestedOrientation();
        playbackOrientation=ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        JSONObject subtitleStyle=payload.optJSONObject("subtitleStyle");
        playerView=new StreamPlayerView(this,player,payload.optString("title","StreamGlass"),payload.optString("subtitle"),subtitleStyle==null?100:subtitleStyle.optInt("size",100),new StreamPlayerView.Callbacks(){
            @Override public void close(){closePlayer(false);}
            @Override public void rotate(){
                playbackOrientation=getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE?ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT:ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
                setRequestedOrientation(playbackOrientation);
            }
            @Override public void lockOrientation(boolean locked){setRequestedOrientation(locked?ActivityInfo.SCREEN_ORIENTATION_LOCKED:playbackOrientation);}
        });
        root.addView(playerView,new FrameLayout.LayoutParams(-1,-1));
        web.setVisibility(View.INVISIBLE);setRequestedOrientation(playbackOrientation);setPlayerFullscreen(true);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ending=false;
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean playing) { updateKeepScreenOn();emit("progress",false); }
            @Override public void onPlaybackStateChanged(int state) { updateKeepScreenOn();if(state==Player.STATE_ENDED)closePlayer(true); }
            @Override public void onPlayerError(PlaybackException error) {
                updateKeepScreenOn();emit("progress",false); // Keep the title and position available for in-player retry.
            }
        });
        MediaItem item = new MediaItem.Builder().setUri(mediaUri).setSubtitleConfigurations(subtitles).build();
        player.setMediaItem(item, Math.max(0,payload.optLong("startMs")));
        player.prepare();player.play();handler.post(tick);
    }

    private void updateSubtitles(JSONArray choices) {
        if(player==null||choices==null)return;
        MediaItem current=player.getCurrentMediaItem();if(current==null||current.localConfiguration==null)return;
        List<MediaItem.SubtitleConfiguration> subs=new ArrayList<>(current.localConfiguration.subtitleConfigurations);
        boolean changed=false;
        for(int i=0;i<Math.min(choices.length(),120);i++){
            JSONObject choice=choices.optJSONObject(i);if(choice==null)continue;
            String url=choice.optString("url");if(!StreamRules.direct(url))continue;
            boolean exists=false;for(MediaItem.SubtitleConfiguration sub:subs)if(url.equals(sub.uri.toString())){exists=true;break;}
            if(exists)continue;
            subs.add(new MediaItem.SubtitleConfiguration.Builder(Uri.parse(url)).setMimeType(StreamRules.subtitleMime(url))
                    .setLanguage(choice.optString("lang")).setLabel(choice.optString("label",choice.optString("lang","Subtitle")))
                    .setId("external-"+subs.size()).build());changed=true;
        }
        if(changed)player.replaceMediaItem(0,current.buildUpon().setSubtitleConfigurations(subs).build());
    }
    private void send(JSONObject event) {
        if(web!=null)web.evaluateJavascript("window.StreamGlassAndroid&&window.StreamGlassAndroid.receive("+event+")",null);
    }
    private void emit(String action, boolean ended) {
        if(player==null)return;
        try {send(new JSONObject().put("action",action).put("session",session)
                .put("timeMs",Math.max(0,player.getCurrentPosition()))
                .put("durationMs",Math.max(0,player.getDuration()))
                .put("paused",!player.isPlaying()).put("ended",ended));}catch(Exception ignored){}
    }
    private void sendClosed() {
        try {send(new JSONObject().put("action","closed").put("session",session).put("timeMs",0).put("durationMs",0));}catch(Exception ignored){}
    }
    private void closePlayer(boolean ended) {
        if(player==null||ending)return;ending=true;
        handler.removeCallbacks(tick);emit("closed",ended);
        if(playerView!=null)playerView.dispose();player.release();player=null;
        if(playerView!=null)root.removeView(playerView);playerView=null;
        setRequestedOrientation(previousOrientation);setPlayerFullscreen(false);
        web.setVisibility(View.VISIBLE);getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    private void updateKeepScreenOn(){
        if(player!=null&&(player.isPlaying()||(player.getPlayWhenReady()&&player.getPlaybackState()==Player.STATE_BUFFERING)))getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    private void setPlayerFullscreen(boolean active){
        if(Build.VERSION.SDK_INT>=28){WindowManager.LayoutParams params=getWindow().getAttributes();params.layoutInDisplayCutoutMode=active?WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES:WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;getWindow().setAttributes(params);}
        if(Build.VERSION.SDK_INT>=30){
            WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null){controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);if(active)controller.hide(WindowInsets.Type.systemBars());else controller.show(WindowInsets.Type.systemBars());}
        }else{
            root.setFitsSystemWindows(!active);
            getWindow().getDecorView().setSystemUiVisibility(active?View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE:View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
        if(active)root.setPadding(0,0,0,0);root.requestApplyInsets();
    }
    @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused&&player!=null)setPlayerFullscreen(true);}
    private void showError(String message) { new AlertDialog.Builder(this).setTitle("Playback").setMessage(message).setPositiveButton("OK",null).show(); }
    @Override public void onBackPressed() {
        if(player!=null){if(playerView==null||!playerView.handleBack())closePlayer(false);return;}
        web.evaluateJavascript("window.StreamGlassAndroid?window.StreamGlassAndroid.back():false",value->{if(!"true".equals(value))finish();});
    }
    @Override protected void onStop() {
        if(player!=null){player.pause();emit("progress",false);}
        super.onStop();
    }
    @Override protected void onDestroy() {
        handler.removeCallbacks(tick);
        if(player!=null){if(playerView!=null)playerView.dispose();player.release();player=null;}
        if(web!=null){root.removeView(web);web.destroy();web=null;}
        super.onDestroy();
    }
}
