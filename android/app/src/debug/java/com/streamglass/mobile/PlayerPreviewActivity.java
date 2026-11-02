/* Isolated native-player fixture host. Excluded from release builds. GPL-3.0-or-later. */
package com.streamglass.mobile;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.View;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.exoplayer.ExoPlayer;
import java.util.Arrays;

@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public class PlayerPreviewActivity extends Activity {
    public ExoPlayer player;
    public StreamPlayerView controls;
    private int orientation=ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
    public static MediaItem fixture(){
        return new MediaItem.Builder().setUri("asset:///player-fixture.mp4").setSubtitleConfigurations(Arrays.asList(
            new MediaItem.SubtitleConfiguration.Builder(android.net.Uri.parse("asset:///player-english.vtt")).setMimeType(MimeTypes.TEXT_VTT).setLanguage("en").setLabel("English").build(),
            new MediaItem.SubtitleConfiguration.Builder(android.net.Uri.parse("asset:///player-spanish.vtt")).setMimeType(MimeTypes.TEXT_VTT).setLanguage("es").setLabel("Español").build())).build();
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);setRequestedOrientation(orientation);
        getSharedPreferences("streamglass-player",MODE_PRIVATE).edit().clear().commit();
        player=new ExoPlayer.Builder(this).setSeekBackIncrementMs(10000).setSeekForwardIncrementMs(10000).build();
        player.addAnalyticsListener(new androidx.media3.exoplayer.util.EventLogger("StreamGlassPlayback"));
        player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT,true).build());
        controls=new StreamPlayerView(this,player,"The Last Horizon","S1 E2 · Beyond the signal",100,new StreamPlayerView.Callbacks(){
            public void close(){finish();}
            public void rotate(){orientation=getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE?ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT:ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;setRequestedOrientation(orientation);}
            public void lockOrientation(boolean locked){setRequestedOrientation(locked?ActivityInfo.SCREEN_ORIENTATION_LOCKED:orientation);}
        });setContentView(controls);
        if(Build.VERSION.SDK_INT>=30){getWindow().setDecorFitsSystemWindows(false);controls.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.displayCutout());controls.setSafeInsets(safe.left,safe.top,safe.right,safe.bottom);return insets;});}
        player.setMediaItem(fixture());player.prepare();player.play();
    }
    @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused){if(Build.VERSION.SDK_INT>=30){getWindow().getInsetsController().setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());}else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}}
    @Override public void onBackPressed(){if(!controls.handleBack())finish();}
    @Override protected void onStop(){player.pause();super.onStop();}
    @Override protected void onDestroy(){controls.dispose();player.release();super.onDestroy();}
}
