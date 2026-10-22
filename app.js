/* 주제30 「1815~1848 역할 일기」 웹앱 — 로직(app.js) */
const CONFIG = {
  SHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec",
  /* 포털 커리큘럼 관리에 이 id 하나로 활동을 등록한다 */
  GAME_NAME: "30차시_역할일기_1815_1848",
  DRAW_COUNT: 2
};

const S = {
  sid: "", name: "", grade: 0, ban: 0, preview: false,
  cards: [], chosen: "", fact: -1,
  sending: false, submitted: false, padletUrl: ""
};

/* 화면 목록: stage는 위쪽 4단계 막대 */
const SCREENS = { s0: "", s1: "draw", s2: "fact", s3: "write", s4: "wrap" };
const STAGES = ["draw", "fact", "write", "wrap"];

const $ = id => document.getElementById(id);
const byId = (arr, id) => arr.find(x => x.id === id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function show(key) {
  Object.keys(SCREENS).forEach(k => { $(k).hidden = (k !== key); });
  const stage = SCREENS[key];
  $("steps").hidden = !stage;
  const cur = STAGES.indexOf(stage);
  document.querySelectorAll("#steps li").forEach(li => {
    const i = STAGES.indexOf(li.dataset.k);
    li.className = i === cur ? "on" : (i < cur ? "done" : "");
  });
  window.scrollTo(0, 0);
}

function parseSid(sid) {
  if (!/^\d{5}$/.test(sid)) return null;
  return { grade: Number(sid[0]), ban: Number(sid.slice(1, 3)), num: Number(sid.slice(3)) };
}

function knowText(card) { return "내가 아는 건 " + card.knowUntil + "까지"; }
function factText(f) { return f.t + " (" + f.p + "쪽)"; }
function chosenCard() { return byId(CARDS, S.chosen); }
function chosenFact() { const c = chosenCard(); return c && S.fact >= 0 ? c.facts[S.fact] : null; }

/* ── 뽑은 카드 기억: 새로고침해도 같은 카드(재뽑기 없음). 학번별 키라 공용 태블릿에서 안 섞인다.
 *    미리보기에선 저장하지 않는다(교사가 새로고침으로 여러 카드를 볼 수 있게). 글은 draft_guard가 따로 맡는다. */
function storeKey() { return "vienna_diary:" + CONFIG.GAME_NAME + ":" + S.sid; }

function loadPick() {
  if (S.preview) return;
  try {
    const v = JSON.parse(localStorage.getItem(storeKey()) || "null");
    if (!v || !Array.isArray(v.cards) || v.cards.length !== CONFIG.DRAW_COUNT) return;
    if (!v.cards.every(id => byId(CARDS, id))) return;
    S.cards = v.cards;
    S.chosen = v.cards.indexOf(v.chosen) >= 0 ? v.chosen : "";
    const c = chosenCard();
    S.fact = c && v.fact >= 0 && v.fact < c.facts.length ? v.fact : -1;
  } catch (e) { /* 저장소가 막히면 메모리만 */ }
}

function savePick() {
  if (S.preview) return;
  try {
    localStorage.setItem(storeKey(), JSON.stringify({ cards: S.cards, chosen: S.chosen, fact: S.fact, ts: Date.now() }));
  } catch (e) { /* 저장소가 막히면 메모리만 */ }
}

/* ── 시트 전송 ── */
async function postToSheet(payload) {
  if (S.preview) return { result: "success", preview: true };
  const res = await fetch(CONFIG.SHEET_WEBAPP_URL, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.result !== "success") {
    const err = new Error(json.message || "저장 실패");
    err.locked = !!json.locked;
    throw err;
  }
  return json;
}

/* 패들렛 링크는 백엔드 학년정보(포트폴리오)에서 가져온다. 반 정보가 든 링크라 레포에 적지 않는다. */
function ensureUrlScheme(u) {
  u = String(u || "").trim();
  return u && !/^https?:\/\//i.test(u) ? "https://" + u : u;
}

async function loadPadletUrl(grade, ban) {
  try {
    const res = await fetch(CONFIG.SHEET_WEBAPP_URL + "?mode=curriculum");
    const json = await res.json();
    const pf = json && json.grades && json.grades[String(grade)] && json.grades[String(grade)].portfolio;
    if (!pf) return "";
    return ensureUrlScheme(pf.urlByBan ? (pf.urlByBan[ban] || pf.urlByBan[String(ban)] || "") : (pf.url || ""));
  } catch (e) {
    return "";
  }
}

/* ── 시작 ── */
function startApp() {
  const sid = $("sid").value.trim();
  const name = $("sname").value.trim();
  const p = parseSid(sid);
  if (!p) { $("startErr").textContent = "학번은 숫자 5자리로 써 줘. (예: 20512)"; return; }
  if (!name) { $("startErr").textContent = "이름을 써 줘."; return; }
  $("startErr").textContent = "";
  S.sid = sid; S.name = name; S.grade = p.grade; S.ban = p.ban;
  FocusGuard.start({ key: CONFIG.GAME_NAME + ":" + sid }); // 작성 중 화면 이탈·붙여넣기 기록 (history26 snippets/focus_guard.js)
  if (window.DraftGuard) DraftGuard.start({ key: CONFIG.GAME_NAME, sid: sid }); // 글쓰기 칸 임시저장 (history26 v75)
  clearBoilerplate();
  loadPadletUrl(p.grade, p.ban).then(u => { S.padletUrl = u; renderPadlet(); });
  loadPick();
  renderDraw(false);
  show("s1");
}

/* ── 1. 뽑기 ── */
function drawCards() {
  if (S.cards.length) return; // 재뽑기 없음
  const pool = CARDS.map(c => c.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  S.cards = pool.slice(0, CONFIG.DRAW_COUNT);
  S.chosen = ""; S.fact = -1;
  savePick();
  renderDraw(true);
}

function cardEl(card, animate, idx) {
  const b = el("button", "flip");
  b.type = "button";
  b.setAttribute("aria-pressed", S.chosen === card.id ? "true" : "false");
  b.setAttribute("aria-label", card.role + ", " + knowText(card));
  const inner = el("div", "flip-inner");
  const back = el("div", "face back");
  back.appendChild(el("span", "back-mark", "1815–1848"));
  const front = el("div", "face front");
  front.appendChild(el("span", "front-kicker", "역할 카드"));
  front.appendChild(el("span", "front-role", card.role));
  front.appendChild(el("span", "front-know", knowText(card)));
  front.appendChild(el("span", "front-pick", "이 사람으로 할래"));
  inner.appendChild(back); inner.appendChild(front);
  b.appendChild(inner);
  if (animate) setTimeout(() => b.classList.add("flipped"), 250 + idx * 350);
  else b.classList.add("flipped");
  b.addEventListener("click", () => {
    if (!b.classList.contains("flipped")) return;
    if (S.chosen !== card.id) { S.chosen = card.id; S.fact = -1; savePick(); }
    $("drawArea").querySelectorAll(".flip").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    $("s1Err").textContent = "";
  });
  return b;
}

function renderDraw(animate) {
  const has = S.cards.length > 0;
  $("drawBtn").hidden = has;
  $("drawArea").hidden = !has;
  $("drawNote").textContent = has
    ? "둘 중 1장을 눌러서 골라. 카드는 다시 뽑을 수 없어."
    : "카드 2장이 나와. 그중 1장을 골라 그 사람이 되어 보자.";
  $("drawArea").innerHTML = "";
  S.cards.forEach((id, i) => $("drawArea").appendChild(cardEl(byId(CARDS, id), animate, i)));
}

/* ── 2. 사실 고르기 ── */
function roleTag(box) {
  const c = chosenCard();
  box.innerHTML = "";
  box.appendChild(el("span", "role-name", c.role));
  box.appendChild(el("span", "role-know", knowText(c)));
}

function renderFacts() {
  const c = chosenCard();
  roleTag($("s2Role"));
  const list = $("factList");
  list.innerHTML = "";
  list.setAttribute("role", "radiogroup");
  c.facts.forEach((f, i) => {
    /* 버튼 대신 role=radio div — 버튼 안은 glossary.js가 밑줄을 못 긋는다 */
    const row = el("div", "fact-opt");
    row.setAttribute("role", "radio");
    row.tabIndex = 0;
    row.setAttribute("aria-checked", S.fact === i ? "true" : "false");
    row.appendChild(el("span", "fact-box"));
    const p = el("p", "fact-text");
    p.appendChild(document.createTextNode(f.t + " "));
    p.appendChild(el("span", "pg", "(" + f.p + "쪽)"));
    row.appendChild(p);
    const pick = e => {
      if (e.target.closest && e.target.closest(".term")) return; // 낱말 풀이를 누른 건 선택으로 치지 않는다
      S.fact = i; savePick();
      list.querySelectorAll(".fact-opt").forEach(r => r.setAttribute("aria-checked", r === row ? "true" : "false"));
      $("s2Err").textContent = "";
    };
    row.addEventListener("click", pick);
    row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e); } });
    list.appendChild(row);
  });
}

