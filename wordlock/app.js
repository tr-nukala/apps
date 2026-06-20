const BANKS = window.WORDLOCK_BANKS || {};
const THEME_NAMES = ["All", ...Object.keys(BANKS)];
const SEPS = [
  {key:"-", label:"dash -"},
  {key:".", label:"dot ."},
  {key:"_", label:"underscore _"},
  {key:" ", label:"space"},
  {key:"", label:"none"}
];

// crypto-secure integer in [0, max)
function randInt(max){
  if(max<=0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % max;
}

const state = {
  theme:"All",
  count:4,
  sep:"-",
  caps:true,
  number:true,
  numberLocked:false,
  symbol:false,
  symbolLocked:false,
  leet:false,
  limitOn:false,
  maxLen:24,
  chips:[] // {word, locked}
};

let importedPool = null; // set when the user loads a wordlist file (e.g. the official EFF list)

function pool(){
  if(state.theme === "Imported" && importedPool) return importedPool;
  const raw = (state.theme === "All")
    ? Object.entries(BANKS).filter(([k])=>k!=="EFF").flatMap(([,v])=>v)
    : (BANKS[state.theme] || []);
  return [...new Set(raw)];
}
function pickWord(){ const p = pool(); return p[randInt(p.length)]; }

// ---- build static controls ----
const themesEl = document.getElementById("themes");
function selectTheme(key){
  state.theme = key;
  [...themesEl.children].forEach(c=>c.setAttribute("aria-pressed", c.dataset.theme===key));
  state.chips.forEach(c=>{ if(!c.locked) c.word = pickWord(); });
  renderTiles(); updateAll();
}
function addThemeChip(key, label){
  const b = document.createElement("button");
  b.className = "chip"; b.textContent = label || key; b.dataset.theme = key;
  b.setAttribute("aria-pressed", key === state.theme);
  b.onclick = ()=>selectTheme(key);
  themesEl.appendChild(b);
  return b;
}
THEME_NAMES.forEach(t=>addThemeChip(t));

// load a wordlist file (e.g. the official EFF list) entirely in-browser — no upload, no network
let importChip = null;
const importStatus = document.getElementById("importStatus");
document.getElementById("wordfile").onchange = (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    const words = [...new Set(
      String(reader.result).split(/\r?\n/)
        .map(l=>l.trim().split(/\s+/).pop())     // handles "11111<tab>word" or plain "word"
        .filter(w=>/^[a-z]+$/.test(w) && w.length>=3 && w.length<=12)
    )];
    if(words.length < 20){
      importStatus.className = "import-status warn";
      importStatus.textContent = "Not enough usable words (need 20+). Expect one word per line.";
      return;
    }
    importedPool = words;
    const label = "Imported (" + words.length + ")";
    if(importChip) importChip.textContent = label;
    else importChip = addThemeChip("Imported", label);
    importStatus.className = "import-status ok";
    importStatus.textContent = "Loaded " + words.length + " words · " + Math.log2(words.length).toFixed(1) + " bits per word.";
    selectTheme("Imported");
  };
  reader.onerror = ()=>{ importStatus.className="import-status warn"; importStatus.textContent="Couldn't read that file."; };
  reader.readAsText(file);
};

const sepsEl = document.getElementById("seps");
SEPS.forEach(s=>{
  const b = document.createElement("button");
  b.className="chip"; b.textContent=s.label; b.setAttribute("aria-pressed", s.key===state.sep);
  b.onclick=()=>{ state.sep=s.key; [...sepsEl.children].forEach((c,i)=>c.setAttribute("aria-pressed", SEPS[i].key===s.key)); updateAll(); };
  sepsEl.appendChild(b);
});

const countEl = document.getElementById("count");
const countVal = document.getElementById("countVal");
function syncSlider(){
  const pct = ((state.count-2)/(6-2))*100;
  countEl.style.setProperty("--pct", pct+"%");
  countVal.textContent = state.count + (state.count===1?" word":" words");
}
countEl.oninput = ()=>{
  const n = +countEl.value;
  if(n > state.count){
    while(state.chips.length < n) state.chips.push({word:pickWord(), locked:false});
  } else {
    state.chips.length = n;
  }
  state.count = n;
  syncSlider(); renderTiles(); updateAll();
};

function toggleBtn(id, key){
  const el = document.getElementById(id);
  el.onclick = ()=>{ state[key] = !state[key]; el.setAttribute("aria-pressed", state[key]); renderTiles(); updateAll(); };
}
toggleBtn("caps","caps");
toggleBtn("num","number");
toggleBtn("symbol","symbol");
toggleBtn("leet","leet");

