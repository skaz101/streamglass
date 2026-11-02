package com.streamglass.mobile;

import android.content.Intent;
import android.animation.ValueAnimator;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;
import androidx.lifecycle.Lifecycle;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import android.util.Base64;
import android.util.Log;
import java.util.function.BooleanSupplier;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public class NativePlayerTest {
    private PlayerPreviewActivity activity;
    private void main(Runnable run){InstrumentationRegistry.getInstrumentation().runOnMainSync(run);}
    private void waitFor(String message,BooleanSupplier condition) throws Exception {
        long end=SystemClock.uptimeMillis()+20000;boolean[] ok={false};
        while(SystemClock.uptimeMillis()<end){main(()->ok[0]=condition.getAsBoolean());if(ok[0])return;Thread.sleep(100);}
        main(()->Log.i("StreamGlassPreview","NODE failure state="+activity.player.getPlaybackState()+" play="+activity.player.getPlayWhenReady()+" position="+activity.player.getCurrentPosition()+" error="+activity.player.getPlayerError()));fail(message);
    }
    private View tagged(String tag){return activity.controls.findViewWithTag(tag);}
    private void click(String tag){main(()->{View v=tagged(tag);assertNotNull(tag,v);assertTrue(tag,v.isShown());assertTrue(tag,v.performClick());});}
    private void touch(float x,float y,int action,long down){
        MotionEvent event=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,x,y,0);
        InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(event,true);event.recycle();
    }
    private void screenshot(String name) throws Exception {
        Thread.sleep(900);Bitmap bitmap=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();assertNotNull(bitmap);
        File folder=new File(activity.getExternalFilesDir(null),"native-player-tests");assertTrue(folder.isDirectory()||folder.mkdirs());
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();assertTrue(bitmap.compress(Bitmap.CompressFormat.WEBP,90,bytes));bitmap.recycle();
        try(FileOutputStream stream=new FileOutputStream(new File(folder,name+".webp"))){stream.write(bytes.toByteArray());}
        // Small paced chunks survive Gradle uninstalling the test app and log rate limits.
        String encoded=Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP);
        for(int i=0;i<encoded.length();i+=3000){Log.i("StreamGlassPreview","NATIVE_IMAGE:"+name+":"+(i/3000)+":"+encoded.substring(i,Math.min(i+3000,encoded.length())));Thread.sleep(10);}
        dumpNode(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow(),0);
    }
    private void dumpNode(android.view.accessibility.AccessibilityNodeInfo node,int depth){
        if(node==null){Log.i("StreamGlassPreview","NODE null");return;}
        Log.i("StreamGlassPreview","NODE "+depth+" "+node.getClassName()+" text="+node.getText()+" label="+node.getContentDescription()+" visible="+node.isVisibleToUser());
        for(int i=0;i<node.getChildCount();i++)dumpNode(node.getChild(i),depth+1);
    }

    @Test public void nativePlaybackControlsAndRecovery() throws Exception {
        Intent intent=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),PlayerPreviewActivity.class);
        try(ActivityScenario<PlayerPreviewActivity> scenario=ActivityScenario.launch(intent)){
            scenario.onActivity(a->activity=a);
            waitFor("Real H.264/AAC fixture must decode",()->activity.player.getPlaybackState()==Player.STATE_READY&&activity.player.isPlaying()&&activity.player.getCurrentPosition()>500);
            waitFor("Player opens in landscape",()->activity.getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE);
            click("player-play");waitFor("Pause",()->!activity.player.getPlayWhenReady());
            main(()->{assertTrue("Native motion is enabled for this test",ValueAnimator.areAnimatorsEnabled());activity.controls.setSafeInsets(38,24,30,18);});
            waitFor("Dimming covers the entire video with nonzero cutout insets",this::scrimCoversPlayer);
            main(()->assertEquals(38,tagged("player-safe-controls").getPaddingLeft()));
            boolean[] sawFade={false};
            main(()->{
                View controls=tagged("player-controls");
                controls.getViewTreeObserver().addOnPreDrawListener(new android.view.ViewTreeObserver.OnPreDrawListener(){
                    @Override public boolean onPreDraw(){
                        if(controls.getAlpha()>0&&controls.getAlpha()<1){sawFade[0]=true;controls.getViewTreeObserver().removeOnPreDrawListener(this);activity.controls.setControlsVisible(true);}return true;
                    }
                });
                activity.controls.setControlsVisible(false);
            });
            waitFor("Controls fade through intermediate opacity",()->sawFade[0]);
            waitFor("Reversing a fade leaves controls fully visible",()->tagged("player-controls").isShown()&&tagged("player-controls").getAlpha()==1f);
            main(()->activity.controls.requestApplyInsets());
            main(()->activity.player.seekTo(30000));waitFor("Initial seek",()->activity.player.getCurrentPosition()>=29900);
            click("player-forward");waitFor("10-second forward",()->activity.player.getCurrentPosition()>=39900);
            click("player-rewind");waitFor("10-second rewind",()->activity.player.getCurrentPosition()<31000);
            waitFor("Seek finishes while paused",()->activity.player.getPlaybackState()==Player.STATE_READY&&!activity.player.getPlayWhenReady());
            screenshot("native-landscape");
            main(()->activity.controls.setControlsVisible(false));waitFor("Controls finish fading out",()->tagged("player-controls").getVisibility()==View.GONE);int[] location=new int[2];int[] size=new int[2];
            main(()->{activity.controls.getLocationOnScreen(location);size[0]=activity.controls.getWidth();size[1]=activity.controls.getHeight();});
            float x=location[0]+size[0]*.8f,y=location[1]+size[1]*.5f;long down=SystemClock.uptimeMillis();touch(x,y,MotionEvent.ACTION_DOWN,down);touch(x,y,MotionEvent.ACTION_UP,down);Thread.sleep(90);down=SystemClock.uptimeMillis();touch(x,y,MotionEvent.ACTION_DOWN,down);touch(x,y,MotionEvent.ACTION_UP,down);
            waitFor("Double tap seeks ten seconds",()->activity.player.getCurrentPosition()>=39900);
            main(()->activity.controls.setControlsVisible(true));
            main(()->{View bar=tagged("player-timeline");bar.getLocationOnScreen(location);size[0]=bar.getWidth();size[1]=bar.getHeight();});
            down=SystemClock.uptimeMillis();x=location[0]+size[0]*.5f;y=location[1]+size[1]*.5f;touch(x,y,MotionEvent.ACTION_DOWN,down);touch(x,y,MotionEvent.ACTION_UP,down);
            waitFor("Timeline scrubs and preserves paused state",()->activity.player.getCurrentPosition()>50000&&activity.player.getCurrentPosition()<70000&&!activity.player.getPlayWhenReady());
            click("player-speed");screenshot("native-speed");
            // Dialog controls use real window roots, found through UI automation below.
            android.app.UiAutomation automation=InstrumentationRegistry.getInstrumentation().getUiAutomation();
            android.view.accessibility.AccessibilityNodeInfo node=findNode(automation.getRootInActiveWindow(),"1.5×");assertNotNull("Speed option",node);assertTrue(node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));
            waitFor("Speed applied",()->Math.abs(activity.player.getPlaybackParameters().speed-1.5f)<.001f);
            click("player-tracks");screenshot("native-tracks");
            node=findNode(automation.getRootInActiveWindow(),"French · Stereo");assertNotNull("Second audio track offered",node);assertTrue(node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));
            waitFor("Audio selection applied",()->activity.player.getTrackSelectionParameters().overrides.values().stream().anyMatch(o->o.getType()==C.TRACK_TYPE_AUDIO));
            node=findNode(automation.getRootInActiveWindow(),"English");assertNotNull("External English captions offered",node);assertTrue(node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));
            waitFor("Subtitles enabled",()->!activity.player.getTrackSelectionParameters().disabledTrackTypes.contains(C.TRACK_TYPE_TEXT));
            main(()->{assertFalse("Selecting captions keeps playback paused",activity.player.getPlayWhenReady());activity.player.play();});
            waitFor("Caption cues render during playback",()->activity.player.isPlaying()&&!activity.player.getCurrentCues().cues.isEmpty());
            main(()->activity.player.pause());
            node=findNode(automation.getRootInActiveWindow(),"Off");assertNotNull(node);assertTrue(node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));
            waitFor("Subtitles can be turned off",()->activity.player.getTrackSelectionParameters().disabledTrackTypes.contains(C.TRACK_TYPE_TEXT)&&activity.player.getCurrentCues().cues.isEmpty());
            node=findNode(automation.getRootInActiveWindow(),"English");assertNotNull(node);assertTrue(node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));
            main(()->activity.player.play());waitFor("Captions render again after re-enabling",()->!activity.player.getCurrentCues().cues.isEmpty());main(()->activity.player.pause());
            main(()->assertTrue(activity.controls.handleBack()));
            waitFor("Captions clear the timeline",()->above("player-subtitles","player-timeline"));
            screenshot("native-captions");
            click("player-fit");main(()->assertEquals("Fit whole video",tagged("player-fit").getContentDescription()));waitFor("Scrim covers fill mode",this::scrimCoversPlayer);screenshot("native-fill");click("player-fit");
            click("player-lock");waitFor("Lock fades controls away",()->tagged("player-controls").getVisibility()==View.GONE);waitFor("Captions clear Unlock",()->above("player-subtitles","player-unlock"));screenshot("native-locked");main(()->assertTrue(activity.controls.handleBack()));main(()->assertEquals(View.VISIBLE,tagged("player-controls").getVisibility()));
            click("player-rotate");waitFor("Portrait rotation retains playback",()->activity.getResources().getConfiguration().orientation==Configuration.ORIENTATION_PORTRAIT&&activity.player.getCurrentPosition()>50000);waitFor("Scrim covers portrait",this::scrimCoversPlayer);screenshot("native-portrait");
            click("player-brightness");screenshot("native-brightness");main(()->assertTrue(activity.controls.handleBack()));
            click("player-play");waitFor("Resume",()->activity.player.isPlaying());Thread.sleep(4500);main(()->assertEquals("Controls auto-hide while playing",View.GONE,tagged("player-controls").getVisibility()));
            scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);waitFor("Backgrounding leaves playback paused",()->!activity.player.getPlayWhenReady());
            main(()->{activity.player.setMediaItem(new MediaItem.Builder().setUri("asset:///missing-video.mp4").build());activity.player.prepare();activity.player.play();});
            waitFor("A failed stream stays in the player",()->activity.player.getPlayerError()!=null&&tagged("player-error").isShown());screenshot("native-error");
            click("player-retry");waitFor("A failed retry preserves recovery controls",()->activity.player.getPlayerError()!=null&&tagged("player-error").isShown());
            main(()->{View retry=tagged("player-retry");activity.player.setMediaItem(PlayerPreviewActivity.fixture(),45000);retry.performClick();});waitFor("Recovery resumes a playable source",()->activity.player.getPlaybackState()==Player.STATE_READY&&activity.player.getCurrentPosition()>=45000);
            main(()->{assertFalse(activity.isFinishing());activity.player.pause();});
            try {
                shell("settings put global animator_duration_scale 0");waitFor("System reduced motion applied",()->!ValueAnimator.areAnimatorsEnabled());
                main(()->{activity.controls.setControlsVisible(false);assertEquals(View.GONE,tagged("player-controls").getVisibility());activity.controls.setControlsVisible(true);assertEquals(1f,tagged("player-controls").getAlpha(),0f);assertTrue(tagged("player-controls").isShown());});
            } finally {shell("settings put global animator_duration_scale 1");}
        }
    }
    private boolean scrimCoversPlayer(){
        View scrim=tagged("player-scrim"),player=activity.controls;int[] a=new int[2],b=new int[2];scrim.getLocationOnScreen(a);player.getLocationOnScreen(b);
        return !tagged("player-safe-controls").isLayoutRequested()&&a[0]==b[0]&&a[1]==b[1]&&scrim.getWidth()==player.getWidth()&&scrim.getHeight()==player.getHeight();
    }
    private void shell(String command) throws Exception {
        try(android.os.ParcelFileDescriptor.AutoCloseInputStream stream=new android.os.ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))){while(stream.read()!=-1){}}
    }
    private boolean above(String upperTag,String lowerTag){
        View upper=tagged(upperTag),lower=tagged(lowerTag);int[] a=new int[2],b=new int[2];upper.getLocationOnScreen(a);lower.getLocationOnScreen(b);return a[1]+upper.getHeight()<=b[1];
    }
    private android.view.accessibility.AccessibilityNodeInfo findNode(android.view.accessibility.AccessibilityNodeInfo root,String prefix){
        if(root==null)return null;CharSequence label=root.getContentDescription();if(label!=null&&(label.toString().equals(prefix)||label.toString().equals(prefix+", selected")))return root;
        for(int i=0;i<root.getChildCount();i++){android.view.accessibility.AccessibilityNodeInfo result=findNode(root.getChild(i),prefix);if(result!=null)return result;}return null;
    }
}
