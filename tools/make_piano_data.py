#!/usr/bin/env python3
"""audio/piano/*.mp3 를 audio/piano-data.js 로 묶는다.

브라우저에서 파일을 직접 열 때(local.html, file://)는 fetch로 mp3를 읽을 수 없어서,
<script>로 불러올 수 있게 base64로 넣어 둔다. 온라인 버전도 같은 파일을 쓴다.

소리 출처: Salamander Grand Piano V3 (Alexander Holm), CC BY 3.0
https://archive.org/details/SalamanderGrandPianoV3
다듬기: 앞 무음 제거, 3.5초에서 페이드아웃 (README 참고)
"""
import base64
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTE = {'C': 0, 'Cs': 1, 'D': 2, 'Ds': 3, 'E': 4, 'F': 5, 'Fs': 6, 'G': 7, 'Gs': 8, 'A': 9, 'As': 10, 'B': 11}

samples = {}
for f in sorted((ROOT / 'audio' / 'piano').glob('*.mp3')):
    name, octave = f.stem[:-1], int(f.stem[-1])
    midi = 12 * (octave + 1) + NOTE[name]
    samples[midi] = base64.b64encode(f.read_bytes()).decode('ascii')

out = ROOT / 'audio' / 'piano-data.js'
out.write_text(
    '/* 그랜드 피아노 소리: Salamander Grand Piano V3 (Alexander Holm), CC BY 3.0 */\n'
    '/* tools/make_piano_data.py 로 만든 파일입니다. 직접 고치지 마세요. */\n'
    'window.PIANO_SAMPLES = ' + json.dumps(samples) + ';\n',
    encoding='utf-8',
)
print(out.relative_to(ROOT), f'{out.stat().st_size / 1024:.0f}KB', sorted(samples))
