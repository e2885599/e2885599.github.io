# -*- coding: utf-8 -*-
# 將 audio_manifest.json 包成 audio_manifest.js（window.AUDIO_MANIFEST），供瀏覽器直接取用
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
man = json.load(open(os.path.join(HERE, "audio_manifest.json"), encoding="utf-8"))
with open(os.path.join(HERE, "audio_manifest.js"), "w", encoding="utf-8") as f:
    f.write("// 自動產生：對齊 subtitles.js 風格，供 app.js 掛真音訊\n")
    f.write("window.AUDIO_MANIFEST = " + json.dumps(man, ensure_ascii=False, indent=1) + ";\n")
print("audio_manifest.js 已產出，voice =", man["voice"], "總時長", round(man["total_sec"], 2), "s")
