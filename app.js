const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// app booted, so CSS/JS loaded fine — drop the "missing files" notice
$('loaderr')?.remove();

// ---------- 离线 App 模式 ----------
// 单文件版 (workbench.html) 内嵌 <meta name="x-standalone" content="1">。
// 此模式下: 不依赖服务器。数据优先级 = localStorage 缓存(离线也能看最新) > 内嵌快照。
// 连网时点"检查更新"从固定地址拉最新单文件, 抽数据缓存并就地渲染。
const STANDALONE = !!document.querySelector('meta[name="x-standalone"]');
const CACHE_KEY = 'workbench_data_v1';
function cacheSave(ai, de, vocab) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ai, de, vocab, ts: Date.now() })); } catch {}
}
function cacheLoad() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

// ---------- nav ----------
const sidebar = $('sidebar');
const scrim = $('scrim');
const setDrawer = open => {
  sidebar.classList.toggle('open', open);
  scrim.classList.toggle('show', open);
};
$('menuBtn').onclick = () => setDrawer(!sidebar.classList.contains('open'));
scrim.onclick = () => setDrawer(false);

function showView(view) {
  const btn = document.querySelector(`.navitem[data-view="${view}"]`);
  if (!btn) return false;
  document.querySelectorAll('.navitem').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  $('view-' + view).classList.add('active');
  $('title').textContent = btn.textContent.trim();
  setDrawer(false);
  return true;
}
document.querySelectorAll('.navitem').forEach(b => b.onclick = () => {
  showView(b.dataset.view);
  history.replaceState(null, '', '#' + b.dataset.view);
});
showView((location.hash || '').slice(1)) || showView('ai');
addEventListener('hashchange', () => showView((location.hash || '').slice(1)));

// embedded fallback so file:// works without a server
function embedded(id) {
  const el = $(id);
  try { return el ? JSON.parse(el.textContent) : null; } catch { return null; }
}
// 数据来源: standalone -> 缓存优先, 否则内嵌; server -> 先 fetch 再内嵌
async function load(url, embedId) {
  if (STANDALONE) {
    const key = embedId.replace('embed-', '');
    const c = cacheLoad();
    if (c && c[key]) return c[key];
    return embedded(embedId);
  }
  try {
    const r = await fetch(url + '?t=' + Date.now());
    if (!r.ok) throw 0;
    return await r.json();
  } catch {
    return embedded(embedId);
  }
}

