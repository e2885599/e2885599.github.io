#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
建構 notes/inception-essay.html ——
《全面啟動》影評 · 論點解剖（B 網頁 + C 論點分析）。
設計系統 100% 複用 studio-site：links assets/style.css、assets/aurora.js、assets/anim.js，
並加頁面級 章節 scrollspy + 閱讀進度條（動態/滾動動畫取向）。
內容：從原始 SRT 精準翻譯金句 + 中文策展敘事 + 6 張核心論點卡。
作者：遙遙（Hermes agent）｜2026-08-18
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = json.load(open(os.path.join(ROOT, "notes", "inception-meta.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "notes", "inception-essay.html")

# ───────────── 核心論點（C）─────────────
THESIS = [
    {"n": "01", "tag": "結局解讀", "title": "感覺勝於證明",
     "en": "Feeling over proof",
     "body": "陀螺倒不倒根本不是重點。Cobb 不需要看見它倒下就知道「自己回家了」——他聽見孩子聲音、轉身離桌。諾蘭讓全片主角在最後一刻，選擇感覺而非證據。觀眾多年糾結「他在現實還是 limbo」，恰好是電影警告我們別犯的錯：試圖用邏輯重建確定性，反而錯過了體驗。",
     "support": "原文：「Cobb doesn't need to see the top fall to know that he's home. He chooses the feeling over the proof.」"},
    {"n": "02", "tag": "創作寓言", "title": "夢境小隊＝電影劇組",
     "en": "The dream team is a film crew",
     "body": "夢境小隊幾乎一對一映射好萊塢劇組：Cobb＝導演、Arthur＝製片、Ariadne＝美術設計、Eames＝演員、Saito＝出資片廠；而被植入想法的 Fischer，就是坐在漆黑廳裡的觀眾。他們共同在一個人的腦中「建造世界、扮演角色、創造一場體驗」——這正是拍電影的本質。",
     "support": "原文：「Cobb, the director. Arthur, the producer. Ariadne, the production designer. Eames, the actor. And Saito, the studio footing the bill.」"},
    {"n": "03", "tag": "創作者心理", "title": "Mal＝放不下的點子幽靈",
     "en": "Mal is the idea you can't let go",
     "body": "每個創作者心中都有一個 Mal：那件定義了你、你一再回返卻放不下的作品。諾蘭把《全面啟動》這個點子含在嘴裡二十多年，每次回來都用記憶重建它，直到真實人生終於補上劇本等待的一切。Mal 不是他為電影發明的角色，而是「電影回頭看著他」——放手，才是創作循環的一部分。",
     "support": "原文：「Every artist has a version of Mal, the work that defines you, that you keep returning to and can't put down.」"},
    {"n": "04", "tag": "觀眾鏡像", "title": "我們就是 Cobb",
     "en": "We are doing what Cobb does",
     "body": "我們觀眾對這部片做的事，正是 Cobb 對自己記憶做的事：埋首於精確重建——Mal 的死、孩子的臉、沙灘、那些放不下的瞬間，深信答案藏在細節裡。但電影對他、也對我們「反著來」：知道一件事與感受一件事，是兩件完全不同的事。",
     "support": "原文：「We spend so much time doing to this movie what Cobb spends the whole movie doing to his memories.」"},
    {"n": "05", "tag": "創作方法", "title": "劇本要的是人生，不是時間",
     "en": "The script needed more life",
     "body": "諾蘭 16 歲在寄宿學校寫下這個點子，卡在 80 頁數年，因為「情感賭注還沒到位」。不是他鑽進自己腦袋能找到的——而是結婚、生子、再長期離家拍《黑暗騎士》，真實人生終於追上點子。劇本需要的從來不是更多時間，而是更多人生。",
     "support": "原文：「The script didn't need more time. It needed more life.」"},
    {"n": "06", "tag": "詮釋轉向", "title": "問它對你做了什麼",
     "en": "What the work does for you",
     "body": "我們對電影的參與，已從「作品對我們說了什麼」滑向「作品對作者說了什麼」——沉迷弗洛伊德式作者解讀。但《全面啟動》堅持問的是相反的方向：它對你做了什麼？一部電影最揭露真相的東西，很少是作者刻意放進去的；你讀懂所有刻意之處，也無法得知它正為你做什麼。",
     "support": "原文：「The most revealing things about a film are rarely the ones its maker put there on purpose.」"},
]

# ───────────── 章節敘事（中文策展改寫）─────────────
CHAPTERS = [
    {"id": "prologue", "no": "序", "title": "寫不完的告白",
     "lead": "一篇遲到十六年、寫了又廢的獨白。",
     "paras": [
        "「我試過寫這篇東西，次數多到數不清。每次都一樣：半途而廢、不了了之，留到改天。」開場的這段話，本身就預示了整支影片的主題——一個創作者與「說不盡的愛」之間的拉鋸。",
        "他坦言，從一開始就知道：沒有任何單一作品，能裝得下《全面啟動》對他而言的全部意義。「我做不到，而且我開始就知道我做不到。」但他仍要試——因為他欠這部電影這一次。",
     ],
     "quotes": [
        {"zh": "「我試過寫這篇東西，次數多到數不清。每次都一樣：半途而廢、不了了之。」",
         "en": "I've tried to write this piece more times than I can count. Every attempt ends the same way.",
         "who": "序章 · 開場白"},
     ]},
    {"id": "ch1", "no": "一", "title": "諾蘭、我父親，與一場電影之約",
     "lead": "父子難得同框的電影院，是他記憶裡最亮的坐标。",
     "paras": [
        "對他而言，諾蘭不只是一個導演，而是「我們這一代的 Spielberg」。但真正讓諾蘭的電影在他家特別的，不是影迷情結，而是一種罕見的父子時刻：父親工作常不在家，難得有空，父子倆會一起進戲院。",
        "2005 年是他電影觀的成形之年——《蝙蝠俠：開戰時刻》與《金剛》都是他與父親獨享的戲院之行。2010 年他 14 歲看《全面啟動》，第一次在「作為藝術」的層次上讀懂自己看見的東西：彎曲的城市、Hans Zimmer 的轟鳴、夢中夢的結構。他當場宣布這是他最愛的電影，十六年沒變。",
     ],
     "quotes": [
        {"zh": "「諾蘭的電影在我家很特別，不是因為它對那個幼苗般的影迷做了什麼，而是因為那是我和我爸難得獨處、一起為某件事產生共鳴的時刻。」",
         "en": "they were special because it was the rare occasion where my dad and I would go to the movies together ... the rare moments where just the two of us would go and bond over something I was incredibly passionate about.",
         "who": "第一章 · 父子戲院"},
     ]},
    {"id": "ch2", "no": "二", "title": "一部關於「拍電影」的電影",
     "lead": "夢境小隊幾乎一對一，就是一組電影劇組。",
     "paras": [
        "關於《全面啟動》最流行的讀法，是「拍電影的寓言」。他承認這讀法成立：夢境小隊的分工，幾乎是片場職務的鏡像。而被植入念頭的 Fischer——一個名字致敬《金手指》裡龐德化名、對年輕諾蘭意義重大的角色——就是坐在漆黑影廳裡的我們。",
        "更隱密的一層：第三層夢境重演了《女王密使》的雪地堡壘突襲，Zimmer 用當年 John Barry 同一台合成器、同一組和聲寫就。對他而言，《全面啟動》簡直是《女王密使》的精神續章——Cobb 是龐德罪惡感與創傷的具象，那個「恨自己的工作、卻又最擅長它、一直想逃」的男人。",
     ],
     "quotes": [
        {"zh": "「Cobb 是導演。Arthur 是製片。Ariadne 是美術設計。Eames 是演員。Saito 是出錢的片廠。」",
         "en": "Cobb, the director. Arthur, the producer. Ariadne, the production designer. Eames, the actor. And Saito, the studio footing the bill.",
         "who": "第二章 · 劇組映射"},
        {"zh": "「誠實地說，那個愛上這部電影的小孩長大了，替龐德的悲傷，拍出了它從未得到的那部續作。」",
         "en": "It's beautiful that the kid who fell in love with that movie grew up and gave Bond's grief the film it never got.",
         "who": "第二章 · 龐德續章"},
     ]},
    {"id": "ch3", "no": "三", "title": "結局不是謎題",
     "lead": "我們糾結陀螺倒不倒，恰好踩中電影警告的雷。",
     "paras": [
        "《全面啟動》不是被誤解的电影——它是本世紀最受愛戴的巨作之一。但關於它的對話，不知從何時起，從「電影本身」變成了「結局本身」。十六年來，論壇、深夜節目、甚至歌曲裡都在問：陀螺倒了吗？Cobb 回家了還是困在 limbo？",
        "諾蘭自己說過，鏡頭在那裡切走，理由比任何人想聽的都簡單：電影拍完了。Cobb 在最後一刻，不再糾結什麼是真實，決定那個問題不再重要。他選擇了感覺，而非證據。我們試圖「解開」結局，恰恰是電影要我們警惕的行為。",
     ],
     "quotes": [
        {"zh": "「Cobb 不需要看見陀螺倒下，就知道他回家了。他選擇了感覺，而非證據。」",
         "en": "Cobb doesn't need to see the top fall to know that he's home. He chooses the feeling over the proof.",
         "who": "第三章 · 結局核心"},
        {"zh": "「頓悟不是你解題解出來的，而是你終於允許自己去感受的。」",
         "en": "Catharsis isn't something you solve your way into, it's something you finally allow yourself to feel.",
         "who": "第三章 · 情感釋放"},
     ]},
    {"id": "ch4", "no": "四", "title": "Mal，與每個創作者心中的幽靈",
     "lead": "你放不下、一再重建的那件作品，最後會回頭看著你。",
     "paras": [
        "Mal 是全片最駭人的存在，不是因為她還原了那個真實的人，而是因為她根本不是真實的 Mal——她是 Cobb 悲傷與罪惡感的投射，毒化了他最愛之人的記憶。他承認：真正的 Mal 太複雜，無法被重現。",
        "由此他點出創作的全息隱喻：每個創作者心中都有一個 Mal——那件定義了你、你放不下、一再回返的作品。你帶著它越久，它越變形；最難的事，是知道何時該放手。對諾蘭，那個 Mal 就是《全面啟動》本身：一個從青少年時期就啃噬他、每次回來都用記憶重建、直到真實人生補上一切的点子。",
     ],
     "quotes": [
        {"zh": "「每個創作者心中都有一個 Mal——那件定義了你、你放不下、一再回返的作品。」",
         "en": "Every artist has a version of Mal, the work that defines you, that you keep returning to and can't put down.",
         "who": "第四章 · 創作者幽靈"},
        {"zh": "「放手不是創作的終點，它只是過程的一部分。跨過那道陌生地帶，下一個東西才會誕生。」",
         "en": "letting go of the thing that's consumed you isn't the end of creativity, it's just part of the process.",
         "who": "第四章 · 放手循環"},
     ]},
    {"id": "ch5", "no": "五", "title": "是真實人生，完成了這部電影",
     "lead": "劇本等了二十多年的，不是靈感，而是一個人被人生追上。",
     "paras": [
        "諾蘭最早把 Mal 寫成一個死掉的商業夥伴、一個黑色電影套路，劇本就那樣卡了好幾年。直到《黑暗騎士》讓他長時間離家、遠離家人，那個情感核心才終於「咔噠」就位。Cobb 孩子們在沙灘築的沙堡，直接來自諾蘭看著自己在佛州海灘上的兒子；Fischer 與父親的合照，用的是諾蘭與女兒 Flora 同一張照片。",
        "真實人生完成了這部電影。劇本懷抱點子二十多年，但點子在等那個人追上它。諾蘭缺的，不是鑽進自己腦袋能找到的——而是結婚、生子、再長期離家，直到錯過足夠多，才終於懂了 Cobb 拼命想回去的是什麼。",
     ],
     "quotes": [
        {"zh": "「劇本需要的不是更多時間，而是更多人生。」",
         "en": "The script didn't need more time. It needed more life.",
         "who": "第五章 · 人生補完"},
     ]},
    {"id": "ch6", "no": "六", "title": "它對你，做了什麼",
     "lead": "從「作者想說什麼」轉向「作品為我做了什麼」。",
     "paras": [
        "他坦白：自己花了一整支影片去精神分析諾蘭，寫的卻是一篇反對精神分析諾蘭的文章——這正是全片核心的悖論。我們對電影的參與，已從「作品對我們說了什麼」滑向「作品對作者說了什麼」，沉迷於弗洛伊德式作者解讀、幕後花絮、podcast 訪談。",
        "但《全面啟動》堅持問相反的方向：它對你做了什麼？諾蘭自己都說，導演做的很大一部分是本能與無意識——他甚至不知道自己把寄宿學校宿舍放進了電影。一部電影最揭露真相的東西，很少是作者刻意放進去的；你讀懂所有刻意之處，也無法得知它正為你做什麼。",
     ],
     "quotes": [
        {"zh": "「一部電影最揭露真相的東西，很少是作者刻意放進去的；你讀懂所有刻意之處，也無法得知它正為你做什麼。」",
         "en": "The most revealing things about a film are rarely the ones its maker put there on purpose, and knowing all the ones they did still won't tell you what the film is doing for you.",
         "who": "第六章 · 觀眾轉向"},
        {"zh": "「別試著去理解它。去感受它。」",
         "en": "Don't try to understand it. Feel it.",
         "who": "第六章 · 諾蘭在《天能》說的"},
     ]},
    {"id": "outro", "no": "終", "title": "謝謝你，克里斯多福·諾蘭",
     "lead": "一個 16 歲少年躺在上鋪聽 Walkman 的畫面，串起了兩代人。",
     "paras": [
        "諾蘭早在讀到波赫士《圓形廢墟》之前，心裡就有「夢中夢」的點子；那個故事沒有種下任何東西，只是擊中了他體內早已晃盪的某物。而這一切的起點，是一個 16 歲少年在寄宿學校熄燈後，躲進 Walkman 裡的電影配樂——那個畫面，正是講者自己小時候的模樣，想必也是諾蘭的。",
        "那個孩子長大，拍出了另一個孩子坐在父親身旁、燈光暗下、人生從此改變的電影。2010 年那場，他移居 LA 後又在 70mm 影廳重溫多次，成年後竟比首次更被撼動——聽著 Zimmer 的〈Time〉，他毫不掩飾地哭了。",
        "「《全面啟動》是電影力量最純粹的體現，一代人難遇的奇蹟。電影不會比這更好了。」而它之所以是他最愛的電影，不只是因為它美麗地講述了創作、靈感與拍電影，更因為它讓他學會與自己的情緒、關係、記憶與鄉愁和解。他最後說：諾蘭，謝謝你，讓我成為今天的我。",
     ],
     "quotes": [
        {"zh": "「《全面啟動》是電影力量最純粹的體現，一代人難遇的奇蹟。電影不會比這更好了。」",
         "en": "Inception is the power of movies in its purest form, a once-in-a-generation miracle. Cinema simply doesn't get better than this.",
         "who": "終章 · 致謝"},
     ]},
]

# ───────────── 金句牆（從原文精準翻譯）─────────────
QUOTES = [
    {"zh": "Cobb 不需要看見陀螺倒下，就知道他回家了。他選擇了感覺，而非證據。",
     "en": "Cobb doesn't need to see the top fall to know that he's home. He chooses the feeling over the proof."},
    {"zh": "頓悟不是你解題解出來的，而是你終於允許自己去感受的。",
     "en": "Catharsis isn't something you solve your way into, it's something you finally allow yourself to feel."},
    {"zh": "每個創作者心中都有一個 Mal——那件定義了你、你放不下、一再回返的作品。",
     "en": "Every artist has a version of Mal, the work that defines you, that you keep returning to and can't put down."},
    {"zh": "劇本需要的不是更多時間，而是更多人生。",
     "en": "The script didn't need more time. It needed more life."},
    {"zh": "一部電影最揭露真相的東西，很少是作者刻意放進去的。",
     "en": "The most revealing things about a film are rarely the ones its maker put there on purpose."},
    {"zh": "別試著去理解它。去感受它。",
     "en": "Don't try to understand it. Feel it."},
    {"zh": "《全面啟動》是電影力量最純粹的體現，一代人難遇的奇蹟。",
     "en": "Inception is the power of movies in its purest form, a once-in-a-generation miracle."},
    {"zh": "我們花這麼多時間對這部電影做的事，正是 Cobb 對自己記憶做的事。",
     "en": "We spend so much time doing to this movie what Cobb spends the whole movie doing to his memories."},
]

def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

# ── 章節導覽（scrollspy 用）──
def render_toc():
    items = "".join(
        f'<a href="#{c["id"]}" class="ch-link" data-target="{c["id"]}">'
        f'<span class="ch-no">{esc(c["no"])}</span>{esc(c["title"])}</a>'
        for c in CHAPTERS
    )
    return items

# ── 論點卡（C）──
def render_thesis():
    out = []
    for t in THESIS:
        out.append(f'''
        <div class="thesis reveal d{THESIS.index(t)%4 + 1}">
          <div class="thesis-no">{esc(t["n"])}</div>
          <div class="thesis-tag">{esc(t["tag"])}</div>
          <h3>{esc(t["title"])}</h3>
          <div class="thesis-en"><i>{esc(t["en"])}</i></div>
          <p>{esc(t["body"])}</p>
          <div class="thesis-support">▸ {esc(t["support"])}</div>
        </div>''')
    return "\n".join(out)

# ── 章節 ──
def render_chapters():
    out = []
    for c in CHAPTERS:
        paras = "\n".join(f"<p>{esc(p)}</p>" for p in c["paras"])
        quotes = ""
        for q in c["quotes"]:
            quotes += f'''
            <blockquote class="pull reveal">
              <p class="pull-zh">{esc(q["zh"])}</p>
              <p class="pull-en">{esc(q["en"])}</p>
              <footer>— {esc(q["who"])}</footer>
            </blockquote>'''
        out.append(f'''
        <section class="chapter" id="{c["id"]}">
          <div class="wrap chapter-inner">
            <div class="chapter-head reveal">
              <span class="chapter-no">{esc(c["no"])}</span>
              <div>
                <div class="chapter-kicker">{esc(c["lead"])}</div>
                <h2>{esc(c["title"])}</h2>
              </div>
            </div>
            <div class="chapter-body reveal d1">{paras}{quotes}</div>
          </div>
        </section>''')
    return "\n".join(out)

# ── 金句牆 ──
def render_quotes():
    out = []
    for i, q in enumerate(QUOTES):
        out.append(f'''
          <figure class="qcard reveal d{(i % 4) + 1}">
            <blockquote>{esc(q["zh"])}</blockquote>
            <figcaption><i>{esc(q["en"])}</i></figcaption>
          </figure>''')
    return "\n".join(out)

HTML = f'''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>《全面啟動》影評 · 論點解剖 — OODAV LAB 技術筆記</title>
<meta name="description" content="把一篇 38 分鐘的《全面啟動》英文影評獨白，解剖成 6 張核心論點卡與 7 章中文敘事：感覺勝於證明、拍電影的寓言、Mal＝創作者幽靈、我們就是 Cobb、劇本要的是人生、它對你做了什麼。" />
<link rel="stylesheet" href="../assets/style.css" />
<style>
  /* 頁面級樣式：論點解剖（沿用全站令牌，不另起爐灶） */
  .essay-root{{max-width:var(--w-page);margin:0 auto}}
  /* 閱讀進度條（scroll-scrub） */
  .read-bar{{position:fixed;top:0;left:0;right:0;height:3px;z-index:80;background:transparent}}
  .read-bar span{{display:block;height:100%;width:0;background:var(--grad);box-shadow:0 0 12px rgba(54,224,212,.6);transition:width .08s linear}}

  /* 章節 scrollspy 側欄 */
  .layout{{display:grid;grid-template-columns:240px 1fr;gap:var(--sp-5);align-items:start}}
  @media(max-width:980px){{.layout{{grid-template-columns:1fr}}}}
  .ch-rail{{position:sticky;top:88px;align-self:start}}
  @media(max-width:980px){{.ch-rail{{position:static;top:auto;margin-bottom:var(--sp-3)}}}}
  .ch-rail .rail-title{{font-size:var(--fs-2xs);letter-spacing:3px;color:var(--muted2);margin-bottom:var(--sp-2)}}
  .ch-link{{display:flex;gap:var(--sp-1);align-items:baseline;padding:var(--sp-1) var(--sp-1);border-left:2px solid var(--line);
    color:var(--muted);font-size:var(--fs-sm);text-decoration:none;transition:.2s var(--ease)}}
  .ch-link .ch-no{{font-family:"Space Grotesk",sans-serif;color:var(--muted2);font-weight:700;font-size:var(--fs-xs)}}
  .ch-link:hover{{color:var(--txt);border-left-color:var(--line2)}}
  .ch-link.active{{color:var(--cyan);border-left-color:var(--cyan);background:rgba(54,224,212,.06)}}

  /* Hero */
  .essay-hero{{position:relative;padding:var(--sp-6) 0 var(--sp-4);overflow:hidden}}
  .essay-hero .wrap{{position:relative;z-index:2}}
  .essay-hero h1{{font-size:clamp(34px,6vw,72px);line-height:1.08;margin:var(--sp-2) 0}}
  .essay-hero h1 .grad{{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}}
  .essay-meta{{display:flex;gap:var(--sp-4);flex-wrap:wrap;margin-top:var(--sp-3);color:var(--muted);font-size:var(--fs-sm)}}
  .essay-meta b{{color:var(--cyan);font-family:"Space Grotesk",sans-serif;font-variant-numeric:tabular-nums}}

  /* 論點卡 */
  .thesis-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--sp-3);margin-top:var(--sp-3)}}
  .thesis{{position:relative;background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);
    border-radius:var(--r-lg);padding:var(--sp-4);transition:.32s var(--ease);overflow:hidden}}
  .thesis::before{{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad);transform:scaleX(0);transform-origin:left;transition:transform .35s var(--ease)}}
  .thesis:hover{{transform:translateY(-6px);border-color:var(--cyan);box-shadow:var(--shadow-glow)}}
  .thesis:hover::before{{transform:scaleX(1)}}
  .thesis-no{{font-family:"Space Grotesk",sans-serif;font-size:var(--fs-stat);font-weight:800;color:var(--violet);opacity:.5;line-height:1}}
  .thesis-tag{{display:inline-block;font-size:var(--fs-2xs);letter-spacing:2px;color:var(--amber);border:1px solid rgba(255,179,71,.4);
    border-radius:var(--r-pill);padding:2px var(--sp-2);margin:var(--sp-1) 0}}
  .thesis h3{{color:var(--cyan);margin-bottom:var(--sp-1)}}
  .thesis-en{{font-size:var(--fs-xs);color:var(--muted2);margin-bottom:var(--sp-2);font-style:italic}}
  .thesis p{{color:var(--muted);font-size:var(--fs-sm);margin-bottom:var(--sp-2)}}
  .thesis-support{{font-size:var(--fs-xs);color:var(--muted2);border-top:1px dashed var(--line2);padding-top:var(--sp-2);line-height:1.6}}

  /* 章節 */
  .chapter{{padding:var(--sp-6) 0;border-top:1px solid var(--line)}}
  .chapter-head{{display:flex;gap:var(--sp-3);align-items:center;margin-bottom:var(--sp-3)}}
  .chapter-no{{font-family:"Space Grotesk",sans-serif;font-size:clamp(40px,7vw,76px);font-weight:800;
    background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1;min-width:1.4em;text-align:center}}
  .chapter-kicker{{font-size:var(--fs-xs);letter-spacing:2px;color:var(--violet);font-weight:700;margin-bottom:4px}}
  .chapter-body{{max-width:var(--w-prose-lg);color:var(--muted);font-size:var(--fs-body);line-height:1.95}}
  .chapter-body p{{margin-bottom:var(--sp-2)}}

  /* 金句 pull quote */
  .pull{{margin:var(--sp-4) 0;padding:var(--sp-3) var(--sp-4);border-left:3px solid var(--cyan);
    background:linear-gradient(120deg,rgba(54,224,212,.08),rgba(139,108,255,.05));border-radius:0 var(--r-lg) var(--r-lg) 0}}
  .pull-zh{{font-size:var(--fs-lede);color:var(--txt);line-height:1.7;font-weight:500;margin-bottom:var(--sp-1)}}
  .pull-en{{font-size:var(--fs-sm);color:var(--muted);font-style:italic;margin-bottom:var(--sp-1)}}
  .pull footer{{font-size:var(--fs-xs);color:var(--muted2);letter-spacing:1px}}

  /* 金句牆 */
  .qwall{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--sp-3);margin-top:var(--sp-3)}}
  .qcard{{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:var(--r-lg);
    padding:var(--sp-3);transition:.32s var(--ease)}}
  .qcard:hover{{border-color:var(--violet);transform:translateY(-4px)}}
  .qcard blockquote{{color:var(--txt);font-size:var(--fs-body);line-height:1.7;margin-bottom:var(--sp-2)}}
  .qcard figcaption{{font-size:var(--fs-xs);color:var(--muted2);font-style:italic;border-top:1px solid var(--line);padding-top:var(--sp-1)}}

  /* 反向提問 */
  .falsi-block{{background:linear-gradient(135deg,rgba(255,93,108,.10),rgba(54,224,212,.06));
    border:1px solid var(--line);border-left:4px solid var(--red);border-radius:0 var(--r-lg) var(--r-lg) 0;
    padding:var(--sp-4);margin-top:var(--sp-3)}}
  .falsi-block .lbl{{font-size:var(--fs-2xs);letter-spacing:2px;color:var(--red);font-weight:700;margin-bottom:var(--sp-1)}}
  .falsi-block p{{color:var(--txt);font-size:var(--fs-lede);line-height:1.7}}

  .src-note{{font-size:var(--fs-xs);color:var(--muted2);margin-top:var(--sp-2)}}
  .dl-row{{display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-top:var(--sp-2)}}
  .dl-row a{{font-size:var(--fs-sm)}}
  @media(prefers-reduced-motion:reduce){{.read-bar span{{transition:none}}}}
</style>
</head>
<body>
<canvas id="aurora"></canvas>
<div class="read-bar" aria-hidden="true"><span id="readBar"></span></div>

<nav>
  <div class="wrap nav-inner">
    <div class="brand"><span class="logo"></span> OODAV&nbsp;LAB</div>
    <div class="nav-links">
      <a href="../index.html">首頁</a>
      <a href="../about.html">關於我們</a>
      <a href="../services.html">服務項目</a>
      <a href="../pricing.html">報價</a>
      <a href="../lab.html">技術實驗場</a>
      <a href="../demo.html">看得見的示範</a>
      <a href="../sop-game-character-gameplay.html">人物博弈SOP</a>
      <a href="../contact.html">聯絡</a>
    </div>
  </div>
</nav>

<!-- HERO -->
<header class="essay-hero">
  <div class="wrap">
    <div class="reveal in">
      <span class="tag">影評解剖 · Film Essay</span>
      <h1>《全面啟動》<br><span class="grad">不只是電影</span></h1>
      <p class="lede">一篇 38 分鐘的英文影評獨白，被解剖成 6 張核心論點卡與 7 章中文敘事。它談的從來不是「陀螺倒不倒」，而是一個創作者與「說不盡的愛」之間的十六年拉鋸。</p>
      <div class="essay-meta">
        <span>片長約 <b>{META['duration_hms']}</b></span>
        <span>原文 <b>{META['word_count']:,}</b> 字</span>
        <span>清洗句數 <b>{META['sentence_count']}</b></span>
        <span>論點卡 <b>6</b> 張</span>
        <span>章節 <b>{len(CHAPTERS)}</b> 章</span>
      </div>
    </div>
  </div>
</header>

<!-- 論點分析預覽（C） -->
<section>
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="k">論點分析 · Thesis</div>
      <h2>六張卡，讀懂這篇獨白在說什麼</h2>
      <p>不黑箱、能親手驗——每一張卡都附上原始英文聲稱，您可以自行核對譯文是否被曲解。這是 OODAV LAB「不黑箱」原則在知識面的體現。</p>
    </div>
    <div class="thesis-grid">
      {render_thesis()}
    </div>
  </div>
</section>

<!-- 章節主體 + scrollspy -->
<div class="wrap">
  <div class="layout">
    <aside class="ch-rail">
      <div class="rail-title">章節 · CHAPTERS</div>
      {render_toc()}
    </aside>
    <div class="essay-root">
      {render_chapters()}
    </div>
  </div>
</div>

<!-- 金句牆 -->
<section>
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="k">金句牆 · Pull Quotes</div>
      <h2>八句，從原文精準翻譯</h2>
      <p>以下每一句都對應原始 SRT 逐字稿中的實際台詞（非意譯、非杜撰），供您打臉核對。</p>
    </div>
    <div class="qwall">
      {render_quotes()}
    </div>
    <div class="src-note">
      原始來源：一份關於《全面啟動》的英文影評影片 SRT 逐字稿（二級文本／影片逐字稿，非學術一級來源）。
      原始檔 sha256 = <code>{META['source_sha256'][:16]}…</code>，清洗檔 sha256 = <code>{META['clean_sha256'][:16]}…</code>（可經本地檔案重算對帳，確保未被竄改）。
    </div>
    <div class="dl-row">
      <a class="btn btn-ghost" href="inception-transcript-clean.txt" target="_blank" rel="noopener">下載清洗全文（.txt）</a>
      <a class="btn btn-ghost" href="inception-transcript.srt" target="_blank" rel="noopener">下載原始字幕（.srt）</a>
    </div>
  </div>
</section>

<!-- 反向提問（不可壓縮、可證偽） -->
<section>
  <div class="wrap">
    <div class="falsi-block reveal">
      <div class="lbl">不可壓縮 · 反向提問</div>
      <p>若「放手才是創作循環的一部分」為真，那麼當我們用幀級分析、物理學家追蹤陀螺擺動來「解開」《全面啟動》時——我們是在完成這部電影邀請我們做的事，還是正在重演 Cobb 被困在自己記憶裡的那種執念？</p>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="sitemap">
      <a href="../index.html">首頁</a>
      <a href="../about.html">關於我們</a>
      <a href="../services.html">服務項目</a>
      <a href="../pricing.html">報價</a>
      <a href="../lab.html">技術實驗場</a>
      <a href="../demo.html">看得見的示範</a>
      <a href="../sop-game-character-gameplay.html">人物博弈SOP</a>
      <a href="../contact.html">聯絡</a>
    </div>
    <div>© 2026 OODAV LAB · 主動資運工作室 · 透明 · 自動化 · 出事會報警</div>
    <div class="backtop"><a href="#">↑ 回到頂端</a></div>
  </div>
</footer>

<script src="../assets/aurora.js"></script>
<script src="../assets/anim.js"></script>
<script>
/* 閱讀進度條（scroll-scrub）：動態取向 */
(function(){{
  var bar=document.getElementById('readBar');
  function upd(){{
    var h=document.documentElement;
    var max=h.scrollHeight-h.clientHeight;
    var p=max>0?(h.scrollTop/max)*100:0;
    bar.style.width=p.toFixed(2)+'%';
  }}
  addEventListener('scroll',upd,{{passive:true}});
  addEventListener('resize',upd);
  upd();
}})();
/* 章節 scrollspy */
(function(){{
  var links=[].slice.call(document.querySelectorAll('.ch-link'));
  var map={{}}; links.forEach(function(l){{map[l.getAttribute('data-target')]=l;}});
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!('IntersectionObserver' in window)||reduce){{return;}}
  var io=new IntersectionObserver(function(entries){{
    entries.forEach(function(e){{
      if(e.isIntersecting){{
        links.forEach(function(l){{l.classList.remove('active');}});
        var t=map[e.target.id]; if(t) t.classList.add('active');
      }}
    }});
  }},{{rootMargin:'-30% 0px -60% 0px',threshold:0}});
  document.querySelectorAll('.chapter').forEach(function(s){{io.observe(s);}});
}})();
</script>
</body>
</html>'''

with open(OUT, "wb") as f:
    f.write(HTML.encode("utf-8"))
print("OK build_inception_essay ->", os.path.relpath(OUT, ROOT))
print("bytes:", len(HTML.encode("utf-8")), "| chapters:", len(CHAPTERS), "| thesis:", len(THESIS), "| quotes:", len(QUOTES))