/* ── 3. 쓰기 ── */
function buildParts() {
  const box = $("partBox");
  PARTS.forEach(pt => {
    const card = el("div", "part");
    const lab = el("label", "part-label", pt.label);
    lab.htmlFor = pt.id;
    card.appendChild(lab);
    card.appendChild(el("p", "part-guide", pt.guide));
    const d = el("details", "hint");
    d.appendChild(el("summary", "", "💡 막막하면 힌트 보기"));
    d.appendChild(el("p", "", pt.hint));
    card.appendChild(d);
    const ta = el("textarea", "lined");
    ta.id = pt.id; ta.rows = pt.rows;
    ta.placeholder = pt.ph || "";
    const cnt = el("div", "count");
    const upd = () => { cnt.textContent = ta.value.trim().length + "자"; };
    ta.addEventListener("input", () => { upd(); $("s3Err").textContent = ""; });
    upd();
    card.appendChild(ta);
    card.appendChild(cnt);
    box.appendChild(card);
  });
}

function renderWriteHead() {
  roleTag($("s3Role"));
  $("s3Fact").textContent = factText(chosenFact());
}

/* 임시저장에서 되살아난 안내 문구는 비운다 */
function clearBoilerplate() {
  PARTS.forEach(pt => {
    const t = $(pt.id);
    if (t.value && isBoilerplate(t.value)) { t.value = ""; t.dispatchEvent(new Event("input", { bubbles: true })); }
  });
}