// 检查更新 (standalone): 拉固定地址最新单文件, 抽数据缓存并渲染
async function checkUpdate() {
  if (!STANDALONE) return;
  const btn = $('update-btn');
  if (btn) { btn.disabled = true; btn.textContent = '↻ 更新中…'; }
  try {
    const html = await (await fetch('https://workbench.serveousercontent.com/workbench.html', { cache: 'no-store' })).text();
    const grab = id => {
      const m = html.match(new RegExp('<script id="' + id + '"[^>]*>([\\s\\S]*?)</script>'));
      if (!m) return null;
      try { return JSON.parse(m[1].replace(/<\\//g, '</')); } catch { return null; }
    };
    const ai = grab('embed-ai'), de = grab('embed-de'), vocab = grab('embed-vocab');
    if (ai && de && vocab) {
      cacheSave(ai, de, vocab);
      renderAI(ai); renderDE(de);
      FC.all = (vocab.cards) || []; buildDeck();
      if (btn) { btn.textContent = '✓ 已是最新'; setTimeout(() => { btn.textContent = '检查更新'; btn.disabled = false; }, 1500); }
    } else if (btn) { btn.textContent = '检查更新'; btn.disabled = false; }
  } catch {
    if (btn) { btn.textContent = '检查更新'; btn.disabled = false; }
  }
}

// safe storage: on file:// (AirDrop / phone) localStorage throws SecurityError,
// so fall back to an in-memory object that never crashes the page
const store = (() => {
  try { localStorage.getItem('__t'); return localStorage; }
  catch { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }
})();

// ---------- AI ----------
function renderAI(d) {
  const el = $('ai-list');
  if (!d || !d.items || !d.items.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
  $('ai-date').textContent = '更新于 ' + (d.updated || '—');
  el.innerHTML = d.items.map(i => `<div class="card">
      <h3>${esc(i.title)}</h3>
      <div class="src">${esc(i.source || '')}${i.date ? ' · ' + esc(i.date) : ''}</div>
      <div>${esc(i.summary || '')}</div>
      ${i.url ? `<div style="margin-top:10px"><a href="${esc(i.url)}" target="_blank" rel="noopener">阅读原文 →</a></div>` : ''}
    </div>`).join('');
}

// ---------- German ----------
function renderDE(d) {
  const el = $('de-list');
  if (!d || !d.items || !d.items.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
  $('de-date').textContent = '更新于 ' + (d.updated || '—');
  el.innerHTML = d.items.map((i, n) => `<div class="card">
      <div class="src">第 ${n + 1} 条 ${i.cat ? `<span class="tag">${esc(i.cat)}</span>` : ''}
        ${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.source || '')}</a>` : esc(i.source || '')}${i.date ? ' · ' + esc(i.date) : ''}</div>
      <p class="de-sent">${esc(i.de)}</p>
      <p class="de-cn">${esc(i.cn)}</p>
      <table class="words">${(i.words || []).map(w =>
    `<tr><td>${esc(w.w)}</td><td>${esc(w.m)}</td></tr>`).join('')}</table>
      ${i.grammar ? `<div class="gram"><b>语法 / Grammar:</b> ${esc(i.grammar)}</div>` : ''}
    </div>`).join('');
}

// 刷新按钮: standalone 模式 -> 检查更新; 服务器模式 -> 触发 /refresh 或 reload
const FEEDS = [
  { btn: 'ai-refresh', url: 'data/ai.json', embed: 'embed-ai', render: renderAI, live: true },
  { btn: 'de-refresh', url: 'data/german.json', embed: 'embed-de', render: renderDE, live: false }
];
FEEDS.forEach(({ btn, url, embed, render, live }) => {
  load(url, embed).then(render);
  const b = $(btn);
  b.onclick = async () => {
    if (STANDALONE) { checkUpdate(); return; }
    const label = b.textContent;
    b.disabled = true; b.textContent = '↻ 抓取中…';
    if (live && location.protocol !== 'file:') {
      try {
        const r = await fetch('/refresh', { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (j && j.status === 'started') {
          b.textContent = '↻ 已触发，刷新中…';
          setTimeout(() => location.reload(), 4000);
          return;
        }
      } catch { /* 服务不可用就退回本地重载 */ }
    }
    location.reload();
  };
});

// ---------- streak ----------
const todayKey = () => new Date().toISOString().slice(0, 10);
function renderStreak() {
  const s = JSON.parse(store.getItem('de_streak') || '{"last":"","n":0}');
  $('de-streak').textContent =
    `连续 ${s.n} 天` + (s.last === todayKey() ? ' ✓ 今天已打卡' : '');
}
$('de-done').onclick = () => {
  const s = JSON.parse(store.getItem('de_streak') || '{"last":"","n":0}');
  const t = todayKey();
  if (s.last === t) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  s.n = (s.last === y) ? s.n + 1 : 1;
  s.last = t;
  store.setItem('de_streak', JSON.stringify(s));
  renderStreak();
};
renderStreak();

// service worker 只在服务器模式注册 (standalone 离线版不需要)
if (!STANDALONE && 'serviceWorker' in navigator && location.protocol !== 'file:')
  navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- Flashcards ----------
const FC = {
  deck: [], i: 0, ok: 0, no: 0, flipped: false, dirOf: 'de2en', card: null, artAnswered: null
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

load('data/vocab.json', 'embed-vocab').then(d => {
  FC.all = (d && d.cards) || [];
  buildDeck();
});

function buildDeck() {
  const scope = $('fc-src').value;
  let pool = FC.all.filter(c => {
    if (scope === 'all') return true;
    if (scope === 'noun') return !!c.art;
    if (scope === 'news') return c.src === 'news';
    if (scope === 'A2') return c.lvl === 'A2';
    return true;
  });
  FC.deck = shuffle(pool.slice());
  FC.i = 0; FC.ok = 0; FC.no = 0;
  $('fc-done').hidden = true;
  $('fc-card').style.display = '';
  showCard();
  updateStats();
}

function updateStats() {
  $('fc-ok').textContent = FC.ok;
  $('fc-no').textContent = FC.no;
  $('fc-left').textContent = Math.max(0, FC.deck.length - FC.i);
}

function showCard() {
  const c = FC.deck[FC.i];
  FC.card = c;
  FC.flipped = false;
  FC.artAnswered = null;
  $('fc-card').classList.remove('flip');
  $('fc-grade').hidden = true;
  $('fc-tap').hidden = false;

  if (!c) {
    $('fc-card').style.display = 'none';
    $('fc-grade').hidden = true;
    $('fc-done').hidden = false;
    return;
  }

  const mode = $('fc-dir').value;
  const dir = mode === 'mix' ? (Math.random() < 0.5 ? 'de2en' : 'en2de') : mode;
  FC.dirOf = dir;

  const artBox = $('fc-art');
  [...artBox.querySelectorAll('button')].forEach(b => {
    b.className = ''; b.disabled = false;
  });

  if (dir === 'de2en') {
    $('fc-q').textContent = c.de;
    $('fc-hint').textContent = c.art ? '名词 · 先选冠词，再翻面看意思' : '想一想英文意思';
    artBox.hidden = !c.art;
  } else {
    $('fc-q').textContent = c.en;
    $('fc-hint').textContent = c.art ? '名词 · 先选冠词，再翻面看德语' : '想一想德语怎么说';
    artBox.hidden = !c.art;
  }
}

function backText() {
  const c = FC.card;
  if (!c) return;
  const full = c.art ? `${c.art} ${c.de}` : c.de;
  $('fc-a').textContent = FC.dirOf === 'de2en' ? c.en : full;
  const bits = [];
  if (FC.dirOf === 'de2en' && c.art) bits.push(`正确冠词：<b>${c.art} ${c.de}</b>`);
  if (FC.dirOf === 'en2de') bits.push(`英文：${c.en}`);
  bits.push(`中文：${c.cn}`);
  if (c.pl && c.pl !== '—') bits.push(`复数：die ${c.pl}`);
  if (c.note) bits.push(`提示：${c.note}`);
  $('fc-extra').innerHTML = bits.join('<br>');
}

function flip() {
  if (!FC.card || FC.flipped) return;
  FC.flipped = true;
  backText();
  $('fc-card').classList.add('flip');
  $('fc-grade').hidden = false;
  $('fc-tap').hidden = true;
}

$('fc-card').addEventListener('click', e => {
  if (e.target.closest('.artrow')) return;
  flip();
});

$('fc-art').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn || !FC.card || FC.artAnswered) return;
  FC.artAnswered = btn.dataset.art;
  const right = FC.card.art;
  [...$('fc-art').querySelectorAll('button')].forEach(b => {
    if (b.dataset.art === right) b.className = 'right';
    else if (b === btn) b.className = 'wrong';
    b.disabled = true;
  });
  if (FC.artAnswered !== right) FC.no++;
  updateStats();
});

$('fc-grade').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const artWrong = FC.card && FC.card.art && FC.artAnswered && FC.artAnswered !== FC.card.art;
  const known = btn.dataset.g === '1' && !artWrong;

  if (known) {
    FC.ok++;
  } else {
    if (!artWrong) FC.no++;
    const gap = Math.min(4 + Math.floor(Math.random() * 3), FC.deck.length - FC.i);
    FC.deck.splice(FC.i + gap, 0, FC.card);
  }
  FC.i++;
  showCard();
  updateStats();
});

$('fc-reset').onclick = buildDeck;
$('fc-dir').onchange = buildDeck;
$('fc-src').onchange = buildDeck;

// keyboard: space = flip, 1 = 不会, 2 = 会了
addEventListener('keydown', e => {
  if (!$('view-fc').classList.contains('active')) return;
  if (e.code === 'Space') { e.preventDefault(); flip(); }
  if (FC.flipped && (e.key === '1' || e.key === '2')) {
    $('fc-grade').querySelector(e.key === '2' ? '.good' : '.bad').click();
  }
});
