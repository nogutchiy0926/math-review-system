(() => {
  "use strict";

  const MANIFEST_URL = "data/manifest.json";
  const DATA_BASE = "data/";
  const MAX_QUESTIONS = 5;
  const REQUIRED = ["id", "unit", "topic", "difficulty", "question", "answer", "explanation"];

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("condition-form"), unit: $("unit-select"), topic: $("topic-select"),
    difficulty: $("difficulty-select"), fetchBtn: $("fetch-btn"),
    message: $("message"), practice: $("practice"), list: $("question-list"),
  };

  let questions = [];

  // ---------- 表示ユーティリティ ----------
  function showMessage(text, isError) {
    els.message.textContent = text;
    els.message.className = isError ? "error" : "";
    els.message.hidden = !text;
  }

  const unique = (arr) => [...new Set(arr)];

  function fillSelect(select, values) {
    select.replaceChildren();
    for (const [value, text] of [["", "すべて"], ...values.map((v) => [v, v])]) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = text;
      select.append(o);
    }
  }

  // ---------- データ読み込み ----------
  async function fetchJson(url) {
    let res;
    try {
      res = await fetch(url, { cache: "no-cache" });
    } catch (e) {
      throw new Error(`${url} を読み込めませんでした。HTTP経由（GitHub Pagesやローカルサーバー）で開いているか確認してください。`);
    }
    if (!res.ok) throw new Error(`${url} を読み込めませんでした（HTTP ${res.status}）。ファイル名とmanifest.jsonの記載を確認してください。`);
    try {
      return await res.json();
    } catch (e) {
      throw new Error(`${url} のJSON形式が不正です。`);
    }
  }

  function isValid(q) {
    return q && typeof q === "object" &&
      REQUIRED.every((k) => typeof q[k] === "string" && q[k].trim() !== "");
  }

  async function loadAll() {
    const manifest = await fetchJson(MANIFEST_URL);
    if (!manifest || !Array.isArray(manifest.files)) {
      throw new Error("manifest.json に files 配列がありません。");
    }
    const all = [];
    let skipped = 0;
    const seen = new Set();
    for (const file of manifest.files) {
      const data = await fetchJson(DATA_BASE + file);
      if (!Array.isArray(data)) throw new Error(`${file} は問題の配列である必要があります。`);
      for (const q of data) {
        if (!isValid(q) || seen.has(q.id)) { skipped++; continue; }
        seen.add(q.id);
        all.push(q);
      }
    }
    return { all, skipped };
  }

  // ---------- 選択肢の生成 ----------
  function initControls() {
    fillSelect(els.unit, unique(questions.map((q) => q.unit)));
    fillSelect(els.difficulty, unique(questions.map((q) => q.difficulty)));
    fillSelect(els.topic, []);
    els.unit.disabled = false;
    els.difficulty.disabled = false;
    els.fetchBtn.disabled = false;
  }

  els.unit.addEventListener("change", () => {
    const unit = els.unit.value;
    const topics = unit ? unique(questions.filter((q) => q.unit === unit).map((q) => q.topic)) : [];
    fillSelect(els.topic, topics);
    els.topic.disabled = !unit; // 単元が「すべて」のときは選べない
  });

  // ---------- 出題 ----------
  function sample(arr, n) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const unit = els.unit.value, topic = els.topic.value, difficulty = els.difficulty.value;

    const pool = questions.filter((q) =>
      (!unit || q.unit === unit) && (!difficulty || q.difficulty === difficulty) && (!topic || q.topic === topic));
    els.list.replaceChildren();

    if (pool.length === 0) {
      els.practice.hidden = true;
      showMessage("この条件に合う問題はありません。条件を変えてください。", true);
      return;
    }
    showMessage("", false);
    sample(pool, MAX_QUESTIONS).forEach((q, i) => els.list.append(renderQuestion(q, i + 1)));
    els.practice.hidden = false;
    els.practice.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderQuestion(q, no) {
    const li = el("li", "question");
    const top = el("div", "q-top");
    const num = el("span", "q-num", String(no));
    num.setAttribute("aria-label", `問${no}`);
    const tags = el("ul", "tags");
    for (const t of [q.unit, q.topic, q.difficulty]) tags.append(el("li", "", t));
    top.append(num, tags);
    li.append(top, el("p", "q-text", q.question));

    const actions = el("div", "actions");
    const hintBox = el("div", "hint-box");
    hintBox.hidden = true;
    const answerBox = el("dl", "answer-box");
    answerBox.hidden = true;

    if (typeof q.hint === "string" && q.hint.trim() !== "") {
      hintBox.append(el("span", "label", "ヒント"), el("p", "hint-text", q.hint));
      const hintBtn = el("button", "", "ヒントを見る");
      hintBtn.type = "button";
      hintBtn.setAttribute("aria-expanded", "false");
      hintBtn.addEventListener("click", () => {
        hintBox.hidden = false;
        hintBtn.disabled = true;
        hintBtn.textContent = "ヒントを表示中";
        hintBtn.setAttribute("aria-expanded", "true");
      });
      actions.append(hintBtn);
    }

    answerBox.append(
      el("dt", "", "解答"), el("dd", "answer-text", q.answer),
      el("dt", "", "解説"), el("dd", "explanation-text", q.explanation));

    const ansBtn = el("button", "", "解答・解説を見る");
    ansBtn.type = "button";
    ansBtn.setAttribute("aria-expanded", "false");
    ansBtn.addEventListener("click", () => {
      answerBox.hidden = !answerBox.hidden;
      ansBtn.textContent = answerBox.hidden ? "解答・解説を見る" : "解答・解説を隠す";
      ansBtn.setAttribute("aria-expanded", String(!answerBox.hidden));
    });
    actions.append(ansBtn);

    li.append(actions, hintBox, answerBox);
    return li;
  }

  // ---------- 起動 ----------
  (async () => {
    try {
      const { all, skipped } = await loadAll();
      questions = all;
      if (questions.length === 0) {
        showMessage("有効な問題が1問も見つかりませんでした。問題データの形式を確認してください。", true);
        return;
      }
      initControls();
      if (skipped > 0) {
        showMessage(`形式が不正、またはIDが重複している${skipped}問を除いて読み込みました。`, true);
      }
    } catch (err) {
      showMessage(err.message, true);
    }
  })();
})();
