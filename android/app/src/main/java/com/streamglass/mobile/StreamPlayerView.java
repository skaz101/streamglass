/* Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later. */
package com.streamglass.mobile;

import android.annotation.SuppressLint;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityManager;
import android.view.animation.PathInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.Tracks;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.DefaultTimeBar;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;
import androidx.media3.ui.TimeBar;
import java.util.Locale;

/** Native controls around Media3's video/subtitle surface, independent of the WebView. */
@SuppressLint({"SetTextI18n","ClickableViewAccessibility"})
@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public final class StreamPlayerView extends FrameLayout {
    public interface Callbacks {
        void close();
        void rotate();
        void lockOrientation(boolean locked);
    }
    private static final int ACCENT=0xffef233c, MUTED=0xffbbbbbb;
    private final Activity activity;
    private final Player player;
    private final Callbacks callbacks;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final SharedPreferences preferences;
    private final PlayerView surface;
    private final FrameLayout overlay, chrome;
    private final LinearLayout center, bottom, loading, errorPanel;
    private ImageButton play, rewind, forward, fit;
    private final DefaultTimeBar timeBar;
    private TextView elapsed, remaining, speedText, feedback, errorText;
    private Button unlock;
    private final float originalBrightness;
    private final float captionScale;
    private Dialog dialog;
    private int sheetHeight=430;
    private LinearLayout trackColumns;
    private boolean visible=true, locked, scrubbing, resumeAfterScrub, zoomed, disposed;
    private final Runnable hide=()->setControlsVisible(false);
    private final Runnable hideUnlock=()->{if(locked)fade(unlock,false);};
    private final Runnable hideFeedback=()->fade(feedback,false);
    private final Runnable update=new Runnable(){
        @Override public void run(){if(disposed)return;refresh();handler.postDelayed(this,visible?500:1000);}
    };
    private final Player.Listener listener=new Player.Listener(){
        @Override public void onEvents(Player p,Player.Events events){
            refresh();
            if(events.contains(Player.EVENT_TRACKS_CHANGED)&&dialog!=null&&trackColumns!=null)populateTracks();
            if(events.contains(Player.EVENT_IS_PLAYING_CHANGED)||events.contains(Player.EVENT_PLAYBACK_STATE_CHANGED)){
                if(!p.isPlaying()&&!locked)setControlsVisible(true);
                scheduleHide();
            }
        }
    };

    public StreamPlayerView(Activity activity,Player player,String title,String subtitle,int subtitleSize,Callbacks callbacks){
        super(activity);this.activity=activity;this.player=player;this.callbacks=callbacks;
        preferences=activity.getSharedPreferences("streamglass-player",Context.MODE_PRIVATE);
        originalBrightness=activity.getWindow().getAttributes().screenBrightness;
        captionScale=Math.max(75,Math.min(200,subtitleSize))/100f;
        setBackgroundColor(Color.BLACK);setTag("native-player");
        if(android.os.Build.VERSION.SDK_INT>=28)setOnApplyWindowInsetsListener((v,insets)->{android.view.DisplayCutout cutout=insets.getDisplayCutout();if(cutout!=null)setSafeInsets(cutout.getSafeInsetLeft(),cutout.getSafeInsetTop(),cutout.getSafeInsetRight(),cutout.getSafeInsetBottom());else setSafeInsets(0,0,0,0);return insets;});
        surface=new PlayerView(activity);surface.setUseController(false);surface.setPlayer(player);
        surface.setKeepContentOnPlayerReset(true);surface.setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER);
        addView(surface,new LayoutParams(-1,-1));
        SubtitleView subtitles=surface.getSubtitleView();
        if(subtitles!=null){subtitles.setTag("player-subtitles");subtitles.setUserDefaultStyle();((View)subtitles.getParent()).addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->post(this::updateSubtitlePadding));}
        View gestures=new View(activity);gestures.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        GestureDetector detector=new GestureDetector(activity,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent event){return true;}
            @Override public boolean onSingleTapConfirmed(MotionEvent event){if(locked)showUnlock();else setControlsVisible(!visible);return true;}
            @Override public boolean onDoubleTap(MotionEvent event){if(locked){showUnlock();return true;}seek(event.getX()<getWidth()/2f?-10000:10000);return true;}
        });
        gestures.setOnTouchListener((view,event)->detector.onTouchEvent(event));
        addView(gestures,new LayoutParams(-1,-1));
        overlay=new FrameLayout(activity){
            @Override public boolean onInterceptTouchEvent(MotionEvent event){return !visible||locked||super.onInterceptTouchEvent(event);}
            @Override public boolean onTouchEvent(MotionEvent event){return !visible||locked||super.onTouchEvent(event);}
        };
        overlay.setTag("player-controls");addView(overlay,new LayoutParams(-1,-1));
        // The video and scrim are edge to edge. Only interactive controls receive
        // cutout insets; padding their parent would leave the movie edges undimmed.
        View shade=new View(activity);shade.setTag("player-scrim");shade.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0xd9000000,0x40000000,0x40000000,0xe6000000}));
        overlay.addView(shade,new LayoutParams(-1,-1));
        chrome=new FrameLayout(activity);chrome.setTag("player-safe-controls");overlay.addView(chrome,new LayoutParams(-1,-1));
        LinearLayout top=new LinearLayout(activity);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(8),dp(4),dp(8),dp(4));
        top.addView(icon(R.drawable.ic_player_back,"Back to title","player-back",callbacks::close),new LinearLayout.LayoutParams(dp(48),dp(48)));
        LinearLayout titles=column();titles.setPadding(dp(10),0,dp(6),0);
        TextView heading=text(title,17,Color.WHITE);heading.setTypeface(null,Typeface.BOLD);heading.setMaxLines(1);heading.setEllipsize(TextUtils.TruncateAt.END);
        titles.addView(heading);if(!subtitle.isEmpty()){TextView episode=text(subtitle,12,MUTED);episode.setMaxLines(1);episode.setEllipsize(TextUtils.TruncateAt.END);titles.addView(episode);}
        top.addView(titles,new LinearLayout.LayoutParams(0,-2,1));
        fit=icon(R.drawable.ic_player_fit,"Fill screen","player-fit",()->{
            zoomed=!zoomed;surface.setResizeMode(zoomed?AspectRatioFrameLayout.RESIZE_MODE_ZOOM:AspectRatioFrameLayout.RESIZE_MODE_FIT);
            fit.setImageResource(zoomed?R.drawable.ic_player_zoom:R.drawable.ic_player_fit);fit.setContentDescription(zoomed?"Fit whole video":"Fill screen");
            announce(zoomed?"Fill screen — edges cropped":"Fit whole video");scheduleHide();
        });
        top.addView(fit,new LinearLayout.LayoutParams(dp(48),dp(48)));
        top.addView(icon(R.drawable.ic_player_rotate,"Rotate screen","player-rotate",()->{callbacks.rotate();scheduleHide();}),new LinearLayout.LayoutParams(dp(48),dp(48)));
        chrome.addView(top,new LayoutParams(-1,dp(60),Gravity.TOP));
        center=column();center.setGravity(Gravity.CENTER);
        LinearLayout transport=new LinearLayout(activity);transport.setGravity(Gravity.CENTER);
        rewind=icon(R.drawable.ic_player_rewind,"Rewind 10 seconds","player-rewind",()->seek(-10000));
        forward=icon(R.drawable.ic_player_forward,"Forward 10 seconds","player-forward",()->seek(10000));
        play=icon(R.drawable.ic_player_pause,"Pause","player-play",()->{
            if(player.getPlayWhenReady())player.pause();else{if(player.getPlaybackState()==Player.STATE_ENDED)player.seekTo(0);player.play();}setControlsVisible(true);
        });
        play.setPadding(dp(17),dp(17),dp(17),dp(17));play.setBackground(ripple(0x18000000,50));
        transport.addView(rewind,new LinearLayout.LayoutParams(dp(64),dp(64)));transport.addView(space(28));
        transport.addView(play,new LinearLayout.LayoutParams(dp(84),dp(84)));transport.addView(space(28));transport.addView(forward,new LinearLayout.LayoutParams(dp(64),dp(64)));
        center.addView(transport,new LinearLayout.LayoutParams(-1,dp(88)));
        loading=new LinearLayout(activity);loading.setGravity(Gravity.CENTER);ProgressBar spinner=new ProgressBar(activity);spinner.setIndeterminateTintList(ColorStateList.valueOf(Color.WHITE));
        loading.addView(spinner,new LinearLayout.LayoutParams(dp(16),dp(16)));TextView loadingText=text("Loading…",12,MUTED);loadingText.setPadding(dp(8),0,0,0);loading.addView(loadingText);
        center.addView(loading,new LinearLayout.LayoutParams(-1,dp(24)));LayoutParams middle=new LayoutParams(-1,-1);middle.topMargin=dp(60);middle.bottomMargin=dp(136);chrome.addView(center,middle);
        bottom=column();bottom.setPadding(dp(24),dp(4),dp(24),dp(10));
        timeBar=new DefaultTimeBar(activity);timeBar.setTag("player-timeline");timeBar.setContentDescription("Playback position");timeBar.setPlayedColor(ACCENT);timeBar.setScrubberColor(ACCENT);timeBar.setBufferedColor(0xff8c8c8c);timeBar.setUnplayedColor(0xff484848);timeBar.setKeyTimeIncrement(10000);
        timeBar.addListener(new TimeBar.OnScrubListener(){
            @Override public void onScrubStart(TimeBar bar,long position){scrubbing=true;resumeAfterScrub=player.getPlayWhenReady();player.pause();handler.removeCallbacks(hide);showTime(position);}
            @Override public void onScrubMove(TimeBar bar,long position){showTime(position);}
            @Override public void onScrubStop(TimeBar bar,long position,boolean canceled){if(!canceled&&canSeek())player.seekTo(PlayerUiMath.seekPosition(position,player.getDuration(),0));scrubbing=false;if(resumeAfterScrub)player.play();refresh();scheduleHide();}
        });
        bottom.addView(timeBar,new LinearLayout.LayoutParams(-1,dp(40)));
        LinearLayout times=new LinearLayout(activity);elapsed=text("0:00",12,Color.WHITE);remaining=text("--:--",12,MUTED);remaining.setGravity(Gravity.END);
        times.addView(elapsed,new LinearLayout.LayoutParams(0,dp(22),1));times.addView(remaining,new LinearLayout.LayoutParams(0,dp(22),1));bottom.addView(times);
        LinearLayout tools=new LinearLayout(activity);speedText=action(tools,R.drawable.ic_player_speed,"Speed (1×)","player-speed",this::chooseSpeed);
        action(tools,R.drawable.ic_player_captions,"Audio & subs","player-tracks",this::chooseTracks);
        action(tools,R.drawable.ic_player_lock,"Lock","player-lock",()->setLocked(true));
        action(tools,R.drawable.ic_player_brightness,"Brightness","player-brightness",this::chooseBrightness);
        bottom.addView(tools,new LinearLayout.LayoutParams(-1,dp(56)));chrome.addView(bottom,new LayoutParams(-1,-2,Gravity.BOTTOM));
        feedback=text("",18,Color.WHITE);feedback.setGravity(Gravity.CENTER);feedback.setPadding(dp(18),dp(12),dp(18),dp(12));feedback.setBackground(round(0xcc202020,28));feedback.setVisibility(GONE);feedback.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        LayoutParams feedbackParams=new LayoutParams(-2,-2,Gravity.CENTER);addView(feedback,feedbackParams);
        unlock=plainButton("Screen locked · Tap to unlock",()->setLocked(false));unlock.setTag("player-unlock");unlock.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_player_unlock,0,0,0);unlock.setCompoundDrawablePadding(dp(10));unlock.setVisibility(GONE);
        LayoutParams unlockParams=new LayoutParams(-2,dp(56),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);unlockParams.bottomMargin=dp(24);addView(unlock,unlockParams);
        errorPanel=column();errorPanel.setGravity(Gravity.CENTER);errorPanel.setPadding(dp(24),dp(16),dp(24),dp(16));errorPanel.setBackground(round(0xf2202020,14));errorPanel.setTag("player-error");
        TextView errorTitle=text("Playback interrupted",22,Color.WHITE);errorTitle.setTypeface(null,Typeface.BOLD);errorPanel.addView(errorTitle);errorText=text("",14,MUTED);errorText.setGravity(Gravity.CENTER);errorText.setPadding(0,dp(12),0,dp(16));errorPanel.addView(errorText);
        LinearLayout recovery=new LinearLayout(activity);recovery.setGravity(Gravity.CENTER);
        Button retry=plainButton("Try again",()->{player.prepare();player.play();refresh();});retry.setTag("player-retry");retry.setBackground(ripple(ACCENT,6));recovery.addView(retry,new LinearLayout.LayoutParams(0,dp(48),1));recovery.addView(space(10));
        Button other=plainButton("Choose another stream",callbacks::close);other.setTag("player-other-stream");recovery.addView(other,new LinearLayout.LayoutParams(0,dp(48),1));errorPanel.addView(recovery,new LinearLayout.LayoutParams(-1,-2));
        LayoutParams errorParams=new LayoutParams(-1,-2,Gravity.CENTER);errorParams.setMargins(dp(24),dp(60),dp(24),dp(24));addView(errorPanel,errorParams);errorPanel.setVisibility(GONE);
        bottom.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->post(this::updateSubtitlePadding));
        unlock.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->post(this::updateSubtitlePadding));
        player.addListener(listener);player.setPlaybackSpeed(PlayerUiMath.speed(preferences.getFloat("speed",1f)));handler.post(update);scheduleHide();
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout layout=new LinearLayout(activity);layout.setOrientation(LinearLayout.VERTICAL);return layout;}
    private TextView text(String value,int size,int color){TextView view=new TextView(activity);view.setText(value);view.setTextSize(size);view.setTextColor(color);view.setFontFeatureSettings("tnum");return view;}
    private View space(int width){View view=new View(activity);view.setLayoutParams(new LinearLayout.LayoutParams(dp(width),1));return view;}
    private GradientDrawable round(int color,int radius){GradientDrawable drawable=new GradientDrawable();drawable.setColor(color);drawable.setCornerRadius(dp(radius));return drawable;}
    private RippleDrawable ripple(int color,int radius){return new RippleDrawable(ColorStateList.valueOf(0x44ffffff),round(color,radius),round(Color.WHITE,radius));}
    private ImageButton icon(int resource,String description,String tag,Runnable action){
        ImageButton button=new ImageButton(activity);button.setImageResource(resource);button.setScaleType(ImageView.ScaleType.FIT_CENTER);button.setPadding(dp(13),dp(13),dp(13),dp(13));button.setBackground(ripple(Color.TRANSPARENT,50));button.setContentDescription(description);button.setTag(tag);button.setOnClickListener(v->action.run());return button;
    }
    private Button plainButton(String label,Runnable action){Button button=new Button(activity);button.setText(label);button.setAllCaps(false);button.setTextColor(Color.WHITE);button.setTextSize(13);button.setMinWidth(0);button.setMinimumWidth(0);button.setPadding(dp(14),dp(8),dp(14),dp(8));button.setBackground(ripple(0xff333333,8));button.setOnClickListener(v->action.run());return button;}
    private TextView action(LinearLayout row,int resource,String label,String tag,Runnable click){
        LinearLayout button=column();button.setGravity(Gravity.CENTER);button.setBackground(ripple(Color.TRANSPARENT,8));button.setTag(tag);button.setContentDescription(label);button.setFocusable(true);button.setOnClickListener(v->click.run());
        ImageView glyph=new ImageView(activity);glyph.setImageResource(resource);glyph.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);button.addView(glyph,new LinearLayout.LayoutParams(dp(22),dp(22)));
        TextView caption=text(label,11,Color.WHITE);caption.setGravity(Gravity.CENTER);caption.setPadding(0,dp(5),0,0);caption.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);button.addView(caption);row.addView(button,new LinearLayout.LayoutParams(0,-1,1));return caption;
    }
    private boolean canSeek(){return player.isCommandAvailable(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)&&player.isCurrentMediaItemSeekable()&&player.getDuration()>0;}
    private void seek(long delta){if(!canSeek())return;player.seekTo(PlayerUiMath.seekPosition(player.getCurrentPosition(),player.getDuration(),delta));announce(delta<0?"↶ 10 seconds":"10 seconds ↷");refresh();scheduleHide();}
    private void announce(String message){feedback.setText(message);fade(feedback,true);handler.removeCallbacks(hideFeedback);handler.postDelayed(hideFeedback,800);announceForAccessibility(message);}
    private void showTime(long position){elapsed.setText(PlayerUiMath.time(position));long duration=player.getDuration();remaining.setText(duration>0?"−"+PlayerUiMath.time(Math.max(0,duration-position)):player.isCurrentMediaItemLive()?"LIVE":"--:--");}
    private void refresh(){
        if(disposed)return;
        boolean failed=player.getPlayerError()!=null;
        errorPanel.setVisibility(failed?VISIBLE:GONE);center.setVisibility(failed?GONE:VISIBLE);bottom.setVisibility(failed?GONE:VISIBLE);
        if(failed){if(locked)setLocked(false);errorText.setText("Check your connection, retry, or pick a different stream.\nError "+player.getPlayerError().errorCode);setControlsVisible(true);}
        boolean playing=player.getPlayWhenReady();play.setImageResource(playing?R.drawable.ic_player_pause:R.drawable.ic_player_play);play.setContentDescription(playing?"Pause":"Play");
        loading.setVisibility(player.getPlaybackState()==Player.STATE_BUFFERING?VISIBLE:INVISIBLE);
        boolean seekable=canSeek();for(View control:new View[]{rewind,forward,timeBar}){control.setEnabled(seekable);control.setAlpha(seekable?1f:.35f);}
        if(!scrubbing){long position=Math.max(0,player.getCurrentPosition());timeBar.setDuration(Math.max(0,player.getDuration()));timeBar.setPosition(position);timeBar.setBufferedPosition(Math.max(0,player.getBufferedPosition()));showTime(position);}
        String speed="Speed ("+PlayerUiMath.speedLabel(player.getPlaybackParameters().speed)+")";speedText.setText(speed);((View)speedText.getParent()).setContentDescription(speed);
    }
    public void setControlsVisible(boolean show){
        if(disposed||locked)return;
        if(visible!=show){visible=show;fade(overlay,show);}
        updateSubtitlePadding();
        if(show)scheduleHide();else handler.removeCallbacks(hide);
    }
    private void fade(View view,boolean show){
        view.animate().withEndAction(null).cancel();
        if(view!=feedback)view.setImportantForAccessibility(show?IMPORTANT_FOR_ACCESSIBILITY_AUTO:IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        if(!ValueAnimator.areAnimatorsEnabled()){
            view.setAlpha(1f);view.setVisibility(show?VISIBLE:GONE);updateSubtitlePadding();return;
        }
        if(show){
            if(view.getVisibility()!=VISIBLE){view.setAlpha(0f);view.setVisibility(VISIBLE);}
            if(view.getAlpha()==1f)return;
        }else if(view.getVisibility()!=VISIBLE)return;
        view.animate().alpha(show?1f:0f).setDuration(show?240:180)
            .setInterpolator(new PathInterpolator(.2f,0f,0f,1f)).withEndAction(()->{
                if(!show)view.setVisibility(GONE);
                view.setAlpha(1f);updateSubtitlePadding();
            }).start();
        updateSubtitlePadding();
    }
    private void scheduleHide(){
        handler.removeCallbacks(hide);if(disposed)return;AccessibilityManager accessibility=(AccessibilityManager)activity.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if(visible&&!locked&&!scrubbing&&dialog==null&&player.isPlaying()&&player.getPlayerError()==null&&(accessibility==null||!accessibility.isTouchExplorationEnabled()))handler.postDelayed(hide,4000);
    }
    private void setLocked(boolean value){
        locked=value;callbacks.lockOrientation(value);handler.removeCallbacks(hide);
        if(value){visible=false;fade(overlay,false);showUnlock();}
        else{handler.removeCallbacks(hideUnlock);fade(unlock,false);setControlsVisible(true);}
    }
    private void showUnlock(){
        fade(unlock,true);updateSubtitlePadding();handler.removeCallbacks(hideUnlock);
        AccessibilityManager accessibility=(AccessibilityManager)activity.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if(accessibility==null||!accessibility.isTouchExplorationEnabled())handler.postDelayed(hideUnlock,4000);
    }
    private void updateSubtitlePadding(){
        if(disposed||surface==null)return;SubtitleView subtitles=surface.getSubtitleView();if(subtitles==null||!(subtitles.getParent() instanceof View))return;
        View frame=(View)subtitles.getParent();if(frame.getHeight()==0)return;
        View obstruction=bottom!=null&&bottom.isShown()?bottom:unlock!=null&&unlock.isShown()?unlock:null;
        int margin=0;
        if(obstruction!=null){int[] videoOrigin=new int[2],controlOrigin=new int[2];frame.getLocationOnScreen(videoOrigin);obstruction.getLocationOnScreen(controlOrigin);margin=Math.max(0,videoOrigin[1]+frame.getHeight()-controlOrigin[1]+dp(12));}
        margin=Math.min(frame.getHeight()/2,margin);
        // WebVTT's explicit line placement ignores bottomPaddingFraction. Resize
        // the caption viewport instead, preserving the font size and video bounds.
        ViewGroup.MarginLayoutParams params=(ViewGroup.MarginLayoutParams)subtitles.getLayoutParams();
        if(params.bottomMargin!=margin){params.bottomMargin=margin;subtitles.setLayoutParams(params);}
        subtitles.setFixedTextSize(TypedValue.COMPLEX_UNIT_PX,frame.getHeight()*SubtitleView.DEFAULT_TEXT_SIZE_FRACTION*captionScale);
        subtitles.setBottomPaddingFraction(.08f);
    }
    @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){
        super.onSizeChanged(w,h,oldw,oldh);updateSubtitlePadding();
        if(dialog!=null&&dialog.getWindow()!=null)dialog.getWindow().setLayout(Math.min(w,dp(680)),Math.min(dp(sheetHeight),Math.max(dp(220),h-dp(24))));
    }
    public boolean handleBack(){if(dialog!=null){dialog.dismiss();return true;}if(locked){setLocked(false);return true;}return false;}
    public void setSafeInsets(int left,int top,int right,int bottomInset){chrome.setPadding(left,top,right,bottomInset);LayoutParams params=(LayoutParams)unlock.getLayoutParams();params.bottomMargin=dp(24)+bottomInset;unlock.setLayoutParams(params);}
    private LinearLayout sheet(String title,int preferredHeight){
        sheetHeight=preferredHeight;
        if(dialog!=null)dialog.dismiss();handler.removeCallbacks(hide);
        dialog=new Dialog(activity);dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);LinearLayout content=column();content.setPadding(dp(22),dp(20),dp(22),dp(22));content.setBackground(round(0xff191919,18));
        LinearLayout heading=new LinearLayout(activity);heading.setGravity(Gravity.CENTER_VERTICAL);TextView text=text(title,22,Color.WHITE);text.setTypeface(null,Typeface.BOLD);heading.addView(text,new LinearLayout.LayoutParams(0,-2,1));heading.addView(icon(R.drawable.ic_player_close,"Close player settings","player-sheet-close",()->dialog.dismiss()),new LinearLayout.LayoutParams(dp(48),dp(48)));content.addView(heading);
        dialog.setContentView(content);dialog.setOnDismissListener(d->{dialog=null;trackColumns=null;scheduleHide();});
        Window window=dialog.getWindow();if(window!=null){window.setBackgroundDrawableResource(android.R.color.transparent);window.setWindowAnimations(ValueAnimator.areAnimatorsEnabled()?R.style.PlayerSheetAnimation:0);window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);WindowManager.LayoutParams params=window.getAttributes();params.dimAmount=.65f;params.gravity=Gravity.BOTTOM;window.setAttributes(params);}
        dialog.show();if(window!=null)window.setLayout(Math.min(getWidth(),dp(680)),Math.min(dp(sheetHeight),Math.max(dp(220),getHeight()-dp(24))));
        return content;
    }
    private void chooseSpeed(){
        LinearLayout content=sheet("Playback speed",250);
        LinearLayout choices=column();choices.setPadding(0,dp(12),0,0);content.addView(choices,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout row=null;int index=0;
        for(float value:new float[]{.5f,.75f,1f,1.25f,1.5f,2f}){
            Button option=plainButton(PlayerUiMath.speedLabel(value)+(value==1f?" · Normal":""),()->{player.setPlaybackSpeed(value);preferences.edit().putFloat("speed",value).apply();dialog.dismiss();refresh();});
            option.setTag("player-speed-"+value);boolean selected=Math.abs(player.getPlaybackParameters().speed-value)<.001;option.setBackground(ripple(selected?0xff4a2028:Color.TRANSPARENT,6));option.setContentDescription(option.getText()+(selected?", selected":""));if(index%3==0){row=new LinearLayout(activity);LinearLayout.LayoutParams rowParams=new LinearLayout.LayoutParams(-1,dp(52));rowParams.bottomMargin=dp(8);choices.addView(row,rowParams);}
            LinearLayout.LayoutParams cell=new LinearLayout.LayoutParams(0,-1,1);if(index%3!=0)cell.leftMargin=dp(8);row.addView(option,cell);index++;
        }
    }
    private void chooseTracks(){
        LinearLayout content=sheet("Audio & Subtitles",430);trackColumns=new LinearLayout(activity);trackColumns.setPadding(0,dp(12),0,dp(12));content.addView(trackColumns,new LinearLayout.LayoutParams(-1,0,1));populateTracks();Button done=plainButton("Done",()->dialog.dismiss());content.addView(done,new LinearLayout.LayoutParams(-1,dp(48)));
    }
    private void populateTracks(){
        if(trackColumns==null)return;trackColumns.removeAllViews();
        for(int type:new int[]{C.TRACK_TYPE_AUDIO,C.TRACK_TYPE_TEXT}){
            LinearLayout column=column();column.setPadding(0,0,dp(10),0);TextView title=text(type==C.TRACK_TYPE_AUDIO?"Audio":"Subtitles",15,Color.WHITE);title.setTypeface(null,Typeface.BOLD);title.setPadding(0,0,0,dp(12));column.addView(title);
            ScrollView scroll=new ScrollView(activity);LinearLayout choices=column();scroll.addView(choices);column.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));trackColumns.addView(column,new LinearLayout.LayoutParams(0,-1,1));
            boolean disabled=player.getTrackSelectionParameters().disabledTrackTypes.contains(type),overridden=false;
            for(TrackSelectionOverride override:player.getTrackSelectionParameters().overrides.values())if(override.getType()==type)overridden=true;
            trackOption(choices,type==C.TRACK_TYPE_TEXT?"Off":"Automatic",type==C.TRACK_TYPE_TEXT?disabled:!overridden,()->selectTrack(type,null));
            int count=0;
            for(Tracks.Group group:player.getCurrentTracks().getGroups()){
                if(group.getType()!=type)continue;
                for(int i=0;i<group.length;i++)if(group.isTrackSupported(i)){
                    Format format=group.getTrackFormat(i);String language=format.language==null||"und".equals(format.language)?"Unknown language":Locale.forLanguageTag(format.language.replace('_','-')).getDisplayName();
                    String label=format.label!=null&&!format.label.isEmpty()&&!format.label.equals(format.language)?format.label:language;
                    if(type==C.TRACK_TYPE_AUDIO&&format.channelCount>0)label+=" · "+(format.channelCount==1?"Mono":format.channelCount==2?"Stereo":format.channelCount==6?"5.1":format.channelCount==8?"7.1":format.channelCount+" channels");
                    TrackSelectionOverride override=new TrackSelectionOverride(group.getMediaTrackGroup(),i);
                    trackOption(choices,label,!disabled&&group.isTrackSelected(i)&&(type==C.TRACK_TYPE_TEXT||overridden),()->selectTrack(type,override));count++;
                }
            }
            if(count==0){TextView empty=text("No supported tracks available yet.",12,MUTED);empty.setPadding(dp(8),dp(16),dp(8),0);choices.addView(empty);}
        }
    }
    private void trackOption(LinearLayout choices,String label,boolean selected,Runnable action){
        TextView option=text((selected?"✓  ":"    ")+label,13,selected?Color.WHITE:MUTED);option.setGravity(Gravity.CENTER_VERTICAL);option.setMinHeight(dp(48));option.setPadding(dp(6),dp(10),dp(6),dp(10));option.setBackground(ripple(selected?0xff303030:Color.TRANSPARENT,5));option.setFocusable(true);option.setContentDescription(label+(selected?", selected":""));option.setOnClickListener(v->action.run());choices.addView(option,new LinearLayout.LayoutParams(-1,-2));
    }
    private void selectTrack(int type,TrackSelectionOverride override){
        TrackSelectionParameters.Builder parameters=player.getTrackSelectionParameters().buildUpon().clearOverridesOfType(type).setTrackTypeDisabled(type,type==C.TRACK_TYPE_TEXT&&override==null);
        if(override!=null)parameters.addOverride(override);player.setTrackSelectionParameters(parameters.build());populateTracks();
    }
    private void chooseBrightness(){
        LinearLayout content=sheet("Brightness",300);TextView note=text("Adjust brightness for this player only.",14,MUTED);note.setPadding(0,dp(12),0,dp(22));content.addView(note);
        SeekBar slider=new SeekBar(activity);slider.setTag("player-brightness-slider");slider.setContentDescription("Player brightness");slider.setMax(95);slider.setProgress(Math.round((activity.getWindow().getAttributes().screenBrightness<0?.5f:activity.getWindow().getAttributes().screenBrightness)*100)-5);slider.setProgressTintList(ColorStateList.valueOf(ACCENT));slider.setThumbTintList(ColorStateList.valueOf(Color.WHITE));content.addView(slider,new LinearLayout.LayoutParams(-1,dp(56)));
        slider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){@Override public void onStartTrackingTouch(SeekBar bar){}@Override public void onStopTrackingTouch(SeekBar bar){}@Override public void onProgressChanged(SeekBar bar,int progress,boolean user){if(user)applyBrightness((progress+5)/100f);}});
        Button reset=plainButton("Use device brightness",()->{applyBrightness(-1f);dialog.dismiss();});content.addView(reset,new LinearLayout.LayoutParams(-1,dp(48)));
    }
    private void applyBrightness(float value){
        WindowManager.LayoutParams params=activity.getWindow().getAttributes();params.screenBrightness=value;activity.getWindow().setAttributes(params);
        if(dialog!=null&&dialog.getWindow()!=null){params=dialog.getWindow().getAttributes();params.screenBrightness=value;dialog.getWindow().setAttributes(params);}
    }
    public void dispose(){
        disposed=true;handler.removeCallbacksAndMessages(null);if(dialog!=null)dialog.dismiss();player.removeListener(listener);surface.setPlayer(null);
        for(View view:new View[]{overlay,unlock,feedback})view.animate().withEndAction(null).cancel();
        WindowManager.LayoutParams params=activity.getWindow().getAttributes();params.screenBrightness=originalBrightness;activity.getWindow().setAttributes(params);
    }
}
