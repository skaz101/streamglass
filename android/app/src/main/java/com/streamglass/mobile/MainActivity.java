/* Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later.
 * Independent Android host for the StreamGlass shell. No Stremio Web UI. */
package com.streamglass.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.Tracks;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;
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
import java.util.Locale;
import java.util.Map;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START = ORIGIN + "/assets/app/index.html";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout root, playerLayer;
    private WebView web;
    private ExoPlayer player;
    private PlayerView playerView;
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
        root.setBackgroundColor(Color.rgb(11,12,16));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        } else root.setFitsSystemWindows(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11,12,16));
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

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private Button button(String label, Runnable action) {
        Button button = new Button(this); button.setText(label); button.setTextColor(Color.WHITE);
        button.setTextSize(12); button.setMinWidth(0); button.setMinimumWidth(0);
        button.setOnClickListener(view -> action.run()); return button;
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
                .setUserAgent("StreamGlass/0.4.0").setConnectTimeoutMs(15000).setReadTimeoutMs(20000);
        ResolvingDataSource.Factory scoped = new ResolvingDataSource.Factory(http, spec ->
                mediaUri.getAuthority().equals(spec.uri.getAuthority()) ? spec.withAdditionalHeaders(headers) : spec);
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, scoped)))
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
        playerLayer = new FrameLayout(this); playerLayer.setBackgroundColor(Color.BLACK);
        playerView = new PlayerView(this); playerView.setPlayer(player);
        playerView.setShowSubtitleButton(true); playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING);
        playerLayer.addView(playerView, new FrameLayout.LayoutParams(-1,-1));
        LinearLayout bar = new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(4),0,dp(4),0);bar.setBackgroundColor(0x99000000);
        bar.addView(button("Back",()->closePlayer(false)),new LinearLayout.LayoutParams(-2,dp(48)));
        TextView title = new TextView(this);title.setText(payload.optString("title","StreamGlass"));title.setTextColor(Color.WHITE);title.setTextSize(14);title.setMaxLines(2);
        bar.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        bar.addView(button("Audio",()->chooseTrack(C.TRACK_TYPE_AUDIO)),new LinearLayout.LayoutParams(-2,dp(48)));
        bar.addView(button("Subs",()->chooseTrack(C.TRACK_TYPE_TEXT)),new LinearLayout.LayoutParams(-2,dp(48)));
        playerLayer.addView(bar,new FrameLayout.LayoutParams(-1,dp(56),Gravity.TOP));
        playerView.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener)visibility -> bar.setVisibility(visibility));
        root.addView(playerLayer,new FrameLayout.LayoutParams(-1,-1));
        web.setVisibility(View.INVISIBLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ending=false;
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean playing) { emit("progress",false); }
            @Override public void onPlaybackStateChanged(int state) { if(state==Player.STATE_ENDED)closePlayer(true); }
            @Override public void onPlayerError(PlaybackException error) {
                closePlayer(false);
                showError("This stream could not play (code "+error.errorCode+"). Try another link or format.");
            }
        });
        MediaItem item = new MediaItem.Builder().setUri(mediaUri).setSubtitleConfigurations(subtitles).build();
        player.setMediaItem(item, Math.max(0,payload.optLong("startMs")));
        player.prepare();player.play();handler.post(tick);
    }

    private void chooseTrack(int type) {
        if (player == null) return;
        List<String> names = new ArrayList<>();List<TrackSelectionOverride> options = new ArrayList<>();
        names.add(type==C.TRACK_TYPE_TEXT?"Off":"Automatic");options.add(null);
        int checked=0;
        for (Tracks.Group group : player.getCurrentTracks().getGroups()) {
            if(group.getType()!=type)continue;
            for(int i=0;i<group.length;i++)if(group.isTrackSupported(i)){
                Format format=group.getTrackFormat(i);
                String language=format.language==null?"Unknown language":Locale.forLanguageTag(format.language).getDisplayLanguage();
                String label=format.label!=null?format.label:language;
                if(type==C.TRACK_TYPE_AUDIO&&format.channelCount>0)label+=" · "+format.channelCount+" channels";
                names.add(label);options.add(new TrackSelectionOverride(group.getMediaTrackGroup(),i));
                if(group.isTrackSelected(i))checked=names.size()-1;
            }
        }
        new AlertDialog.Builder(this).setTitle(type==C.TRACK_TYPE_TEXT?"Subtitles":"Audio")
                .setSingleChoiceItems(names.toArray(new String[0]),checked,(dialog,which)->{
                    if(player!=null){
                        TrackSelectionParameters.Builder parameters=player.getTrackSelectionParameters().buildUpon().clearOverridesOfType(type)
                                .setTrackTypeDisabled(type,type==C.TRACK_TYPE_TEXT&&which==0);
                        if(options.get(which)!=null)parameters.addOverride(options.get(which));
                        player.setTrackSelectionParameters(parameters.build());
                    }dialog.dismiss();
                }).setNegativeButton("Cancel",null).show();
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
        playerView.setPlayer(null);player.release();player=null;
        root.removeView(playerLayer);playerLayer=null;playerView=null;
        web.setVisibility(View.VISIBLE);getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    private void showError(String message) { new AlertDialog.Builder(this).setTitle("Playback").setMessage(message).setPositiveButton("OK",null).show(); }
    @Override public void onBackPressed() {
        if(player!=null){closePlayer(false);return;}
        web.evaluateJavascript("window.StreamGlassAndroid?window.StreamGlassAndroid.back():false",value->{if(!"true".equals(value))finish();});
    }
    @Override protected void onStop() {
        if(player!=null){player.pause();emit("progress",false);}
        super.onStop();
    }
    @Override protected void onDestroy() {
        handler.removeCallbacks(tick);
        if(player!=null){playerView.setPlayer(null);player.release();player=null;}
        if(web!=null){root.removeView(web);web.destroy();web=null;}
        super.onDestroy();
    }
}
