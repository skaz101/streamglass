package com.streamglass.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class PlayerUiMathTest {
    @Test public void skipsClampAtBothEndsWithoutOverflow() {
        assertEquals(0,PlayerUiMath.seekPosition(3000,60000,-10000));
        assertEquals(60000,PlayerUiMath.seekPosition(58000,60000,10000));
        assertEquals(30000,PlayerUiMath.seekPosition(20000,60000,10000));
        assertEquals(Long.MAX_VALUE,PlayerUiMath.seekPosition(Long.MAX_VALUE-10,-1,10000));
    }
    @Test public void formatsUnknownShortAndLongMedia() {
        assertEquals("0:00",PlayerUiMath.time(Long.MIN_VALUE));
        assertEquals("1:01",PlayerUiMath.time(61000));
        assertEquals("2:03:04",PlayerUiMath.time(7384000));
    }
    @Test public void invalidStoredSpeedsCannotBreakPlayback() {
        assertEquals(1f,PlayerUiMath.speed(Float.NaN),0);
        assertEquals(1f,PlayerUiMath.speed(Float.POSITIVE_INFINITY),0);
        assertEquals(.5f,PlayerUiMath.speed(-2),0);
        assertEquals(2f,PlayerUiMath.speed(20),0);
        assertEquals("1×",PlayerUiMath.speedLabel(1));
        assertEquals("1.25×",PlayerUiMath.speedLabel(1.25f));
    }
}