// length limit
const limitOnEl = document.getElementById("limitOn");
const limitRow = document.getElementById("limitRow");
const maxLenEl = document.getElementById("maxLen");
const maxLenVal = document.getElementById("maxLenVal");
function syncMax(){
  const pct = ((state.maxLen-8)/(64-8))*100;
  maxLenEl.style.setProperty("--pct", pct+"%");
  maxLenVal.textContent = state.maxLen + " chars";
}
limitOnEl.onclick = ()=>{
  state.limitOn = !state.limitOn;
  limitOnEl.setAttribute("aria-pressed", state.limitOn);
  limitRow.hidden = !state.limitOn;
  if(state.limitOn){ chooseWords(unlockedIdx()); renderTiles(); }
  updateAll();
};
maxLenEl.oninput = ()=>{ state.maxLen = +maxLenEl.value; syncMax(); updateAll(); };

// ---- tiles ----
const tilesEl = document.getElementById("tiles");
const LOCK_SVG = '<svg class="lockicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const OPEN_SVG = '<svg class="lockicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.5"/></svg>';

function renderTiles(){
  tilesEl.innerHTML="";
  state.chips.forEach((chip, i)=>{
    tilesEl.appendChild(createTile({
      value: chip.word,
      locked: chip.locked,
      type: "word",
      reroll: ()=>rerollOne(i),
      toggleLock: ()=>{ chip.locked=!chip.locked; renderTiles(); }
    }));
  });
  if(state.number){
    tilesEl.appendChild(createTile({
      value: currentNumber,
      locked: state.numberLocked,
      type: "number",
      reroll: rerollNumber,
      toggleLock: ()=>{ state.numberLocked=!state.numberLocked; renderTiles(); }
    }));
  }
  if(state.symbol){
    tilesEl.appendChild(createTile({
      value: currentSymbol,
      locked: state.symbolLocked,
      type: "symbol",
      reroll: rerollSymbol,
      toggleLock: ()=>{ state.symbolLocked=!state.symbolLocked; renderTiles(); }
    }));
  }
}

function createTile({value, locked, type, reroll, toggleLock}){
  const t = document.createElement("div");
  t.className = "tile" + (type==="word"?"":" extra") + (locked?" locked":"");
  t.tabIndex = 0;
  t.setAttribute("role","button");
  t.setAttribute("aria-label", type + " " + value + (locked?", locked. Activate to unlock.":", unlocked. Activate to reroll."));
  t.innerHTML = '<span class="w"></span><span class="meta">'+(locked?LOCK_SVG+'locked':OPEN_SVG+'reroll')+'</span>';
  t.querySelector(".w").textContent = value;
  t.querySelector(".w").onclick = (e)=>{ e.stopPropagation(); if(!locked) reroll(); };
  t.querySelector(".meta").onclick = (e)=>{ e.stopPropagation(); toggleLock(); };
  t.onclick = ()=>{ if(locked) toggleLock(); else reroll(); };
  t.onkeydown = (e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); if(locked) toggleLock(); else reroll(); } };
  return t;
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tumble(indices, done){
  if(reduceMotion || indices.length===0){
    chooseWords(indices);
    renderTiles(); if(done) done(); updateAll(); return;
  }
  const tiles = [...tilesEl.children];
  indices.forEach(i=>tiles[i] && tiles[i].classList.add("tumbling"));
  let frame=0; const frames=7;
  const iv = setInterval(()=>{
    indices.forEach(i=>{ const w=tiles[i]&&tiles[i].querySelector(".w"); if(w) w.textContent=pickWord(); });
    frame++;
    if(frame>=frames){
      clearInterval(iv);
      chooseWords(indices);
      renderTiles(); if(done) done(); updateAll();
    }
  }, 55);
}

function rerollOne(i){ tumble([i]); }

function randomNumber(){ return String(randInt(90)+10); }
function randomSymbol(){ return SYMBOLS[randInt(SYMBOLS.length)]; }
function rerollNumber(){ if(!state.numberLocked){ currentNumber = randomNumber(); renderTiles(); updateAll(); } }
function rerollSymbol(){ if(!state.symbolLocked){ currentSymbol = randomSymbol(); renderTiles(); updateAll(); } }

