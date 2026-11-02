"""Generate original landscape art, local H.264/AAC video and captions for native tests."""
from pathlib import Path
import subprocess
import math
root=Path(__file__).resolve().parents[1]/'app/build/generated/player-test-assets'
root.mkdir(parents=True,exist_ok=True)
w,h=1280,720
pixels=bytearray()
def ridge(x,points):
    for (x1,y1),(x2,y2) in zip(points,points[1:]):
        if x1<=x<=x2:return y1+(y2-y1)*(x-x1)/(x2-x1)
    return h
ridges=[[(0,580),(260,230),(490,555),(690,330),(1020,590),(1280,400)],[(0,690),(230,490),(520,650),(800,470),(1030,600),(1280,535)]]
for y in range(h):
    for x in range(w):
        t=y/h;color=[int(a+(b-a)*t) for a,b in zip((24,37,56),(168,134,109))]
        if (x-910)**2+(y-225)**2<145**2:color=[193,155,108]
        if y>ridge(x,ridges[0]):color=[35,52,62]
        if y>ridge(x,ridges[1]):color=[19,34,43]
        if y>650+math.sin(x/130)*25:color=[12,23,31]
        if (x-620)**2+(y-572)**2<8**2 or (614<x<626 and 579<y<613) or (abs(x-(620+(y-610)*.22))<3 and 609<y<645) or (abs(x-(620-(y-610)*.18))<3 and 609<y<645):color=[7,15,22]
        pixels.extend(color)
image=root/'landscape.ppm';image.write_bytes(f'P6\n{w} {h}\n255\n'.encode()+pixels)
subprocess.run(['ffmpeg','-v','error','-y','-loop','1','-i',str(image),'-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-f','lavfi','-i','sine=frequency=330:sample_rate=48000','-t','120','-map','0:v','-map','1:a','-map','2:a','-r','24','-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-ac','2','-metadata:s:a:0','language=eng','-metadata:s:a:1','language=fra','-movflags','+faststart',str(root/'player-fixture.mp4')],check=True)
image.unlink()
for language,caption in [('english','Some journeys begin with a single signal.'),('spanish','Todo viaje comienza con una señal.')]:
    (root/f'player-{language}.vtt').write_text(f'WEBVTT\n\n00:00:00.000 --> 00:02:00.000\n{caption}\n')
print('Native-only media fixtures generated; release source set excludes them.')
