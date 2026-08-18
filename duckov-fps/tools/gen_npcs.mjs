// 程序化生成 12 個 NPC 資料檔（JSON）→ assets/characters/npc_<id>.json
// 每個 NPC 含：id / name / role / visual / dialogue（對話樹 nodes+start，接 dialogue.js 結構）
// 對話樹保證從入口 'start' 全連通、且至少抵達一個終端節點（無孤島/斷鏈）。
// 可重複執行；本輪產出最小真實集（12 個），未來可參數化擴容。
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'assets', 'characters');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// 通用對話樹骨架：全連通，起點 start → lore/situation/quest/farewell，終端 accept/farewell/farewell2
function makeDialogue({ greeting, lore, situation, quest }) {
  return {
    start: 'start',
    nodes: {
      start: {
        text: greeting,
        options: [
          { label: '說說你的來歷', next: 'lore' },
          { label: '這裡情勢如何', next: 'situation' },
          { label: '可有任務委託', next: 'quest' },
          { label: '告辭', next: 'farewell' }
        ]
      },
      lore: { text: lore, options: [ { label: '原來如此', next: 'farewell2' } ] },
      situation: {
        text: situation,
        options: [
          { label: '明白了', next: 'farewell2' },
          { label: '還有細節', next: 'quest' }
        ]
      },
      quest: {
        text: quest,
        options: [
          { label: '我接下這任務', next: 'accept' },
          { label: '再考慮看看', next: 'farewell2' }
        ]
      },
      accept: { text: '（任務已記入任務板。願鴨神庇佑。）', options: [] },
      farewell: { text: '（你轉身沒入硝煙。）', options: [] },
      farewell2: { text: '（對話結束。）', options: [] }
    }
  };
}