document.getElementById("generate").onclick = ()=>{
  const btn = document.getElementById("generate");
  btn.classList.add("spin"); setTimeout(()=>btn.classList.remove("spin"),500);
  if(state.number && !state.numberLocked) currentNumber = randomNumber();
  if(state.symbol && !state.symbolLocked) currentSymbol = randomSymbol();
  const idx = state.chips.map((c,i)=>c.locked?-1:i).filter(i=>i>=0);
  tumble(idx);
};

// ---- assemble + entropy ----
function titleCase(w){ return w.charAt(0).toUpperCase()+w.slice(1); }

function assemble(){
  let words = state.chips.map(c=>state.caps?titleCase(c.word):c.word);
  let tokens = [...words];
  let numStr = "";
  if(state.number){ numStr = String(randInt(90)+10); tokens.push(numStr); }
  const sep = state.sep;
  return tokens.join(sep);
}
// keep the appended number stable between renders unless regenerated
let currentNumber = randomNumber();

// symbols broadly accepted by login forms; entropy is computed from the real set size
const SYMBOLS = "!@#$%^&*?+-=_~";
let currentSymbol = randomSymbol();

const LEET = {a:"@", s:"$", o:"0"};
function applyLeet(str){ return state.leet ? str.replace(/[aso]/g, c=>LEET[c]) : str; }

function assembleStable(){
  let words = state.chips.map(c=>state.caps?titleCase(c.word):c.word);
  let tokens = [...words];
  if(state.number) tokens.push(currentNumber);
  if(state.symbol) tokens.push(currentSymbol);
  return applyLeet(tokens.join(state.sep));
}

function currentLength(){ return assembleStable().length; }
function unlockedIdx(){ return state.chips.map((c,i)=>c.locked?-1:i).filter(i=>i>=0); }

// assign new words to the given unlocked tiles; if a length cap is on,
// re-draw the whole unlocked set until the phrase fits (never truncates)
function chooseWords(indices){
  if(!state.limitOn || indices.length===0){
    indices.forEach(i=>state.chips[i].word=pickWord());
    return;
  }
  let attempts=0;
  do{
    indices.forEach(i=>state.chips[i].word=pickWord());
    attempts++;
  } while(currentLength() > state.maxLen && attempts < 120);
}

function entropyBits(){
  const N = pool().length;
  let bits = state.count * Math.log2(N);
  if(state.number) bits += Math.log2(90); // 2-digit number 10..99
  if(state.symbol) bits += Math.log2(SYMBOLS.length); // one random symbol — real entropy
  return bits;
}

function humanTime(seconds){
  if(seconds < 1) return "instantly";
  const units = [["year",31557600],["day",86400],["hour",3600],["minute",60],["second",1]];
  if(seconds > 31557600*1000){
    const y = seconds/31557600;
    if(y > 1e12) return "trillions of years";
    if(y > 1e9) return "billions of years";
    if(y > 1e6) return "millions of years";
    if(y > 1e3) return Math.round(y/1e3) + " thousand years";
    return Math.round(y).toLocaleString() + " years";
  }
  for(const [name,secs] of units){
    if(seconds >= secs){ const v=Math.round(seconds/secs); return v+" "+name+(v!==1?"s":""); }
  }
  return "instantly";
}

function updateMeter(){
  const bits = entropyBits();
  const fill = document.getElementById("meterFill");
  const label = document.getElementById("meterLabel");
  const stats = document.getElementById("meterStats");
  const crack = document.getElementById("crack");

  let color, text;
  if(bits < 40){ color="var(--weak)"; text="Weak"; }
  else if(bits < 60){ color="var(--fair)"; text="Fair"; }
  else if(bits < 80){ color="var(--strong)"; text="Strong"; }
  else { color="var(--exc)"; text="Excellent"; }

  const pct = Math.min(100, (bits/100)*100);
  fill.style.width = pct+"%";
  fill.style.background = color;
  label.textContent = text;
  label.style.color = color;
  stats.textContent = bits.toFixed(1)+" bits · 1 in "+(bits>120?"astronomical":Math.pow(2,bits).toExponential(1));

  // offline attacker at 10 billion guesses/sec, average = half the space
  const avg = Math.pow(2, bits-1);
  const seconds = avg / 1e10;
  crack.innerHTML = "Time to crack offline (10B guesses/sec): <b>"+humanTime(seconds)+"</b>";
}

function updateOutput(){
  document.getElementById("output").textContent = assembleStable() || "—";
}