function partValue(id) { return $(id).value.trim(); }

/* 안내·예시 문구(옛 버전 포함)가 칸에 들어간 경우를 가려낸다 */
const OLD_TEXTS = ["고른 사실을 내 말로 (1~2문장)", "여기에 일기를 써 줘.", "여기에 써 줘."];
function isBoilerplate(v) {
  const s = squash(v);
  if (s.length < 3) return false;
  const pool = PARTS.flatMap(pt => [pt.label, pt.guide, pt.ph || "", pt.hint]).concat(FRAME_NOTES, OLD_TEXTS);
  return pool.some(t => squash(t).includes(s));
}

const squash = t => t.replace(/[\s.,'"‘’“”「」()]/g, "");

function checkParts() {
  for (const pt of PARTS) {
    if (partValue(pt.id).length < pt.min) return pt.label.slice(0, 1) + " 칸을 조금 더 써 줘.";
  }
  /* 안내 문구를 그대로 낸 글은 돌려보낸다 */
  for (const pt of PARTS) {
    const v = squash(partValue(pt.id));
    if (v === squash(pt.guide) || v === squash(pt.ph || "")) return pt.label.slice(0, 1) + " 칸에 내 글을 써 줘.";
  }
  /* 교과서 문장을 그대로 옮긴 글은 돌려보낸다 */
  const fact = squash(chosenFact().t);
  if (squash(partValue("partEvent")).includes(fact.slice(0, Math.min(fact.length, 18)))) {
    return "① 칸에 교과서 문장을 그대로 옮겼어. 내 말로 바꿔 써 줘.";
  }
  return "";
}

/* ── 4. 마무리 ── */
function diaryBody() { return PARTS.map(pt => partValue(pt.id)).join("\n\n"); }
function diaryWithFact() { return "오늘 고른 사실: " + factText(chosenFact()) + "\n\n" + diaryBody(); } // 제출 본문(G열)

function buildOutText() {
  const c = chosenCard();
  return [
    "[1815~1848 역할 일기] " + S.sid + " " + S.name,
    "나는 " + c.role + ". (" + knowText(c) + ")",
    "오늘 고른 사실: " + factText(chosenFact()),
    "",
    diaryBody()
  ].join("\n");
}

function renderDiary() {
  const c = chosenCard();
  const box = $("diary");
  box.innerHTML = "";
  const who = el("div", "diary-who");
  who.appendChild(el("span", "role-name", c.role));
  who.appendChild(el("span", "role-know", knowText(c)));
  box.appendChild(who);
  box.appendChild(el("div", "diary-fact", "오늘 고른 일: " + factText(chosenFact())));
  PARTS.forEach((pt, i) => {
    box.appendChild(el("p", "diary-p", partValue(pt.id)));
    if (i < PARTS.length - 1) box.appendChild(el("div", "diary-gap"));
  });
  $("submitBtn").disabled = S.submitted;
  $("submitBtn").textContent = S.submitted ? "제출 완료" : "제출";
  renderPadlet();
}

function renderPadlet() {
  const a = $("padletBtn");
  if (S.padletUrl) {
    a.href = S.padletUrl; a.hidden = false; $("padletMsg").textContent = "";
  } else {
    a.hidden = true; $("padletMsg").textContent = "패들렛 링크는 선생님이 알려 준 곳을 써 줘.";
  }
}

async function submitDiary() {
  if (S.sending || S.submitted) return;
  const err = checkParts();
  if (err) { $("s4Err").textContent = err; return; }
  $("s4Err").textContent = "";
  S.sending = true; $("submitBtn").disabled = true; $("submitBtn").textContent = "보내는 중…";
  const c = chosenCard(), f = chosenFact();
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_NAME,
    choiceSummary: c.role + " / " + factText(f), diffSummary: "",
    reflection: diaryWithFact(), // 시트 G열: 고른 사실 + ①②③ 합본
    choicesJson: JSON.stringify({
      sid: S.sid, name: S.name, ban: S.ban,
      drawn: S.cards, cardId: c.id, factIndex: S.fact, fact: factText(f),
      parts: PARTS.reduce((o, pt) => { o[pt.id] = partValue(pt.id); return o; }, {}),
      ts: new Date().toISOString()
    })
  };
  Object.assign(payload, FocusGuard.payload());
  try {
    await postToSheet(payload);
  } catch (e) {
    $("s4Err").textContent = e.locked ? e.message : "저장이 안 됐어. 인터넷을 확인하고 다시 눌러 줘.";
    S.sending = false; $("submitBtn").disabled = false; $("submitBtn").textContent = "제출";
    return;
  }
  S.sending = false; S.submitted = true;
  if (window.DraftGuard) DraftGuard.clear(); // 저장 성공 → 임시저장 삭제
  $("submitBtn").textContent = "제출 완료";
  $("outMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : "제출했어! 이제 글 복사를 눌러 패들렛에 올려 줘.";
}

async function copyOut() {
  const text = buildOutText();
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = el("textarea");
    ta.value = text; ta.setAttribute("data-no-draft", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  $("outMsg").textContent = S.submitted
    ? "복사했어. 패들렛에 붙여넣기 해."
    : "복사했어. 제출 버튼도 꼭 눌러 줘!";
}

/* ── 화면 이동 ── */
function goFact() {
  if (!S.chosen) { $("s1Err").textContent = S.cards.length ? "카드 1장을 골라 줘." : "먼저 카드를 뽑아 줘."; return; }
  renderFacts(); show("s2");
}

function goWrite() {
  if (S.fact < 0) { $("s2Err").textContent = "일기에 쓸 사실 1개를 골라 줘."; return; }
  renderWriteHead(); show("s3");
}

function goWrap() {
  const err = checkParts();
  if (err) { $("s3Err").textContent = err; return; }
  renderDiary(); show("s4");
}

/* ── 부팅 (모든 함수 선언 뒤, 파일 맨 마지막) ── */
function init() {
  const q = new URLSearchParams(location.search);
  S.preview = q.get("preview") === "1";
  let sid = (q.get("sid") || "").trim(), name = (q.get("name") || "").trim();
  if (S.preview) {
    $("previewBar").hidden = false;
    if (!sid) sid = "20512";
    if (!name) name = "미리보기";
  }
  $("sid").value = sid; $("sname").value = name;

  $("frameNote").innerHTML = "";
  FRAME_NOTES.forEach(t => $("frameNote").appendChild(el("p", "", t)));
  buildParts();

  $("startBtn").addEventListener("click", startApp);
  $("drawBtn").addEventListener("click", drawCards);
  $("s1Next").addEventListener("click", goFact);
  $("s2Back").addEventListener("click", () => { renderDraw(false); show("s1"); });
  $("s2Next").addEventListener("click", goWrite);
  $("s3Back").addEventListener("click", () => { renderFacts(); show("s2"); });
  $("s3Next").addEventListener("click", goWrap);
  $("s4Back").addEventListener("click", () => show("s3"));
  $("submitBtn").addEventListener("click", submitDiary);
  $("copyBtn").addEventListener("click", copyOut);
  Glossary.start({ terms: GLOSSARY, skip: ["#steps", ".flip"] }); // 어려운 낱말 풀이 (glossary.js)
}

init();
