/* Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later. */
package com.streamglass.mobile;

import java.util.Locale;

final class PlayerUiMath {
    private PlayerUiMath() { }
    static long seekPosition(long position, long duration, long delta) {
        long current=Math.max(0,position);
        long target=delta>0 && current>Long.MAX_VALUE-delta?Long.MAX_VALUE:current+delta;
        return Math.max(0,duration>0?Math.min(duration,target):target);
    }
    static String time(long milliseconds) {
        long total=Math.max(0,milliseconds)/1000,seconds=total%60,minutes=(total/60)%60,hours=total/3600;
        return hours>0?String.format(Locale.ROOT,"%d:%02d:%02d",hours,minutes,seconds)
                :String.format(Locale.ROOT,"%d:%02d",total/60,seconds);
    }
    static float speed(float value) {
        return Float.isNaN(value)||Float.isInfinite(value)?1f:Math.max(.5f,Math.min(2f,value));
    }
    static String speedLabel(float value) {
        return String.format(Locale.ROOT,"%.2f",value).replaceAll("0+$","").replaceAll("\\.$","")+"×";
    }
}