function updateLen(){
  const len = currentLength();
  const el = document.getElementById("lenline");
  if(state.limitOn){
    const over = len - state.maxLen;
    if(over > 0){
      el.className = "lenline over";
      el.textContent = len + " characters · over limit by " + over + " — drop a word or unlock more to reroll";
    } else {
      el.className = "lenline";
      el.textContent = len + " / " + state.maxLen + " characters";
    }
  } else {
    el.className = "lenline";
    el.textContent = len + " characters";
  }
}

function updateAll(){
  updateOutput(); updateMeter(); updateLen(); updateSay();
}

function updateSay(){
  const el = document.getElementById("say");
  let t, c;
  if(state.leet){
    t = "Tricky to say aloud — symbols sit inside the words"; c = "var(--fair)";
  } else if(state.symbol || state.number){
    t = "Easy to say — just a tail character to remember"; c = "var(--strong)";
  } else {
    t = "Easy to say aloud — all real words"; c = "var(--exc)";
  }
  el.textContent = "🗣  " + t;
  el.style.color = c;
}

// ---- copy ----
const copyBtn = document.getElementById("copy");
copyBtn.onclick = async ()=>{
  try{
    await navigator.clipboard.writeText(assembleStable());
    copyBtn.textContent="Copied"; copyBtn.classList.add("done");
    setTimeout(()=>{ copyBtn.textContent="Copy"; copyBtn.classList.remove("done"); }, 1400);
  }catch(e){
    copyBtn.textContent="Press Ctrl+C";
    setTimeout(()=>copyBtn.textContent="Copy", 1600);
  }
};

// ---- saved phrases ----
const SAVE_KEY = "wordlock:saved";
let saved = [];
let persistent = false;

// some contexts (private mode, sandboxed previews) block localStorage and throw on access
function storageAvailable(){
  try{
    const t = "__wl_test__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    return true;
  }catch(e){ return false; }
}

function loadSaved(){
  persistent = storageAvailable();
  if(persistent){
    try{
      const r = localStorage.getItem(SAVE_KEY);
      saved = r ? JSON.parse(r) : [];
    }catch(e){ saved = []; }
  }
  renderSaved();
}

function persist(){
  if(!persistent) return;
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); }catch(e){}
}

const saveBtn = document.getElementById("save");
saveBtn.onclick = ()=>{
  const phrase = assembleStable();
  if(!phrase || phrase === "—") return;
  if(saved.some(s=>s.phrase === phrase)){
    saveBtn.textContent = "Saved already"; setTimeout(()=>saveBtn.textContent="Save", 1200); return;
  }
  saved.unshift({phrase, bits:+entropyBits().toFixed(0)});
  if(saved.length > 50) saved.length = 50;
  saveBtn.textContent = "Saved ✓"; setTimeout(()=>saveBtn.textContent="Save", 1200);
  renderSaved(); persist();
};

function renderSaved(){
  const list = document.getElementById("savedList");
  const empty = document.getElementById("savedEmpty");
  const note = document.getElementById("savedNote");
  list.innerHTML = "";
  empty.style.display = saved.length ? "none" : "block";

  saved.forEach((s, i)=>{
    const row = document.createElement("div");
    row.className = "saved-item";
    const phrase = document.createElement("span");
    phrase.className = "saved-phrase"; phrase.textContent = s.phrase;
    const bits = document.createElement("span");
    bits.className = "saved-bits"; bits.textContent = s.bits + " bits";
    const copy = document.createElement("button");
    copy.className = "icon-btn"; copy.textContent = "Copy";
    copy.onclick = async ()=>{
      try{ await navigator.clipboard.writeText(s.phrase); copy.textContent="Copied"; setTimeout(()=>copy.textContent="Copy",1100); }
      catch(e){ copy.textContent="Ctrl+C"; setTimeout(()=>copy.textContent="Copy",1100); }
    };
    const del = document.createElement("button");
    del.className = "icon-btn danger"; del.textContent = "Remove";
    del.setAttribute("aria-label", "Remove saved phrase");
    del.onclick = ()=>{ saved.splice(i,1); renderSaved(); persist(); };
    row.append(phrase, bits, copy, del);
    list.appendChild(row);
  });

  note.textContent = saved.length
    ? (persistent
        ? "Saved in this browser on your device, kept between visits. Stored as plaintext — move your final pick into a real password manager."
        : "This browser is blocking local storage, so saves last for this session only. Either way, move your final pick into a real password manager.")
    : "";
}

// ---- init ----
function init(){
  state.chips = Array.from({length:state.count}, ()=>({word:pickWord(), locked:false}));
  syncSlider(); syncMax(); renderTiles(); updateAll();
  loadSaved();
}
init();
