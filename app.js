const STORAGE_KEY = "cijferboek.v1";
const DEFAULT_FORMULA = "toets * wToets + praktijk * wPraktijk + presentatie * wPresentatie";
const PASS_MARK = 5.45;
const CLASS_NAMES = ["1A", "1B", "2A", "2B"];

const FIRST = ["Noah", "Emma", "Luca", "Sofia", "Daan", "Mila", "Sem", "Julia", "Lars", "Sara", "Finn", "Lina", "Jesse", "Nora", "Mees", "Zoë"];
const LAST = ["de Vries", "Jansen", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "Bos", "Vos", "Peters", "Hendriks"];

const state = {
  view: "gate",
  classId: null,
  settingsOpen: false,
  studentCode: "",
  studentError: "",
  formulaError: "",
};

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}

function emptyStudent(name = "") {
  return {
    id: uid("s"),
    name,
    code: codeFor(),
    toets: "",
    toetsH: "",
    praktijk: "",
    praktijkH: "",
    presentatie: "",
    presentatieH: "",
  };
}

function codeFor() {
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return "ST-" + n;
}

function defaultData() {
  return {
    weights: { toets: 50, praktijk: 30, presentatie: 20 },
    formula: DEFAULT_FORMULA,
    passMark: PASS_MARK,
    devMode: false,
    classes: CLASS_NAMES.map((name) => ({
      id: uid("k"),
      name,
      students: [],
    })),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return { ...defaultData(), ...parsed };
  } catch {
    return defaultData();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();
if (!state.classId) state.classId = data.classes[0].id;

function num(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function best(original, retake) {
  const a = num(original);
  const b = num(retake);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function compute(student) {
  const toets = best(student.toets, student.toetsH);
  const praktijk = best(student.praktijk, student.praktijkH);
  const presentatie = best(student.presentatie, student.presentatieH);
  const missing = [toets, praktijk, presentatie].some((v) => v == null);
  const sumW = data.weights.toets + data.weights.praktijk + data.weights.presentatie;
  const wToets = data.weights.toets / sumW;
  const wPraktijk = data.weights.praktijk / sumW;
  const wPresentatie = data.weights.presentatie / sumW;

  if (missing) {
    return { raw: null, display: "—", pass: null, missing: true, toets, praktijk, presentatie };
  }

  try {
    const fn = new Function(
      "toets", "praktijk", "presentatie", "wToets", "wPraktijk", "wPresentatie", "Math",
      `"use strict"; return (${data.formula});`
    );
    const raw = Number(fn(toets, praktijk, presentatie, wToets, wPraktijk, wPresentatie, Math));
    if (!Number.isFinite(raw)) throw new Error("ongeldig");
    return {
      raw,
      display: round1(raw).toFixed(1).replace(".", ","),
      pass: raw >= data.passMark,
      missing: false,
      toets,
      praktijk,
      presentatie,
    };
  } catch {
    return { raw: null, display: "fout", pass: null, missing: true, toets, praktijk, presentatie, error: true };
  }
}

function tone(value) {
  const n = num(value);
  if (n == null) return "";
  return n >= data.passMark ? "cell-pass" : "cell-fail";
}

function classStats(klas) {
  const results = klas.students.map(compute);
  const done = results.filter((r) => !r.missing && r.raw != null);
  const avg = done.length ? done.reduce((s, r) => s + r.raw, 0) / done.length : null;
  const pass = done.filter((r) => r.pass).length;
  const fail = done.filter((r) => r.pass === false).length;
  const attention = klas.students.filter((s) => needsAttention(s)).length;
  return { avg, pass, fail, attention, total: klas.students.length, done: done.length };
}

function needsAttention(student) {
  const r = compute(student);
  if (r.missing) return true;
  if (r.pass === false) return true;
  const parts = [r.toets, r.praktijk, r.presentatie];
  return parts.some((p) => p != null && p < data.passMark);
}

function currentClass() {
  return data.classes.find((c) => c.id === state.classId) || data.classes[0];
}

function fmtAvg(n) {
  return n == null ? "—" : round1(n).toFixed(1).replace(".", ",");
}

function seedDemo() {
  data.classes = CLASS_NAMES.map((name, idx) => {
    const students = Array.from({ length: 10 }, (_, i) => {
      const s = emptyStudent(`${FIRST[(idx * 3 + i) % FIRST.length]} ${LAST[(idx + i) % LAST.length]}`);
      const base = 4.2 + ((i + idx) % 7) * 0.7;
      s.toets = round1(Math.min(10, base + (i % 3) * 0.4));
      s.praktijk = round1(Math.min(10, 5 + ((i * 1.3) % 4)));
      s.presentatie = round1(Math.min(10, 5.2 + ((i + idx) % 5) * 0.6));
      if (s.toets < 5.5 && i % 2 === 0) s.toetsH = round1(Math.min(10, s.toets + 1.4));
      if (i === 1) { s.praktijk = ""; s.presentatie = ""; }
      return s;
    });
    return { id: uid("k"), name, students };
  });
  data.devMode = true;
  state.classId = data.classes[0].id;
  save();
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

function render() {
  const root = document.getElementById("app");
  if (state.view === "gate") root.replaceChildren(viewGate());
  else if (state.view === "student") root.replaceChildren(viewStudent());
  else root.replaceChildren(viewTeacher());
}

function viewGate() {
  return el(`
    <section class="gate">
      <div class="gate-card">
        <p class="kicker">Cijferboek</p>
        <h1>Cijfers zonder spreadsheet-chaos.</h1>
        <p class="lede">Toets, praktijkopdracht en presentatie. Weging 50–30–20, aanpasbaar. Voldoende vanaf 5,45. Herkansingen tellen mee met het hoogste cijfer.</p>
        <div class="role-grid">
          <button class="role-btn" data-go="teacher">
            <h2>Docent</h2>
            <p>Klassenoverzicht, cijfers invoeren, formule, import en export.</p>
          </button>
          <button class="role-btn" data-go="student">
            <h2>Student</h2>
            <p>Alleen je eigen cijfer en of je het vak haalt.</p>
          </button>
        </div>
      </div>
    </section>
  `);
}

function viewTeacher() {
  const klas = currentClass();
  const stats = classStats(klas);
  const wrap = document.createElement("div");
  wrap.className = "app-shell";
  wrap.append(el(`
    <header class="topbar">
      <div class="brand">
        <div class="mark">C</div>
        <div>
          <strong>Cijferboek</strong>
          <span>Docentenscherm${data.devMode ? " · testdata" : ""}</span>
        </div>
      </div>
      <div class="top-actions">
        ${data.devMode ? '<span class="badge">Dev mode</span>' : ""}
        <button class="btn" data-act="settings">Instellingen</button>
        <label class="file-btn">Import Excel<input type="file" id="import-xlsx" accept=".xlsx,.xls,.csv" /></label>
        <button class="btn" data-act="export">Export Excel</button>
        <button class="btn btn-ghost" data-act="student">Studentweergave</button>
      </div>
    </header>
  `));

  const layout = document.createElement("div");
  layout.className = "layout";
  layout.append(el(`
    <aside class="sidebar">
      <h3>Klassen</h3>
      <div class="class-list">
        ${data.classes.map((c) => {
          const s = classStats(c);
          return `
            <button class="class-card ${c.id === klas.id ? "active" : ""}" data-class="${c.id}">
              <div class="name">${escapeHtml(c.name)}</div>
              <div class="meta">
                <span>${s.total} studenten</span>
                <span class="avg">${fmtAvg(s.avg)}</span>
              </div>
            </button>`;
        }).join("")}
      </div>
    </aside>
  `));

  const main = document.createElement("main");
  main.className = "main";
  main.append(el(`
    <div class="stats">
      <article class="stat"><div class="label">Klasgemiddelde</div><div class="value">${fmtAvg(stats.avg)}</div><div class="sub">${stats.done} van ${stats.total} volledig</div></article>
      <article class="stat"><div class="label">Voldoende</div><div class="value">${stats.pass}</div><div class="sub">eindcijfer ≥ 5,45</div></article>
      <article class="stat"><div class="label">Onvoldoende</div><div class="value">${stats.fail}</div><div class="sub">halen het vak nu niet</div></article>
      <article class="stat"><div class="label">Extra aandacht</div><div class="value">${stats.attention}</div><div class="sub">onvoldoende, open of zwak onderdeel</div></article>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="serif" style="margin:0;font-size:28px">${escapeHtml(klas.name)}</h2>
          <div class="muted">Groen = voldoende · rood = onvoldoende · herkansing wint als die hoger is</div>
        </div>
        <button class="btn btn-primary" data-act="add">Student toevoegen</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Naam</th>
              <th>Code</th>
              <th>Toets</th>
              <th>Herk. toets</th>
              <th>Praktijk</th>
              <th>Herk. praktijk</th>
              <th>Presentatie</th>
              <th>Herk. pres.</th>
              <th>Eind</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${klas.students.map((s) => rowHtml(s)).join("") || `<tr><td colspan="11" class="muted">Nog geen studenten. Voeg er een toe of zet dev mode aan.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `));

  layout.append(main);
  wrap.append(layout);
  if (state.settingsOpen) wrap.append(viewSettings());
  bindTeacher(wrap);
  return wrap;
}

function rowHtml(s) {
  const r = compute(s);
  const status = r.missing
    ? '<span class="pill pill-open">open</span>'
    : r.pass
      ? '<span class="pill pill-pass">voldoende</span>'
      : '<span class="pill pill-fail">onvoldoende</span>';
  const att = needsAttention(s) ? '<div class="attention">aandacht</div>' : "";
  return `
    <tr data-id="${s.id}">
      <td><input class="name" data-f="name" value="${escapeAttr(s.name)}" /></td>
      <td class="muted">${escapeHtml(s.code)}</td>
      <td class="${tone(s.toets)}"><input type="number" min="1" max="10" step="0.1" data-f="toets" value="${s.toets}" /></td>
      <td class="${tone(s.toetsH)}"><input type="number" min="1" max="10" step="0.1" data-f="toetsH" value="${s.toetsH}" /></td>
      <td class="${tone(s.praktijk)}"><input type="number" min="1" max="10" step="0.1" data-f="praktijk" value="${s.praktijk}" /></td>
      <td class="${tone(s.praktijkH)}"><input type="number" min="1" max="10" step="0.1" data-f="praktijkH" value="${s.praktijkH}" /></td>
      <td class="${tone(s.presentatie)}"><input type="number" min="1" max="10" step="0.1" data-f="presentatie" value="${s.presentatie}" /></td>
      <td class="${tone(s.presentatieH)}"><input type="number" min="1" max="10" step="0.1" data-f="presentatieH" value="${s.presentatieH}" /></td>
      <td class="final ${r.pass === true ? "cell-pass" : r.pass === false ? "cell-fail" : ""}">${r.display}</td>
      <td>${status}${att}</td>
      <td><button class="btn btn-danger" data-del="${s.id}">×</button></td>
    </tr>`;
}

function viewSettings() {
  return el(`
    <div class="drawer" data-act="close-settings">
      <div class="modal" data-stop>
        <h2>Instellingen</h2>
        <p class="hint">Standaardformule: gewogen gemiddelde. Variabelen: toets, praktijk, presentatie, wToets, wPraktijk, wPresentatie. Herkansing gebruikt automatisch het hoogste cijfer per onderdeel.</p>
        <div class="weights">
          <div class="field"><label>Toets %</label><input id="w-toets" type="number" min="0" value="${data.weights.toets}" /></div>
          <div class="field"><label>Praktijk %</label><input id="w-praktijk" type="number" min="0" value="${data.weights.praktijk}" /></div>
          <div class="field"><label>Presentatie %</label><input id="w-presentatie" type="number" min="0" value="${data.weights.presentatie}" /></div>
        </div>
        <div class="field">
          <label>Formule eindcijfer</label>
          <textarea id="formula" class="formula">${escapeHtml(data.formula)}</textarea>
          ${state.formulaError ? `<div class="error">${escapeHtml(state.formulaError)}</div>` : ""}
        </div>
        <div class="field">
          <label>Voldoendegrens</label>
          <input id="passmark" type="number" step="0.01" value="${data.passMark}" />
        </div>
        <div class="field">
          <label>Klasnamen</label>
          ${data.classes.map((c, i) => `<input data-cname="${i}" value="${escapeAttr(c.name)}" style="margin-bottom:6px" />`).join("")}
        </div>
        <label class="hint"><input type="checkbox" id="devmode" ${data.devMode ? "checked" : ""} /> Dev mode met teststudenten</label>
        <div class="top-actions" style="margin-top:16px">
          <button class="btn btn-primary" data-act="save-settings">Opslaan</button>
          <button class="btn" data-act="reset-formula">Standaardformule</button>
          <button class="btn" data-act="seed">Testdata laden</button>
          <button class="btn btn-danger" data-act="wipe">Alles wissen</button>
        </div>
      </div>
    </div>
  `);
}

function viewStudent() {
  const found = findStudent(state.studentCode.trim());
  const wrap = document.createElement("div");
  wrap.className = "student-shell";
  if (!found) {
    wrap.append(el(`
      <div class="student-wrap">
        <div class="login-card">
          <p class="kicker">Student</p>
          <h1 class="serif" style="margin-top:0">Bekijk je cijfer</h1>
          <p class="lede">Vul de code in die je van de docent hebt gekregen. Je ziet alleen jouw resultaat.</p>
          <div class="field">
            <label>Studentcode</label>
            <input id="scode" value="${escapeAttr(state.studentCode)}" placeholder="ST-1847" />
          </div>
          ${state.studentError ? `<p class="error">${escapeHtml(state.studentError)}</p>` : ""}
          <div class="top-actions">
            <button class="btn btn-primary" data-act="lookup">Bekijken</button>
            <button class="btn btn-ghost" data-act="gate">Terug</button>
          </div>
        </div>
      </div>
    `));
    bindStudent(wrap);
    return wrap;
  }

  const { student, klas } = found;
  const r = compute(student);
  const banner = r.missing
    ? "Nog niet alle onderdelen zijn ingevuld."
    : r.pass
      ? "Je hebt een voldoende. Je haalt het vak."
      : "Je hebt een onvoldoende. Je haalt het vak nog niet.";
  wrap.append(el(`
    <div class="student-wrap">
      <div class="result-card">
        <p class="kicker">${escapeHtml(klas.name)} · ${escapeHtml(student.code)}</p>
        <h1 class="serif" style="margin:0 0 8px">${escapeHtml(student.name)}</h1>
        <div class="grade-hero">
          <div class="muted">Eindcijfer</div>
          <div class="big ${r.pass === true ? "cell-pass" : r.pass === false ? "cell-fail" : ""}" style="display:inline-block;padding:8px 18px;border-radius:18px">${r.display}</div>
          <p>${banner}</p>
        </div>
        <div class="comps">
          ${compCard("Toets", student.toets, student.toetsH, Math.round(data.weights.toets)) }
          ${compCard("Praktijk", student.praktijk, student.praktijkH, Math.round(data.weights.praktijk)) }
          ${compCard("Presentatie", student.presentatie, student.presentatieH, Math.round(data.weights.presentatie)) }
        </div>
        <p class="hint" style="margin-top:18px">Voldoende vanaf ${String(data.passMark).replace(".", ",")}. Bij een herkansing telt het hoogste cijfer.</p>
        <button class="btn" data-act="gate" style="margin-top:12px">Uitloggen</button>
      </div>
    </div>
  `));
  bindStudent(wrap);
  return wrap;
}

function compCard(label, original, retake, weight) {
  const shown = best(original, retake);
  const txt = shown == null ? "—" : round1(shown).toFixed(1).replace(".", ",");
  const her = num(retake) != null ? `<div class="muted">Herkansing: ${String(retake).replace(".", ",")}</div>` : "";
  return `<article class="comp ${tone(shown)}"><div class="muted">${label} · ${weight}%</div><div class="g">${txt}</div>${her}</article>`;
}

function findStudent(code) {
  const needle = code.toUpperCase();
  for (const klas of data.classes) {
    const student = klas.students.find((s) => s.code.toUpperCase() === needle);
    if (student) return { student, klas };
  }
  return null;
}

function bindTeacher(root) {
  root.querySelectorAll("[data-go]").forEach?.(() => {});
  root.querySelector("[data-act='settings']")?.addEventListener("click", () => {
    state.settingsOpen = true; render();
  });
  root.querySelector("[data-act='export']")?.addEventListener("click", exportExcel);
  root.querySelector("[data-act='student']")?.addEventListener("click", () => {
    state.view = "student"; state.studentError = ""; render();
  });
  root.querySelector("[data-act='add']")?.addEventListener("click", () => {
    currentClass().students.push(emptyStudent("Nieuwe student"));
    save(); render();
  });
  root.querySelectorAll("[data-class]").forEach((btn) => {
    btn.addEventListener("click", () => { state.classId = btn.dataset.class; render(); });
  });
  root.querySelector("#import-xlsx")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importExcel(file);
  });
  root.querySelectorAll("tbody tr").forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        const s = currentClass().students.find((x) => x.id === id);
        if (!s) return;
        s[input.dataset.f] = input.value;
        save(); render();
      });
    });
  });
  root.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const klas = currentClass();
      klas.students = klas.students.filter((s) => s.id !== btn.dataset.del);
      save(); render();
    });
  });
  bindSettings(root);
}

function bindSettings(root) {
  const modal = root.querySelector(".modal");
  if (!modal) return;
  root.querySelector("[data-act='close-settings']")?.addEventListener("click", (e) => {
    if (e.target.dataset.act === "close-settings") { state.settingsOpen = false; render(); }
  });
  modal.addEventListener("click", (e) => e.stopPropagation());
  root.querySelector("[data-act='save-settings']")?.addEventListener("click", () => {
    data.weights.toets = Number(root.querySelector("#w-toets").value) || 0;
    data.weights.praktijk = Number(root.querySelector("#w-praktijk").value) || 0;
    data.weights.presentatie = Number(root.querySelector("#w-presentatie").value) || 0;
    data.formula = root.querySelector("#formula").value.trim() || DEFAULT_FORMULA;
    data.passMark = Number(root.querySelector("#passmark").value) || PASS_MARK;
    data.devMode = root.querySelector("#devmode").checked;
    root.querySelectorAll("[data-cname]").forEach((inp) => {
      const i = Number(inp.dataset.cname);
      if (data.classes[i]) data.classes[i].name = inp.value.trim() || data.classes[i].name;
    });
    const test = compute({ toets: 6, toetsH: "", praktijk: 6, praktijkH: "", presentatie: 6, presentatieH: "" });
    if (test.error) {
      state.formulaError = "Formule is ongeldig. Controleer de syntax.";
      render();
      return;
    }
    state.formulaError = "";
    state.settingsOpen = false;
    if (data.devMode && data.classes.every((c) => c.students.length === 0)) seedDemo();
    save(); render();
  });
  root.querySelector("[data-act='reset-formula']")?.addEventListener("click", () => {
    data.formula = DEFAULT_FORMULA;
    save(); render();
  });
  root.querySelector("[data-act='seed']")?.addEventListener("click", () => {
    seedDemo(); state.settingsOpen = false; render();
  });
  root.querySelector("[data-act='wipe']")?.addEventListener("click", () => {
    data = defaultData();
    state.classId = data.classes[0].id;
    save(); state.settingsOpen = false; render();
  });
}

function bindStudent(root) {
  root.querySelector("[data-act='gate']")?.addEventListener("click", () => {
    state.view = "gate"; state.studentCode = ""; state.studentError = ""; render();
  });
  root.querySelector("[data-act='lookup']")?.addEventListener("click", lookup);
  root.querySelector("#scode")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") lookup();
  });
  function lookup() {
    state.studentCode = root.querySelector("#scode").value.trim();
    state.studentError = findStudent(state.studentCode) ? "" : "Geen student gevonden met deze code.";
    render();
  }
}

function headers() {
  return ["Klas", "Code", "Naam", "Toets", "Toets herkansing", "Praktijk", "Praktijk herkansing", "Presentatie", "Presentatie herkansing", "Eindcijfer", "Status"];
}

function exportExcel() {
  if (typeof XLSX === "undefined") {
    alert("Excel-bibliotheek is niet geladen. Controleer je internetverbinding.");
    return;
  }
  const rows = [headers()];
  data.classes.forEach((klas) => {
    klas.students.forEach((s) => {
      const r = compute(s);
      rows.push([
        klas.name, s.code, s.name, s.toets, s.toetsH, s.praktijk, s.praktijkH, s.presentatie, s.presentatieH,
        r.display === "—" ? "" : r.raw,
        r.missing ? "open" : r.pass ? "voldoende" : "onvoldoende",
      ]);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cijfers");
  XLSX.writeFile(wb, "cijferboek.xlsx");
}

function normalizeHeader(h) {
  return String(h || "").toLowerCase().trim()
    .replaceAll("ë", "e").replaceAll("é", "e")
    .replace(/\s+/g, " ");
}

function colIndex(map, aliases) {
  for (const a of aliases) {
    if (map[a] != null) return map[a];
  }
  return -1;
}

function importExcel(file) {
  if (typeof XLSX === "undefined") {
    alert("Excel-bibliotheek is niet geladen. Controleer je internetverbinding.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!aoa.length) return;
    const head = aoa[0].map(normalizeHeader);
    const map = Object.fromEntries(head.map((h, i) => [h, i]));
    const iKlas = colIndex(map, ["klas", "class", "groep"]);
    const iCode = colIndex(map, ["code", "studentcode", "studentnummer", "nummer"]);
    const iNaam = colIndex(map, ["naam", "name", "student"]);
    const iToets = colIndex(map, ["toets", "toets cijfer", "tentamen"]);
    const iToetsH = colIndex(map, ["toets herkansing", "herk. toets", "herkansing toets", "toets h"]);
    const iPrak = colIndex(map, ["praktijk", "praktijkopdracht", "opdracht"]);
    const iPrakH = colIndex(map, ["praktijk herkansing", "herk. praktijk", "herkansing praktijk"]);
    const iPres = colIndex(map, ["presentatie", "pres"]);
    const iPresH = colIndex(map, ["presentatie herkansing", "herk. pres.", "herkansing presentatie", "herk. pres"]);

    let imported = 0;
    for (const row of aoa.slice(1)) {
      if (!row || row.every((c) => String(c).trim() === "")) continue;
      const naam = iNaam >= 0 ? String(row[iNaam]).trim() : "";
      if (!naam) continue;
      const klasName = iKlas >= 0 ? String(row[iKlas]).trim() : currentClass().name;
      let klas = data.classes.find((c) => c.name.toLowerCase() === klasName.toLowerCase());
      if (!klas) {
        klas = { id: uid("k"), name: klasName || "Import", students: [] };
        data.classes.push(klas);
      }
      const code = iCode >= 0 ? String(row[iCode]).trim() : "";
      let student = code ? klas.students.find((s) => s.code.toLowerCase() === code.toLowerCase()) : null;
      if (!student) {
        student = klas.students.find((s) => s.name.toLowerCase() === naam.toLowerCase());
      }
      if (!student) {
        student = emptyStudent(naam);
        if (code) student.code = code;
        klas.students.push(student);
      } else {
        student.name = naam;
        if (code) student.code = code;
      }
      const grab = (idx, field) => {
        if (idx < 0) return;
        const v = row[idx];
        student[field] = v === "" || v == null ? "" : v;
      };
      grab(iToets, "toets");
      grab(iToetsH, "toetsH");
      grab(iPrak, "praktijk");
      grab(iPrakH, "praktijkH");
      grab(iPres, "presentatie");
      grab(iPresH, "presentatieH");
      imported += 1;
    }
    save();
    render();
    alert(imported + " rijen geïmporteerd. Kolommen: Klas, Code, Naam, Toets, Toets herkansing, Praktijk, Praktijk herkansing, Presentatie, Presentatie herkansing.");
  };
  reader.readAsArrayBuffer(file);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}

document.getElementById("app").addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (!go) return;
  state.view = go.dataset.go;
  render();
});

render();