// 12 名 NPC：職能參考真實射擊遊戲編制（武器商/機械師/哨兵/醫療兵/補給官/發電技師/通訊兵/研究員/教官/水務員/撤退嚮導/指揮官）
const SPECS = [
  {
    id: 'npc_armorer', name: '鐵砧', role: '軍械師', role_en: 'Armorer',
    color: 0xC0392B, scale: 1.0, affinity: 'armory', tex: 'assets/textures/tex_0001.png',
    greeting: '我是鐵砧，軍械庫的軍械師。你身上的槍該保養了——彈匣磨損會要你的命。',
    lore: '戰前我是車間學徒，如今靠廢鐵拼出能用的傢伙。每一把都沾過鴨血。',
    situation: '敵方巡邏隊繞著軍械庫轉，盯著我們的彈藥產線。別讓他們斷了補給。',
    quest: '替我找回三份「武器藍圖」，我就幫你把主武器升到第三階。'
  },
  {
    id: 'npc_mechanic', name: '齒輪', role: '機械師', role_en: 'Mechanic',
    color: 0x8E44AD, scale: 1.05, affinity: 'defense', tex: 'assets/textures/tex_0002.png',
    greeting: '齒輪報到。防禦工事的砲塔卡彈了，我正拆到一半。',
    lore: '我爹是維修工，我子承父業——只不過他修拖拉機，我修要命的玩意。',
    situation: '自動砲兵有三座離線，東牆的護板也被轟出洞。撐不住夜裡的進攻。',
    quest: '去撿「反應爐芯」和「武器藍圖」各一份，我重啟砲塔防線。'
  },
  {
    id: 'npc_sentry', name: '鷹眼', role: '哨兵', role_en: 'Sentry',
    color: 0x2980B9, scale: 0.98, affinity: 'scout', tex: 'assets/textures/tex_0003.png',
    greeting: '鷹眼在此。我看得比誰都遠，也死得比誰都慢——目前為止。',
    lore: '偵察哨練出的眼力。風向、腳步、金屬反光，騙不過我。',
    situation: '東北丘陵有敵人集結，數量是上週的三倍。他們在等天黑。',
    quest: '幫我架起「通訊模組」，把敵情回傳指揮部，預警半徑才能擴開。'
  },
  {
    id: 'npc_medic', name: '白鴿', role: '醫療兵', role_en: 'Medic',
    color: 0xDFF9FB, scale: 1.0, affinity: 'medical', tex: 'assets/textures/tex_0004.png',
    greeting: '白鴿在。先別動，你臂上那道傷口在滲血。',
    lore: '醫療站熬過三波毒氣，我的血清是拿樣本罐裡的東西試出來的。',
    situation: '傷員排到門外，醫療包見底。沒有「樣本罐」我提不出新血清。',
    quest: '帶回「醫療包」與「樣本罐」各一份，我讓你的回血速率倍增。'
  },
  {
    id: 'npc_quartermaster', name: '糧倉', role: '補給官', role_en: 'Quartermaster',
    color: 0xD4AC0D, scale: 1.02, affinity: 'supply', tex: 'assets/textures/tex_0005.png',
    greeting: '糧倉管帳。物資上限卡著，多運一瓶水都堆不進倉。',
    lore: '補給倉庫的鑰匙掛我腰上。戰前我管超市庫存，現在管命。',
    situation: '倉容見頂，長期作戰撐不住。擴倉要電，電要發電設施供。',
    quest: '湊「能量電池」一份，我擴倉並把你的搬運效率調高。'
  },
  {
    id: 'npc_engineer', name: '火花', role: '發電技師', role_en: 'Power Engineer',
    color: 0xF39C12, scale: 1.0, affinity: 'power', tex: 'assets/textures/tex_0006.png',
    greeting: '火花來了。沒電，這營地連燈都是擺設，更別提砲塔。',
    lore: '發電設施是我一手點亮的。反應爐芯是心臟，電池是血。',
    situation: '主變電器過熱跳閘，全營電力在閃。再拖就全黑。',
    quest: '找「能量電池」兩份與「反應爐芯」一份，我穩住電網。'
  },
  {
    id: 'npc_comms', name: '電波', role: '通訊兵', role_en: 'Comms Operator',
    color: 0x16A085, scale: 0.99, affinity: 'comms', tex: 'assets/textures/tex_0007.png',
    greeting: '電波在線。通訊塔能聯到外頭，也能把任務情報中繼給你。',
    lore: '通訊塔的頻率是我調的。戰前我是廣播員，現在播的是活命頻道。',
    situation: '訊號被干擾，外頭的撤離指令收不到。需要「通訊模組」重校。',
    quest: '拿「通訊模組」三份，我重開對外聯絡並解鎖情報板。'
  },
  {
    id: 'npc_researcher', name: '解析', role: '研究員', role_en: 'Researcher',
    color: 0x9B59B6, scale: 1.0, affinity: 'research', tex: 'assets/textures/tex_0008.png',
    greeting: '解析在。我在拆那顆核心AI——它比我們以為的更活。',
    lore: '研究實驗室的解讀進度卡在加密層。硬碟與基因序列是鑰匙。',
    situation: '核心AI在學我們的戰術。不早日破解，終局就沒我們的份。',
    quest: '取「加密硬碟」與「基因序列」各一份，我推進終局解讀。'
  },
  {
    id: 'npc_drill', name: '鐵拳', role: '訓練教官', role_en: 'Drill Instructor',
    color: 0xE67E22, scale: 1.08, affinity: 'training', tex: 'assets/textures/tex_0009.png',
    greeting: '鐵拳盯著你。站姿鬆垮，後坐力會把你掀翻。',
    lore: '訓練場磨出穩定度。戰前我是射擊教練，現在救你的命。',
    situation: '新兵後坐控制差，命中率低得可怕。得靠藍圖練槍。',
    quest: '繳「武器藍圖」三份，我開訓練場把你的後坐係數壓下來。'
  },
  {
    id: 'npc_hydro', name: '清流', role: '水務員', role_en: 'Hydro Technician',
    color: 0x3498DB, scale: 1.0, affinity: 'water', tex: 'assets/textures/tex_0010.png',
    greeting: '清流在此。沒淨水，環境耗損會慢慢啃掉全營。',
    lore: '水處理廠的濾芯是我換的。樣本罐裡的水，有些比毒還毒。',
    situation: '濾芯堵塞，出水帶銹。兄弟們喝壞肚子，戰力掉一截。',
    quest: '送「樣本罐」三份，我重啟水線並降環境耗損。'
  },
  {
    id: 'npc_guide', name: '歸途', role: '撤退嚮導', role_en: 'Extraction Guide',
    color: 0x27AE60, scale: 1.0, affinity: 'extraction', tex: 'assets/textures/tex_0011.png',
    greeting: '歸途帶路。逃生通道的位置我只對信得過的人說。',
    lore: '逃生通道的鑰匙在指揮部手裡。我負責把活人帶到門口。',
    situation: '通道還沒建成，前題是 research 與 comms 都到位。急不得。',
    quest: '幫指揮部湊齊「反應爐芯」「通訊模組」「基因序列」，我為你開門。'
  },
  {
    id: 'npc_commander', name: '北辰', role: '指揮官', role_en: 'Commander',
    color: 0x2C3E50, scale: 1.1, affinity: 'command', tex: 'assets/textures/tex_0012.png',
    greeting: '北辰下令。整營的命壓在我這張作戰圖上。',
    lore: '我統籌十一座設施的協同。少了任一環，這盤棋就輸。',
    situation: '敵人總攻在即。基地鏈若斷一環，營地撐不過這週。',
    quest: '按基地鏈順序推進建設——先 power，再撐起其餘十類，我給你終局授權。'
  }
];

const manifest = { note: '12 NPC 資料清單（單一真相源索引）', count: SPECS.length, npcs: [] };

for (const s of SPECS) {
  const npc = {
    id: s.id,
    name: s.name,
    role: s.role,
    role_en: s.role_en,
    base_affinity: s.affinity,
    visual: {
      color: s.color,
      shape: 'humanoid',
      scale: s.scale,
      model: s.id,
      texture: s.tex
    },
    dialogue: makeDialogue(s)
  };
  const file = join(OUT, `${s.id}.json`);
  writeFileSync(file, JSON.stringify(npc, null, 2), 'utf-8');
  manifest.npcs.push({ id: s.id, name: s.name, role: s.role, file: `assets/characters/${s.id}.json`, texture: s.tex });
  console.log('  寫入 ' + file);
}

// 合併清單（供渲染層/測試一覽）
writeFileSync(join(OUT, 'npcs.json'), JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`\n完成：生成 ${SPECS.length} 個 NPC 資料檔 + npcs.json 清單`);
