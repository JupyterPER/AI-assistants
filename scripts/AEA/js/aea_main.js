(function () {
  "use strict";

  // ==========================================================
  // Configuration
  // ==========================================================
  const LIBS = {
    jszip:  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    pdfjs:  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    purify: "https://cdn.jsdelivr.net/npm/dompurify@3.4.12/dist/purify.min.js",
    app:    "https://cdn.jsdelivr.net/gh/JupyterPER/AI-assistants@main/scripts/AEA/js/aea_tutor_app.js",
    // app:    "aea_tutor_app.js",
    login:  "https://cdn.jsdelivr.net/gh/JupyterPER/AI-assistants@main/scripts/DGS-master/js/aea_tutor_login.js"
    // login:  "aea_tutor_login.js"
  };

  function clampNum(v, min, max, d) {
    v = Number(v);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
  }

  const CFG = {
    apiUrl: typeof API_URL !== "undefined" && API_URL ? String(API_URL).trim() : "",
    apiFirst: typeof API_FIRST_PART !== "undefined" && API_FIRST_PART ? String(API_FIRST_PART).trim() : "",
    chatWidth: clampNum(typeof ARTIFACT_CHAT_WIDTH !== "undefined" ? ARTIFACT_CHAT_WIDTH : 25, 15, 80, 25),
    chatStartHidden: typeof ARTIFACT_CHAT_START_HIDDEN !== "undefined" ? ARTIFACT_CHAT_START_HIDDEN === true : false,
    maxChars: typeof ARTIFACT_MAX_CONTEXT_CHARS !== "undefined" ? (Number(ARTIFACT_MAX_CONTEXT_CHARS) || 60000) : 60000,
    persist: typeof ARTIFACT_PERSIST !== "undefined" ? ARTIFACT_PERSIST !== false : true,
    contentUrl: typeof ARTIFACT_CONTENT_URL !== "undefined" ? String(ARTIFACT_CONTENT_URL || "").trim() : "",
    extra: typeof ARTIFACT_EXTRA_INSTRUCTIONS !== "undefined" ? String(ARTIFACT_EXTRA_INSTRUCTIONS || "") : "",
    origin: typeof CHAT_ORIGIN !== "undefined" && CHAT_ORIGIN ? String(CHAT_ORIGIN) : location.pathname,
    tabTitle: typeof tabTitle !== "undefined" ? String(tabTitle || "") : "",
    ui: typeof ARTIFACT_UI_TEXT === "object" && ARTIFACT_UI_TEXT ? ARTIFACT_UI_TEXT : {}
  };

  const T = Object.assign({
    hideMaterial: "Hide study material (chat full width)",
    showChat: "Show chat",
    chatFab: "🤖",
    hideChat: "Hide chat (material full width)",
    showMaterial: "Show study material",
    widthCycle: "Change chat width",
    clearMarks: "Remove highlights and tutor notes (your own notes stay)",
    resize: "Drag to resize, double-click to reset",
    notFound: "This passage could not be found in the material.",
    notReady: "The study material is not loaded yet.",
    hl: "Highlight",
    hlOff: "click again to remove",
    focus: "Show in text",
    hlFocus: "Highlight & show",
    annotate: "Show note",
    annotateOff: "click again to remove note",
    colors: "Highlight colour",
    color: "Colour",
    colorNames: { yellow: "yellow", green: "green", blue: "blue", pink: "pink", orange: "orange" },
    tutorNote: "Tutor's note",
    myNote: "My note",
    newNote: "New note",
    note: "Note",
    ask: "Ask",
    askTitle: "Ask the tutor about this passage",
    addNoteTitle: "Attach your own note to the selected text",
    edit: "Edit",
    del: "Delete",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    notePlaceholder: "Write your note…",
    askPrefix: "About this passage: ",
    toolsError: "⚠️ Interactive buttons could not be rendered.",
    preparing: "⏳ Preparing interactive buttons…",
    quizPreparing: "⏳ Preparing quiz…",
    nothing: "Nothing to display: no study material is embedded and no chat is configured.",
    chatLoadError: "The chat could not be loaded. Check your connection and reload the page.",
    frameLost: "The material navigated to a page that cannot be read."
  }, CFG.ui);
  T.colorNames = Object.assign({ yellow: "yellow", green: "green", blue: "blue", pink: "pink", orange: "orange" }, CFG.ui.colorNames || {});

  const PALETTE = { yellow: "#fff176", green: "#b9f6ca", blue: "#b3e5fc", pink: "#f8bbd0", orange: "#ffcc80" };
  const PALETTE_KEYS = Object.keys(PALETTE);
  const ICONS = { highlight: "🖍", focus: "🎯", highlight_focus: "🔦", annotate: "📌" };

  // ==========================================================
  // Small utilities
  // ==========================================================
  const $ = id => document.getElementById(id);

  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function mkBtn(cls, text, title, onClick) {
    const b = el("button", cls, text);
    b.type = "button";
    if (title) { b.title = title; b.setAttribute("aria-label", title); }
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function oneLine(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };

  let fallbackToastTimer = null;
  function toast(msg) {
    if (typeof window.showToast === "function" && $("toast")) { window.showToast(msg); return; }
    let t = document.querySelector(".aea-toast-fallback");
    if (!t) { t = el("div", "aea-toast-fallback"); document.body.appendChild(t); }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(fallbackToastTimer);
    fallbackToastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }
  function domReady() {
    return document.readyState === "loading"
      ? new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true }))
      : Promise.resolve();
  }

  // ==========================================================
  // Mode detection
  // ==========================================================
  function readContent() {
    const j = $("embedded-page");
    if (j) {
      try {
        const v = JSON.parse(j.textContent || '""');
        if (typeof v === "string" && v.trim()) return { html: v };
      } catch (e) { console.warn("[AEA] embedded-page is not valid JSON", e); }
    }
    const t = $("aea-content");
    if (t && t.innerHTML.trim()) {
      return {
        html: '<!DOCTYPE html><html><head><meta charset="utf-8">' +
              '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
              t.innerHTML + "</body></html>"
      };
    }
    if (CFG.contentUrl) return { url: CFG.contentUrl };
    return null;


  }
  const content = readContent();
  const hasContent = !!content;
  const hasChat = !!(CFG.apiUrl && CFG.apiFirst);
  const mode = hasContent && hasChat ? "dual" : hasContent ? "content" : hasChat ? "chat" : "none";

  const app = $("aeaApp");
  const contentPane = $("aeaContentPane");
  const chatPane = $("aeaChatPane");
  const splitter = $("aeaSplitter");
  const dock = $("aeaDock");
  const frame = $("aeaFrame");
  const mobileSwitch = $("aeaMobileSwitch");

  app.classList.add("mode-" + mode);
  if (mode !== "dual") { splitter.remove(); mobileSwitch.remove(); }
  if (!hasChat) chatPane.remove();
  if (!hasContent) contentPane.remove();
  if (mode === "none") app.appendChild(el("div", "aea-empty", T.nothing));

  const contentKey = "aea:" + CFG.origin + ":" + hash(content ? (content.html || content.url) : "");
  const layoutKey = "aea-layout:" + CFG.origin;

  // ==========================================================
  // Layout: splitter, dock, hide/show, mobile
  // ==========================================================
  const PRESETS = [25, 33, 50];
  // ARTIFACT_CHAT_START_HIDDEN sets the default visibility on the student's
  // first visit; once the student toggles the chat themselves, their choice is
  // remembered (localStorage) and takes precedence over the config default.
  const storedLayout = store.get(layoutKey, null);
  const layout = Object.assign(
    { chatW: CFG.chatWidth, chatHidden: CFG.chatStartHidden, contentHidden: false, mobileView: "content" },
    storedLayout && typeof storedLayout === "object" ? storedLayout : {}
  );
  layout.chatW = clampNum(layout.chatW, 15, 85, CFG.chatWidth);
  if (layout.chatHidden && layout.contentHidden) layout.contentHidden = false;

  const mq = window.matchMedia("(max-width: 760px)");
  const isMobile = () => mq.matches;
  const saveLayout = () => store.set(layoutKey, layout);

  let dockLeft, dockRight, dockWidth, dockClear, chatFab;

  function applyLayout() {
    if (mode !== "dual") return;
    const mobile = isMobile();
    const chatOff = mobile ? layout.mobileView !== "chat" : layout.chatHidden;
    const contentOff = mobile ? layout.mobileView === "chat" : layout.contentHidden;

    app.classList.toggle("is-mobile", mobile);
    app.classList.toggle("chat-hidden", chatOff);
    app.classList.toggle("content-hidden", contentOff);
    app.style.setProperty("--aea-chat-w", layout.chatW + "%");

    chatPane.inert = chatOff;
    contentPane.inert = contentOff;

    dockLeft.disabled = contentOff;
    dockLeft.title = chatOff ? T.showChat : T.hideMaterial;
    dockLeft.setAttribute("aria-label", dockLeft.title);
    dockRight.disabled = chatOff;
    dockRight.title = contentOff ? T.showMaterial : T.hideChat;
    dockRight.setAttribute("aria-label", dockRight.title);
    dockWidth.hidden = chatOff || contentOff;
    dockClear.hidden = contentOff;

    if (chatFab) {
      // Disabled while the chat fills the whole window (material hidden).
      chatFab.disabled = contentOff;
      chatFab.title = chatOff ? T.showChat : T.hideChat;
      chatFab.setAttribute("aria-label", chatFab.title);
    }

    splitter.setAttribute("aria-valuenow", String(Math.round(chatOff ? 0 : contentOff ? 100 : layout.chatW)));

    mobileSwitch.querySelectorAll("button").forEach(b => {
      const active = b.dataset.view === (mobile ? layout.mobileView : "");
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });

    hidePop();
    hideSelMenu();
  }

  function showContent() {
    if (mode !== "dual") return;
    if (isMobile()) {
      if (layout.mobileView !== "content") { layout.mobileView = "content"; applyLayout(); saveLayout(); }
    } else if (layout.contentHidden) {
      layout.contentHidden = false; applyLayout(); saveLayout();
    }
  }
  function showChat() {
    if (mode !== "dual") return;
    if (isMobile()) {
      if (layout.mobileView !== "chat") { layout.mobileView = "chat"; applyLayout(); saveLayout(); }
    } else if (layout.chatHidden) {
      layout.chatHidden = false; applyLayout(); saveLayout();
    }
  }

  function setupLayout() {
    if (mode !== "dual") return;

    // Circular floating button with a robot emoji. Clicking it toggles the chat
    // on desktop (opens it when hidden, hides it when visible); it is disabled
    // while the chat fills the whole window (material hidden).
    chatFab = mkBtn("aea-chat-fab", T.chatFab, T.showChat, () => {
      if (layout.chatHidden) showChat();
      else if (!layout.contentHidden) { layout.chatHidden = true; applyLayout(); saveLayout(); }
    });
    // Anchor it inside the material pane so it always floats over the left pane
    // only, never over the chat pane.
    contentPane.appendChild(chatFab);

    dockLeft = mkBtn("aea-dock-btn", "◀", T.hideMaterial, () => {
      if (layout.chatHidden) layout.chatHidden = false; else layout.contentHidden = true;
      applyLayout(); saveLayout();
    });
    dockRight = mkBtn("aea-dock-btn", "▶", T.hideChat, () => {
      if (layout.contentHidden) layout.contentHidden = false; else layout.chatHidden = true;
      applyLayout(); saveLayout();
    });
    dockWidth = mkBtn("aea-dock-btn", "⇔", T.widthCycle, () => {
      const next = PRESETS.find(p => p > layout.chatW + 1) || PRESETS[0];
      layout.chatW = next; applyLayout(); saveLayout();
    });
    dockClear = mkBtn("aea-dock-btn", "🧹", T.clearMarks, clearMarks);
    dock.append(dockLeft, dockRight, dockWidth, dockClear);
    splitter.title = T.resize;

    splitter.addEventListener("pointerdown", e => {
      if (e.target.closest("#aeaDock") || e.button !== 0) return;
      e.preventDefault();
      splitter.setPointerCapture(e.pointerId);
      app.classList.add("dragging");
      document.body.classList.add("aea-dragging");
      const rect = app.getBoundingClientRect();
      const minPct = Math.max(15, 260 / rect.width * 100);
      const maxPct = Math.min(85, 100 - 240 / rect.width * 100);

      const move = ev => {
        const w = (rect.right - ev.clientX) / rect.width * 100;
        if (w < minPct * 0.5) {
          layout.chatHidden = true; layout.contentHidden = false;
        } else if (w > maxPct + (100 - maxPct) * 0.5) {
          layout.contentHidden = true; layout.chatHidden = false;
        } else {
          layout.chatHidden = false; layout.contentHidden = false;
          layout.chatW = Math.round(Math.min(maxPct, Math.max(minPct, w)) * 10) / 10;
        }
        applyLayout();
      };
      const up = () => {
        splitter.removeEventListener("pointermove", move);
        splitter.removeEventListener("pointerup", up);
        splitter.removeEventListener("pointercancel", up);
        app.classList.remove("dragging");
        document.body.classList.remove("aea-dragging");
        saveLayout();
      };
      splitter.addEventListener("pointermove", move);
      splitter.addEventListener("pointerup", up);
      splitter.addEventListener("pointercancel", up);
    });

    splitter.addEventListener("dblclick", e => {
      if (e.target.closest("#aeaDock")) return;
      layout.chatW = CFG.chatWidth; layout.chatHidden = false; layout.contentHidden = false;
      applyLayout(); saveLayout();
    });

    splitter.addEventListener("keydown", e => {
      if (e.target !== splitter) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        layout.chatHidden = false; layout.contentHidden = false;
        layout.chatW = clampNum(layout.chatW + (e.key === "ArrowLeft" ? 2 : -2), 15, 85, CFG.chatWidth);
        applyLayout(); saveLayout();
      } else if (e.key === "Enter") {
        e.preventDefault();
        layout.chatHidden = !layout.chatHidden; layout.contentHidden = false;
        applyLayout(); saveLayout();
      }
    });

    mobileSwitch.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => { layout.mobileView = b.dataset.view; applyLayout(); saveLayout(); });
    });

    if (mq.addEventListener) mq.addEventListener("change", applyLayout);
    else mq.addListener(applyLayout);

    applyLayout();
  }

  // ==========================================================
  // Floating UI: note popover + selection menu
  // ==========================================================
  const pop = el("div", "aea-pop");
  pop.hidden = true;
  pop.setAttribute("role", "dialog");
  const selMenu = el("div", "aea-selmenu");
  selMenu.hidden = true;
  if (hasContent) document.body.append(pop, selMenu);

  let popAnchor = null;
  let popRect = null;
  let popEditing = false;
  let selPending = null;

  function frameRect(r) {
    const f = frame.getBoundingClientRect();
    return { left: f.left + r.left, top: f.top + r.top, right: f.left + r.right, bottom: f.top + r.bottom, width: r.width, height: r.height };
  }

  function placeFloating(node, rect, prefer) {
    node.hidden = false;
    node.style.visibility = "hidden";
    node.style.left = "0px";
    node.style.top = "0px";
    const w = node.offsetWidth, h = node.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let top = prefer === "above" ? rect.top - h - 8 : rect.bottom + 8;
    if (prefer === "above" && top < 8) top = rect.bottom + 8;
    if (prefer !== "above" && top + h > vh - 8) top = Math.max(8, rect.top - h - 8);
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8);
    node.style.left = left + "px";
    node.style.top = Math.min(top, vh - h - 8) + "px";
    node.style.visibility = "";
  }

  function hidePop() {
    pop.hidden = true;
    pop.replaceChildren();
    pop.classList.remove("is-user");
    popAnchor = null; popRect = null; popEditing = false;
    delete pop.dataset.pinId;
  }
  function hideSelMenu() { selMenu.hidden = true; selPending = null; }

  function repositionFloating() {
    if (!pop.hidden) {
      if (popAnchor && popAnchor.isConnected) {
        const r = frameRect(popAnchor.getBoundingClientRect());
        const f = frame.getBoundingClientRect();
        if ((r.bottom < f.top || r.top > f.bottom) && !popEditing) { hidePop(); return; }
        placeFloating(pop, r, "below");
      } else if (popRect) {
        placeFloating(pop, popRect, "below");
      } else if (!popEditing) {
        hidePop();
      }
    }
  }

  function popHeader(title) {
    const h = el("div", "aea-pop-head");
    h.append(el("span", "", title), mkBtn("aea-x", "✕", T.close, hidePop));
    return h;
  }

  function toMathDelims(text) {
    return typeof window.normalizeQuizLatex === "function" ? window.normalizeQuizLatex(text) : String(text);
  }
  function typeset(node) {
    try { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([node]); } catch { /* ignore */ }
  }

  function showPinPopover(id, anchor) {
    const p = pins.get(id);
    if (!p || !anchor) return;
    hidePop();
    hideSelMenu();
    pop.classList.toggle("is-user", p.source === "user");

    const body = el("div", "aea-pop-body", toMathDelims(p.note));
    const foot = el("div", "aea-pop-foot");

    if (hasChat) {
      foot.append(mkBtn("aea-mini", "🤖" + T.ask, T.askTitle, () => { hidePop(); askInChat(p.text); }));
    }
    if (p.source === "user") {
      foot.append(
        mkBtn("aea-mini danger", T.del, T.del, () => deleteUserNote(id)),
        mkBtn("aea-mini primary", T.edit, T.edit, () => openEditor({
          anchor, title: T.myNote, initial: p.note,
          onSave: v => updateUserNote(id, v),
          onDelete: () => deleteUserNote(id)
        }))
      );
    }

    pop.append(popHeader(p.source === "user" ? T.myNote : T.tutorNote), body);
    if (foot.childNodes.length) pop.append(foot);
    pop.dataset.pinId = id;
    popAnchor = anchor;
    placeFloating(pop, frameRect(anchor.getBoundingClientRect()), "below");
    typeset(body);
  }

  function openEditor(opts) {
    hidePop();
    hideSelMenu();
    popEditing = true;
    pop.classList.add("is-user");

    const ta = el("textarea");
    ta.value = opts.initial || "";
    ta.placeholder = T.notePlaceholder;
    ta.maxLength = 2000;

    const save = () => {
      const v = ta.value.trim();
      if (!v) { if (opts.onDelete) opts.onDelete(); else hidePop(); return; }
      opts.onSave(v);
    };

    const foot = el("div", "aea-pop-foot");
    foot.append(mkBtn("aea-mini", T.cancel, T.cancel, hidePop), mkBtn("aea-mini primary", T.save, T.save, save));

    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
      if (e.key === "Escape") { e.preventDefault(); hidePop(); }
    });

    pop.append(popHeader(opts.title || T.newNote), ta, foot);
    popAnchor = opts.anchor || null;
    popRect = opts.rect || null;
    placeFloating(pop, popAnchor ? frameRect(popAnchor.getBoundingClientRect()) : popRect, "below");
    ta.focus();
  }

  function showSelMenu() {
    if (!selPending || popEditing) return;
    selMenu.replaceChildren();
    selMenu.append(mkBtn("aea-mini", "📌 " + T.note, T.addNoteTitle, () => {
      const s = selPending; hideSelMenu(); if (s) createUserNote(s);
    }));
    if (hasChat) {
      selMenu.append(mkBtn("aea-mini", "🤖 " + T.ask, T.askTitle, () => {
        const s = selPending; hideSelMenu(); if (s) askInChat(s.text);
      }));
    }
    placeFloating(selMenu, selPending.rect, "above");
  }

  document.addEventListener("mousedown", e => {
    if (pop.contains(e.target) || selMenu.contains(e.target)) return;
    if (!popEditing) hidePop();
    hideSelMenu();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !popEditing) { hidePop(); hideSelMenu(); }
  });
  window.addEventListener("resize", () => { repositionFloating(); hideSelMenu(); });

  function askInChat(text) {
    const input = $("messageInput");
    if (!input) return;
    showChat();
    const q = clip(oneLine(text), 500);
    input.value = (input.value.trim() ? input.value.trimEnd() + "\n" : "") + T.askPrefix + "\u201C" + q + "\u201D\n";
    input.dispatchEvent(new Event("input"));
    setTimeout(() => {
      if (input.disabled) return;
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }, 60);
  }

  // ==========================================================
  // Content engine: DOM walking, text index, matching, wrapping
  // ==========================================================
  let pageDoc = null;
  let pageWin = null;
  let flashTimer = null;
  let idSeq = 1;
  let fieldSaveTimer = null;
  let userNotes = [];
  let lastSnapshot = null;
  let lastSelection = "";

  const toolState = new Map(); // key -> {active,color,hlId,pinId,focusIdx,missing}
  const pins = new Map();      // pinId -> {source:'bot'|'user', note, text}

  const newId = p => p + (idSeq++).toString(36) + Math.random().toString(36).slice(2, 6);

  const BLOCK = new Set(("address article aside blockquote details dialog dd div dl dt fieldset figcaption figure " +
    "footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main nav ol p pre section summary table tbody thead " +
    "tfoot tr td th ul caption legend").split(" "));
  const SKIP = new Set("script style noscript template head title meta link iframe object embed canvas video audio svg math".split(" "));
  const FIELD = new Set(["input", "textarea", "select"]);
  const NONFIELD_INPUT = /^(hidden|password|submit|button|reset|image|file)$/;

  function isMathEl(e) {
    return e.localName === "mjx-container" ||
      (e.classList && (e.classList.contains("katex") || e.classList.contains("MathJax")));
  }

  function mathTex(e) {
    try {
      const items = pageWin.MathJax?.startup?.document?.getMathItemsWithin?.(e);
      if (items && items.length && items[0].math) return items[0].math;
    } catch { /* ignore */ }
    const ann = e.querySelector('annotation[encoding="application/x-tex"]');
    return ann ? ann.textContent : e.textContent;
  }

  /* Generic visible-DOM walker shared by the search index and the text extraction. */
  function walk(h) {
    if (!pageDoc || !pageDoc.body) return;
    const win = pageWin;
    (function visit(e) {
      const ln = e.localName;
      if (SKIP.has(ln) || e.hasAttribute("data-aea-ignore")) return;
      let cs = null;
      try { cs = win.getComputedStyle(e); } catch { /* ignore */ }
      if (cs && cs.display === "none") return;
      if (h.atom && h.atom(e, ln)) return;
      if (ln === "br") { h.brk(e); return; }
      const block = BLOCK.has(ln) ||
        !!(cs && /^(block|flex|grid|table|list-item|table-row|table-cell|flow-root)/.test(cs.display));
      if (block) h.blockStart(e, ln);
      const vis = !cs || cs.visibility === "visible";
      for (let n = e.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { if (vis) h.text(n); }
        else if (n.nodeType === 1) visit(n);
      }
      if (block) h.blockEnd(e, ln);
    })(pageDoc.body);
  }

  const CHAR_MAP = {
    "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'", "\u2032": "'", "\u00B4": "'", "`": "'",
    "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"', "\u2033": '"', "\u00AB": '"', "\u00BB": '"',
    "\u2013": "-", "\u2014": "-", "\u2012": "-", "\u2015": "-", "\u2212": "-", "\u2026": "..."
  };
  const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/;

  function normChar(c, loose) {
    if (INVISIBLE.test(c)) return "";
    let r = (CHAR_MAP[c] || c).toLowerCase();
    if (loose) {
      r = r.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "");
    }
    return r;
  }

  function normQuery(s, loose) {
    s = String(s || "");
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (/\s/.test(c)) { if (!loose && out && !out.endsWith(" ")) out += " "; continue; }
      out += normChar(c, loose);
    }
    return out.trim();
  }

  /* Normalized searchable text + mapping of every char to (textNode, offset). */
  function buildIndex(loose) {
    const chars = [];
    const nodes = [];
    let text = "";
    const sp = () => { if (!loose && text && text[text.length - 1] !== " ") { text += " "; chars.push(null); } };

    walk({
      atom(e, ln) { if (FIELD.has(ln) || isMathEl(e) || ln === "img") { sp(); return true; } return false; },
      blockStart: sp,
      blockEnd: sp,
      brk: sp,
      text(n) {
        const v = n.nodeValue;
        let used = false;
        for (let i = 0; i < v.length; i++) {
          const c = v[i];
          if (/\s/.test(c)) { sp(); continue; }
          const r = normChar(c, loose);
          for (let k = 0; k < r.length; k++) { text += r[k]; chars.push({ node: n, offset: i }); used = true; }
        }
        if (used) nodes.push(n);
      }
    });
    return { text, chars, nodes };
  }

  function findAll(hay, needle) {
    const out = [];
    if (!needle) return out;
    let i = hay.indexOf(needle);
    while (i !== -1) { out.push([i, i + needle.length]); i = hay.indexOf(needle, i + needle.length); }
    return out;
  }

  /* Fallback when the context sentence is slightly off: anchor on its first and last words. */
  function approxSpans(hay, rawContext, loose) {
    const words = oneLine(rawContext).split(" ");
    if (words.length < 8) return [];
    const head = normQuery(words.slice(0, 5).join(" "), loose);
    const tail = normQuery(words.slice(-5).join(" "), loose);
    const expected = normQuery(rawContext, loose).length;
    const out = [];
    for (const [hs] of findAll(hay, head)) {
      const tIdx = hay.indexOf(tail, hs + head.length);
      if (tIdx !== -1 && tIdx - hs < expected * 1.6 + 40) out.push([hs, tIdx + tail.length]);
      else out.push([hs, Math.min(hay.length, hs + expected)]);
    }
    return out;
  }

  function toDomRanges(idx, raw) {
    raw.sort((a, b) => a[0] - b[0]);
    const out = [];
    let lastEnd = -1;
    for (let [s, e] of raw) {
      while (s < e && !idx.chars[s]) s++;
      while (e > s && !idx.chars[e - 1]) e--;
      if (s >= e || s < lastEnd) continue;
      const a = idx.chars[s], b = idx.chars[e - 1];
      out.push({ startNode: a.node, startOffset: a.offset, endNode: b.node, endOffset: b.offset + 1 });
      lastEnd = e;
    }
    return out;
  }

  /* Find {text} preferably inside {context}; strict first, then loose matching. */
  function locate(spec) {
    if (!pageDoc || !pageDoc.body) return null;
    for (const loose of [false, true]) {
      const idx = buildIndex(loose);
      const t = normQuery(spec.text, loose);
      const c = normQuery(spec.context || "", loose);
      let ranges = [];
      let ctxSpans = [];

      if (c) {
        ctxSpans = findAll(idx.text, c);
        if (!ctxSpans.length) ctxSpans = approxSpans(idx.text, spec.context, loose);
        for (const [s, e] of ctxSpans) {
          if (!t) continue;
          const sub = idx.text.slice(s, e);
          for (const [a, b] of findAll(sub, t)) ranges.push([a + s, b + s]);
        }
      }
      if (!ranges.length && t) ranges = findAll(idx.text, t);
      if (!ranges.length && ctxSpans.length) ranges = ctxSpans.slice();

      if (ranges.length) {
        const dom = toDomRanges(idx, ranges);
        if (dom.length) return { idx, ranges: dom };
      }
    }
    return null;
  }

  function wrapRanges(idx, ranges, attr, value, cls) {
    const pos = new Map();
    idx.nodes.forEach((n, i) => pos.set(n, i));
    for (let m = ranges.length - 1; m >= 0; m--) {
      const r = ranges[m];
      const si = pos.get(r.startNode), ei = pos.get(r.endNode);
      if (si == null || ei == null) continue;
      for (let i = ei; i >= si; i--) {
        const node = idx.nodes[i];
        const start = i === si ? r.startOffset : 0;
        const end = i === ei ? r.endOffset : node.nodeValue.length;
        if (end <= start) continue;
        if (end < node.nodeValue.length) node.splitText(end);
        const target = start > 0 ? node.splitText(start) : node;
        const w = pageDoc.createElement("span");
        w.setAttribute(attr, value);
        if (cls) w.className = cls;
        target.parentNode.insertBefore(w, target);
        w.appendChild(target);
      }
    }
  }

  function unwrapSel(selector) {
    if (!pageDoc || !pageDoc.body) return;
    const parents = new Set();
    pageDoc.body.querySelectorAll(selector).forEach(e => {
      const p = e.parentNode;
      if (!p) return;
      parents.add(p);
      while (e.firstChild) p.insertBefore(e.firstChild, e);
      e.remove();
    });
    parents.forEach(p => { if (p.isConnected) p.normalize(); });
  }

  function openDetails(node) {
    for (let p = node && node.parentElement; p; p = p.parentElement) {
      if (p.localName === "details" && !p.open) p.open = true;
    }
  }

  function clearFlash() {
    clearTimeout(flashTimer);
    flashTimer = null;
    unwrapSel("[data-aea-flash]");
  }

  function nearestBlockEl(node) {
    for (let e = node && (node.nodeType === 1 ? node : node.parentElement); e && e !== pageDoc.body; e = e.parentElement) {
      if (BLOCK.has(e.localName)) return e;
    }
    return pageDoc.body;
  }

  // ==========================================================
  // Material extraction for the AI
  // ==========================================================
  function cleanText(node) {
    const c = node.cloneNode(true);
    c.querySelectorAll("input,select,textarea,script,style").forEach(x => x.remove());
    return oneLine(c.textContent);
  }

  function sectionHeading(e) {
    let best = null;
    for (const h of pageDoc.body.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
      if (h.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) best = h; else break;
    }
    return best ? oneLine(best.textContent) : "";
  }

  function fieldLabel(e, withSection) {
    let t = e.getAttribute("data-aea-label") || e.getAttribute("aria-label") || "";
    if (!t && e.getAttribute("aria-labelledby")) {
      t = e.getAttribute("aria-labelledby").split(/\s+/).map(id => pageDoc.getElementById(id)?.textContent || "").join(" ");
    }
    if (!t && e.labels && e.labels.length) t = cleanText(e.labels[0]);
    if (!t) t = e.getAttribute("placeholder") || e.getAttribute("title") || "";
    if (!t) { const b = nearestBlockEl(e); if (b) t = cleanText(b); }
    t = clip(oneLine(t) || e.name || e.id || e.localName, 140);
    if (withSection) {
      const h = sectionHeading(e);
      if (h && !t.includes(h)) t += " \u2014 section \u201C" + clip(h, 60) + "\u201D";
    }
    return t;
  }

  function radioGroupLabel(r) {
    const legend = r.closest("fieldset")?.querySelector("legend");
    if (legend) return clip(oneLine(legend.textContent), 160);
    if (r.getAttribute("data-aea-label")) return r.getAttribute("data-aea-label");
    if (r.name) {
      const sel = 'input[type="radio"][name="' + CSS.escape(r.name) + '"]';
      const total = pageDoc.querySelectorAll(sel).length;
      for (let p = r.parentElement; p && p !== pageDoc.body; p = p.parentElement) {
        if (p.querySelectorAll(sel).length >= total) {
          const c = p.cloneNode(true);
          c.querySelectorAll("label,input").forEach(x => x.remove());
          const txt = oneLine(c.textContent);
          if (txt) return clip(txt, 160);
          break;
        }
      }
    }
    return r.name || "choice";
  }
  function radioOptionLabel(r) {
    return r.labels && r.labels.length ? clip(cleanText(r.labels[0]), 120) : (r.value || "option");
  }

  function listFields() {
    if (!pageDoc || !pageDoc.body) return [];
    const out = [];
    const radios = new Map();
    let i = 0;
    for (const e of pageDoc.body.querySelectorAll("input,textarea,select,[contenteditable],[data-aea-state]")) {
      i++;
      if (e.closest("[data-aea-ignore]")) continue;
      const ln = e.localName;
      const type = (e.getAttribute("type") || "").toLowerCase();

      if (e.hasAttribute("data-aea-state")) {
        out.push({ key: "s:" + (e.id || i), label: e.getAttribute("data-aea-state") || e.id || "state", value: clip(oneLine(e.innerText || e.textContent), 2000) });
        continue;
      }
      if (ln === "input" && NONFIELD_INPUT.test(type)) continue;
      if (ln !== "input" && ln !== "textarea" && ln !== "select") {
        if (!e.isContentEditable || (e.parentElement && e.parentElement.isContentEditable)) continue;
        out.push({ key: "ce:" + (e.id || i), label: fieldLabel(e, true), value: clip((e.innerText || "").trim(), 4000) });
        continue;
      }
      if (type === "radio") {
        const name = e.name || "r" + i;
        let g = radios.get(name);
        if (!g) {
          g = { key: "r:" + name, label: radioGroupLabel(e), value: "(nothing selected)" };
          radios.set(name, g);
          out.push(g);
        }
        if (e.checked) g.value = radioOptionLabel(e);
        continue;
      }
      if (type === "checkbox") {
        out.push({ key: "c:" + (e.id || (e.name ? e.name + ":" + e.value : i)), label: fieldLabel(e, true), value: e.checked ? "checked" : "not checked" });
        continue;
      }
      if (ln === "select") {
        const v = e.value === "" && !e.multiple ? "" : Array.from(e.selectedOptions).map(o => oneLine(o.text)).join(", ");
        out.push({ key: "sel:" + (e.id || e.name || i), label: fieldLabel(e, true), value: v || "(nothing selected)" });
        continue;
      }
      out.push({ key: "f:" + (e.id || e.name || i), label: fieldLabel(e, true), value: clip(String(e.value || ""), 4000) });
    }
    return out.slice(0, 300);
  }

  function extractText() {
    if (!pageDoc || !pageDoc.body) return "";
    const out = [];
    let pre = 0;
    walk({
      atom(e, ln) {
        if (isMathEl(e)) { out.push(" $" + oneLine(mathTex(e)) + "$ "); return true; }
        if (FIELD.has(ln)) {
          const type = (e.getAttribute("type") || "").toLowerCase();
          if (ln === "input" && NONFIELD_INPUT.test(type)) {
            if (/^(submit|button|reset)$/.test(type) && e.value) out.push(" [" + e.value + "] ");
            return true;
          }
          if (type === "radio" || type === "checkbox") { out.push(" [\u2610] "); return true; }
          out.push(" [\u270E field: " + clip(fieldLabel(e, false), 70) + "] ");
          return true;
        }
        if (ln === "img") {
          const alt = e.getAttribute("alt");
          if (alt) out.push(" [image: " + oneLine(alt) + "] ");
          return true;
        }
        return false;
      },
      blockStart(e, ln) {
        if (ln === "pre") pre++;
        if (/^h[1-6]$/.test(ln)) out.push("\n\n" + "#".repeat(+ln[1]) + " ");
        else if (ln === "li") out.push("\n- ");
        else if (ln === "td" || ln === "th") out.push(" | ");
        else if (ln === "blockquote") out.push("\n> ");
        else out.push("\n");
      },
      blockEnd(e, ln) {
        if (ln === "pre") pre--;
        out.push(/^(h[1-6]|p)$/.test(ln) ? "\n\n" : "\n");
      },
      brk() { out.push("\n"); },
      text(n) { out.push(pre ? n.nodeValue : n.nodeValue.replace(/\s+/g, " ")); }
    });
    return out.join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n (?=\S)/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function customState() {
    try {
      if (pageWin && typeof pageWin.aeaGetState === "function") {
        const v = pageWin.aeaGetState();
        return clip(typeof v === "string" ? v : JSON.stringify(v), 5000);
      }
    } catch (e) { console.warn("[AEA] aeaGetState failed", e); }
    return "";
  }

  function captureState() {
    return {
      fields: listFields(),
      custom: customState(),
      notes: userNotes.map(n => ({ id: n.id, text: n.text, note: n.note }))
    };
  }

  function currentSelectionText() {
    try {
      const s = pageWin && pageWin.getSelection();
      if (!s || s.isCollapsed) return "";
      const t = oneLine(s.toString());
      return t.length >= 3 ? t : "";
    } catch { return ""; }
  }

  const quote = v => (v === undefined || v === "" ? "(empty)" : "\u201C" + clip(v, 1500) + "\u201D");

  function computeChangeNote() {
    if (!pageDoc) return "";
    const cur = captureState();
    const prev = lastSnapshot || { fields: [], custom: "", notes: [] };
    const lines = [];

    const pm = new Map(prev.fields.map(f => [f.key, f]));
    for (const f of cur.fields) {
      const p = pm.get(f.key);
      const old = p ? p.value : undefined;
      if (old === f.value) continue;
      if (old === undefined && /^(|\(nothing selected\)|not checked)$/.test(f.value)) continue;
      lines.push("- " + f.label + ": " + quote(old) + " \u2192 " + quote(f.value));
    }
    if (cur.custom !== prev.custom && cur.custom) lines.push("- App state: " + cur.custom);

    const prevNotes = new Map(prev.notes.map(n => [n.id, n]));
    const curIds = new Set();
    for (const n of cur.notes) {
      curIds.add(n.id);
      const p = prevNotes.get(n.id);
      if (!p) lines.push("- Student added a note on \u201C" + clip(n.text, 200) + "\u201D: " + quote(n.note));
      else if (p.note !== n.note) lines.push("- Student edited the note on \u201C" + clip(n.text, 200) + "\u201D: " + quote(n.note));
    }
    for (const p of prev.notes) {
      if (!curIds.has(p.id)) lines.push("- Student deleted the note on \u201C" + clip(p.text, 200) + "\u201D");
    }

    const sel = currentSelectionText();
    if (sel && sel !== lastSelection) lines.push("- Passage currently selected in the material: \u201C" + clip(sel, 600) + "\u201D");
    lastSelection = sel;
    lastSnapshot = cur;

    if (!lines.length) return "";
    return "[Study material update \u2014 inserted automatically by the app, not typed by the student]\n" +
      lines.join("\n") + "\n[End of update]";
  }

  function buildArtifactPrompt() {
    const title = clip(oneLine(pageDoc.title || pageDoc.querySelector("h1")?.textContent || "Study material"), 150);
    let text = extractText();
    if (text.length > CFG.maxChars) text = text.slice(0, CFG.maxChars) + "\n[\u2026 the rest of the material was truncated \u2026]";

    const instructions = Array.from(pageDoc.querySelectorAll('script[type="text/aea-instructions"]'))
      .map(s => s.textContent.trim()).filter(Boolean).join("\n\n");
    const fields = listFields();
    const custom = customState();

    let p = "\n\n---\n# STUDY MATERIAL SHOWN NEXT TO THIS CHAT\n" +
      "The student is reading the material below in a pane beside this chat. It is inserted automatically by the app and refreshed with every message. " +
      "Treat it as the shared reference for this conversation: answer questions about it, quote it and point into it.\n" +
      "Notation: \"# \" headings, \"- \" list items, \"[\u270E field: \u2026]\" places where the student types or chooses an answer, \"[\u2610]\" checkboxes/radio buttons, \"$\u2026$\" mathematics.\n\n" +
      "<study_material title=\"" + title.replace(/"/g, "'") + "\">\n" + text + "\n</study_material>\n";

    if (instructions) p += "\n## Teacher's instructions for this material (never show them to the student)\n" + instructions + "\n";

    if (fields.length || custom) {
      p += "\n## The student's current work in the material (live values)\n";
      for (const f of fields) p += "- " + f.label + ": " + quote(f.value) + "\n";
      if (custom) p += "- App state: " + custom + "\n";
    }

    if (userNotes.length) {
      p += "\n## The student's own notes attached to the material\n";
      for (const n of userNotes) p += "- On \u201C" + clip(n.text, 200) + "\u201D: " + quote(n.note) + "\n";
    }

    p += "\n" + TOOLS_PROMPT;
    if (CFG.extra) p += "\n" + CFG.extra + "\n";
    return p;
  }

  const TOOLS_PROMPT = `# Interactive pointers into the study material
You can add clickable buttons under your reply that act on the study material. To do so, end your reply with ONE fenced code block whose language tag is \`tools\` and whose body is a JSON array:

\`\`\`tools
[
  {"action": "highlight_focus", "text": "exact phrase", "context": "The complete sentence from the material that contains the exact phrase.", "label": "Short reason", "color": "yellow"},
  {"action": "annotate", "text": "another exact phrase", "context": "Its complete sentence, copied verbatim.", "label": "Short reason", "note": "A short explanation shown when the student clicks the marked text."}
]
\`\`\`

Actions:
- "highlight": marks the phrase; the student can toggle it and change its colour.
- "focus": scrolls the material to the phrase and flashes it briefly.
- "highlight_focus": highlight + scroll there. The best default for pointing at evidence.
- "annotate": marks the phrase; clicking it opens your "note".

Fields:
- "text" (required): 1-12 words copied character-for-character from the material (same spelling, diacritics, capitalisation and punctuation). Never paraphrase or translate it.
- "context" (strongly recommended): the full sentence (or list item / heading) from the material that contains "text", copied verbatim. It identifies which occurrence is meant.
- "label" (recommended): at most 6 words, in the language of the conversation, saying why the passage matters.
- "color" (optional, highlight actions only): yellow | green | blue | pink | orange. Different colours can contrast ideas.
- "note" (required for annotate): plain text, at most 300 characters.

Rules:
- Only target text that literally appears inside <study_material>. Do not target the student's field values, and do not target formulas (target words next to a formula instead).
- At most 6 items and a single tools block, placed at the very end of the reply. It must be valid JSON (double quotes, no comments, no trailing commas) and must not be inside another code block.
- Use buttons when they genuinely help (showing where something is stated, a definition, a passage the student misread). Do not add them to every reply, and do not use them to reveal answers the student should find on their own.
- The student never sees the JSON, only the buttons. Do not mention "JSON" or "tools"; refer to the buttons naturally (e.g. "Use the buttons below to see the passage.").
- A block starting with "[Study material update" at the beginning of a student message is inserted by the app and reports what the student changed in the material since the previous message.

# Quizzes
You can attach a practice quiz to your reply. To do so, end your reply with a fenced code block whose language tag is \`quiz\` and whose body is a JSON object:

\`\`\`quiz
{
  "title": "Quiz title",
  "questions": [
    {
      "question": "The question text.",
      "options": ["Option A", "Option B", "Option C"],
      "answer": 1,
      "explanation": "Shown after answering; explains why the correct option is right."
    }
  ]
}
\`\`\`

Fields:
- "title" (required): the quiz title, in the language of the conversation.
- "questions" (required): an array of question objects.
- "question" (required): the question text.
- "options" (required): an array of answer options.
- "answer" (required): the zero-based index of the correct option in "options" (first option = 0, second = 1, ...).
- "explanation" (required): plain text shown after the student answers, explaining the correct answer.

Rules:
- Every question must have exactly one correct answer, whose index is given in "answer".
- The block must be valid JSON (double quotes, no comments, no trailing commas) and must not be inside another code block.
- The student never sees the JSON, only the rendered quiz. Do not mention "JSON"; refer to the quiz naturally (e.g. "Skús si dať krátky test nižšie.").

# Combining blocks
- At most one \`tools\` block and at most one \`quiz\` block per reply.
- If both are present, place the \`quiz\` block first and the \`tools\` block last, each as its own separate fenced block at the very end of the reply.
`;

  // ==========================================================
  // Tool actions
  // ==========================================================
  const ACTION_ALIASES = {
    highlight: "highlight", hl: "highlight", mark: "highlight",
    focus: "focus", goto: "focus", scroll: "focus", show: "focus", locate: "focus",
    highlight_focus: "highlight_focus", "highlight+focus": "highlight_focus", "highlight-focus": "highlight_focus",
    highlightfocus: "highlight_focus", hlfocus: "highlight_focus", focus_highlight: "highlight_focus",
    highlight_and_focus: "highlight_focus",
    annotate: "annotate", annotation: "annotate", pin: "annotate", note: "annotate", pinned_annotation: "annotate"
  };

  function normalizeTool(it) {
    if (!it || typeof it !== "object") return null;
    const action = ACTION_ALIASES[String(it.action || it.type || it.tool || "").toLowerCase().trim().replace(/\s+/g, "_")];
    const text = oneLine(it.text || it.query || it.match || "");
    if (!action || !text) return null;
    const color = String(it.color || "").toLowerCase();
    const label = clip(oneLine(it.label || it.description || ""), 90);
    const note = String(it.note || it.annotation || "").trim();
    return {
      action,
      text: clip(text, 300),
      context: clip(oneLine(it.context || it.sentence || ""), 1200),
      label,
      color: PALETTE_KEYS.includes(color) ? color : "yellow",
      note: clip(note || label || text, 1500)
    };
  }

  function parseTools(raw) {
    let s = String(raw).trim();
    const fence = s.match(/^```(?:json|tools?)?\s*\n?([\s\S]*?)\n?```$/i);
    if (fence) s = fence[1].trim();
    let data;
    try {
      data = JSON.parse(s);
    } catch {
      try {
        data = JSON.parse(s.replace(/,\s*([\]}])/g, "$1"));
      } catch {
        try {
          data = s.split("\n").map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l.replace(/,$/, "")));
        } catch {
          return { error: "invalid JSON" };
        }
      }
    }
    if (data && !Array.isArray(data)) {
      data = Array.isArray(data.tools) ? data.tools : Array.isArray(data.actions) ? data.actions : [data];
    }
    const items = (data || []).slice(0, 12).map(normalizeTool).filter(Boolean);
    return items.length ? { items } : { error: "no usable items" };
  }

  const specKey = s => "k" + hash(s.action + "|" + s.text + "|" + s.context + "|" + (s.action === "annotate" ? s.note : ""));

  function getState(spec) {
    let st = toolState.get(spec.key);
    if (!st) {
      st = { active: false, color: spec.color, hlId: null, pinId: null, focusIdx: 0, missing: false };
      toolState.set(spec.key, st);
    }
    return st;
  }

  function hintFor(action, active) {
    switch (action) {
      case "highlight": return active ? T.hlOff : T.hl;
      case "focus": return T.focus;
      case "highlight_focus": return active ? T.hlOff : T.hlFocus;
      case "annotate": return active ? T.annotateOff : T.annotate;
    }
    return "";
  }

  function paintRow(row) {
    const spec = row._aeaSpec;
    if (!spec) return;
    const st = getState(spec);
    const b = row.querySelector(".aea-tool-btn");
    const d = row.querySelector(".aea-tool-desc");
    const toggle = spec.action !== "focus";
    b.classList.toggle("is-active", toggle && st.active);
    b.classList.toggle("is-missing", st.missing);
    if (toggle) b.setAttribute("aria-pressed", String(st.active));
    const c = spec.action === "focus" ? "#fca5a5" : spec.action === "annotate" ? "#93c5fd" : PALETTE[st.color];
    b.style.setProperty("--aea-tool-c", c);
    d.textContent = (spec.label ? spec.label + " \u00B7 " : "") + hintFor(spec.action, st.active);
    row.querySelectorAll(".aea-swatch").forEach(s => {
      const sel = s.dataset.color === st.color;
      s.classList.toggle("is-sel", sel);
      s.setAttribute("aria-pressed", String(sel));
    });
  }

  function refreshKey(key) {
    document.querySelectorAll('.aea-tool[data-key="' + key + '"]').forEach(paintRow);
  }
  function refreshAll() { document.querySelectorAll(".aea-tool").forEach(paintRow); }

  function buildTool(spec) {
    if (!spec) return null;
    spec.key = specKey(spec);
    const row = el("div", "aea-tool");
    row.dataset.key = spec.key;
    row._aeaSpec = spec;

    const b = el("button", "aea-tool-btn");
    b.type = "button";
    const body = el("span", "aea-tool-body");
    body.append(el("span", "aea-tool-text", "\u201C" + clip(spec.text, 90) + "\u201D"), el("span", "aea-tool-desc"));
    b.append(el("span", "aea-tool-icon", ICONS[spec.action]), body);
    b.addEventListener("click", () => runTool(spec));
    row.append(b);

    if (spec.action === "highlight" || spec.action === "highlight_focus") {
      const sw = el("span", "aea-swatches");
      sw.setAttribute("role", "group");
      sw.setAttribute("aria-label", T.colors);
      for (const c of PALETTE_KEYS) {
        const s = mkBtn("aea-swatch aea-sw-" + c, "", T.color + ": " + (T.colorNames[c] || c), () => setColor(spec, c));
        s.dataset.color = c;
        sw.append(s);
      }
      row.append(sw);
    }
    paintRow(row);
    return row;
  }

  function runTool(spec) {
    if (!pageDoc) { toast(T.notReady); return; }
    const st = getState(spec);
    switch (spec.action) {
      case "highlight":
        if (st.active) removeHl(st); else applyHl(spec, st);
        break;
      case "focus":
        focusSpec(spec, st, false);
        break;
      case "highlight_focus":
        if (st.active) removeHl(st);
        else if (applyHl(spec, st)) focusSpec(spec, st, true);
        break;
      case "annotate":
        if (st.active) removePin(st); else applyPin(spec, st);
        break;
    }
    refreshKey(spec.key);
  }

  function applyHl(spec, st) {
    showContent();
    const loc = locate(spec);
    if (!loc) { st.missing = true; toast(T.notFound); return false; }
    st.missing = false;
    st.hlId = newId("h");
    wrapRanges(loc.idx, loc.ranges, "data-aea-hl", st.hlId, "aea-hl aea-c-" + st.color);
    st.active = true;
    return true;
  }

  function removeHl(st) {
    if (st.hlId) unwrapSel('[data-aea-hl="' + st.hlId + '"]');
    st.active = false;
    st.hlId = null;
  }

  function setColor(spec, color) {
    const st = getState(spec);
    st.color = color;
    if (st.active && st.hlId && pageDoc) {
      pageDoc.querySelectorAll('[data-aea-hl="' + st.hlId + '"]').forEach(s => { s.className = "aea-hl aea-c-" + color; });
    } else if (pageDoc) {
      if (applyHl(spec, st) && spec.action === "highlight_focus") focusSpec(spec, st, true);
    }
    refreshKey(spec.key);
  }

  function focusSpec(spec, st, fromStart) {
    showContent();
    clearFlash();
    const loc = locate(spec);
    if (!loc) { st.missing = true; toast(T.notFound); refreshKey(spec.key); return; }
    st.missing = false;
    const n = loc.ranges.length;
    if (fromStart) st.focusIdx = 0;
    const i = st.focusIdx % n;
    st.focusIdx = (i + 1) % n;
    wrapRanges(loc.idx, [loc.ranges[i]], "data-aea-flash", "1", "");
    const target = pageDoc.querySelector("[data-aea-flash]");
    if (target) {
      openDetails(target);
      requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }));
    }
    if (n > 1) toast((i + 1) + " / " + n);
    flashTimer = setTimeout(clearFlash, 1800);
  }

  function applyPin(spec, st) {
    showContent();
    const loc = locate(spec);
    if (!loc) { st.missing = true; toast(T.notFound); return; }
    st.missing = false;
    st.pinId = newId("p");
    wrapRanges(loc.idx, loc.ranges, "data-aea-pin", st.pinId, "aea-pin");
    pins.set(st.pinId, { source: "bot", note: spec.note, text: spec.text });
    st.active = true;
    const first = pageDoc.querySelector('[data-aea-pin="' + st.pinId + '"]');
    if (first) {
      openDetails(first);
      requestAnimationFrame(() => first.scrollIntoView({ behavior: "smooth", block: "center" }));
      const id = st.pinId;
      setTimeout(() => { if (pins.has(id) && first.isConnected) showPinPopover(id, first); }, 500);
    }
  }

  function removePin(st) {
    if (st.pinId) {
      if (pop.dataset.pinId === st.pinId) hidePop();
      unwrapSel('[data-aea-pin="' + st.pinId + '"]');
      pins.delete(st.pinId);
    }
    st.active = false;
    st.pinId = null;
  }

  function clearMarks() {
    if (!pageDoc) return;
    clearFlash();
    unwrapSel("[data-aea-hl]");
    for (const [id, p] of Array.from(pins)) {
      if (p.source === "bot") { unwrapSel('[data-aea-pin="' + id + '"]'); pins.delete(id); }
    }
    toolState.forEach(st => { st.active = false; st.hlId = null; st.pinId = null; });
    hidePop();
    refreshAll();
  }

  // ==========================================================
  // Student's own notes
  // ==========================================================
  const saveNotes = () => { if (CFG.persist) store.set(contentKey + ":notes", userNotes); };

  function selectionContext(range, text) {
    const block = nearestBlockEl(range.startContainer);
    if (!block || !block.contains(range.endContainer)) return "";
    const full = oneLine(block.textContent);
    const i = full.indexOf(text);
    if (i < 0) return "";
    const re = /[.!?\u2026]["\u201D\u2019\u00BB)]?\s+/g;
    let start = 0, m;
    while ((m = re.exec(full)) && m.index + m[0].length <= i) start = m.index + m[0].length;
    re.lastIndex = i + text.length;
    m = re.exec(full);
    const end = m ? m.index + m[0].trimEnd().length : full.length;
    let ctx = full.slice(start, end).trim();
    if (ctx.length > 500) {
      ctx = full.slice(Math.max(0, i - 200), Math.min(full.length, i + text.length + 200)).trim();
    }
    return ctx === text ? "" : ctx;
  }

  function checkSelection() {
    if (!pageWin || popEditing) return;
    const s = pageWin.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) { hideSelMenu(); return; }
    const r = s.getRangeAt(0);
    const text = oneLine(s.toString());
    if (text.length < 2 || text.length > 600) { hideSelMenu(); return; }
    const anc = r.commonAncestorContainer;
    const ancEl = anc.nodeType === 1 ? anc : anc.parentElement;
    if (!ancEl || ancEl.closest("input,textarea,select,[contenteditable]")) { hideSelMenu(); return; }
    const rect = r.getBoundingClientRect();
    if (!rect.width && !rect.height) { hideSelMenu(); return; }
    selPending = { text, context: selectionContext(r, text), rect: frameRect(rect) };
    showSelMenu();
  }

  function applyUserNote(n) {
    const loc = locate(n);
    if (!loc) return null;
    wrapRanges(loc.idx, [loc.ranges[0]], "data-aea-pin", n.id, "aea-pin aea-pin-user");
    pins.set(n.id, { source: "user", note: n.note, text: n.text });
    return pageDoc.querySelector('[data-aea-pin="' + n.id + '"]');
  }

  function createUserNote(sel) {
    openEditor({
      rect: sel.rect,
      title: T.newNote,
      onSave: v => {
        const n = {
          id: "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          text: sel.text, context: sel.context, note: v, created: new Date().toISOString()
        };
        const anchor = applyUserNote(n);
        if (!anchor) { toast(T.notFound); hidePop(); return; }
        userNotes.push(n);
        saveNotes();
        try { pageWin.getSelection().removeAllRanges(); } catch { /* ignore */ }
        showPinPopover(n.id, anchor);
      }
    });
  }

  function updateUserNote(id, v) {
    const n = userNotes.find(x => x.id === id);
    if (n) n.note = v;
    const p = pins.get(id);
    if (p) p.note = v;
    saveNotes();
    const anchor = pageDoc && pageDoc.querySelector('[data-aea-pin="' + id + '"]');
    if (anchor) showPinPopover(id, anchor); else hidePop();
  }

  function deleteUserNote(id) {
    unwrapSel('[data-aea-pin="' + id + '"]');
    pins.delete(id);
    userNotes = userNotes.filter(x => x.id !== id);
    saveNotes();
    hidePop();
  }

  // ==========================================================
  // Field persistence (student's answers survive reloads)
  // ==========================================================
  function skipPersist(e) {
    const type = (e.getAttribute("type") || "").toLowerCase();
    return (e.localName === "input" && NONFIELD_INPUT.test(type)) || !!e.closest("[data-aea-ignore],[data-aea-nopersist]");
  }
  function persistKey(e, i) {
    if (e.id) return "#" + e.id;
    if (e.name) return "n:" + e.name + ":" + (e.type === "radio" || e.type === "checkbox" ? e.value : i);
    return "i:" + i;
  }
  function saveFields() {
    if (!CFG.persist || !pageDoc || !pageDoc.body) return;
    const data = {};
    pageDoc.body.querySelectorAll("input,textarea,select").forEach((e, i) => {
      if (skipPersist(e)) return;
      const k = persistKey(e, i);
      if (e.type === "checkbox" || e.type === "radio") data[k] = e.checked;
      else if (e.localName === "select") data[k] = Array.from(e.options).map(o => o.selected);
      else data[k] = e.value;
    });
    store.set(contentKey + ":fields", data);
  }
  function restoreFields() {
    if (!CFG.persist || !pageDoc || !pageDoc.body) return;
    const data = store.get(contentKey + ":fields", null);
    if (!data) return;
    pageDoc.body.querySelectorAll("input,textarea,select").forEach((e, i) => {
      if (skipPersist(e)) return;
      const k = persistKey(e, i);
      if (!(k in data)) return;
      const v = data[k];
      let changed = false;
      if (e.type === "checkbox" || e.type === "radio") {
        if (e.checked !== !!v) { e.checked = !!v; changed = true; }
      } else if (e.localName === "select" && Array.isArray(v)) {
        Array.from(e.options).forEach((o, j) => { if (o.selected !== !!v[j]) { o.selected = !!v[j]; changed = true; } });
      } else if (typeof v === "string" && e.value !== v) {
        e.value = v; changed = true;
      }
      if (changed) {
        e.dispatchEvent(new pageWin.Event("input", { bubbles: true }));
        e.dispatchEvent(new pageWin.Event("change", { bubbles: true }));
      }
    });
  }

  // ==========================================================
  // Iframe setup
  // ==========================================================
  const FRAME_CSS = `
    .aea-hl { color: inherit !important; border-radius: 2px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    .aea-c-yellow { background: #fff176 !important; }
    .aea-c-green  { background: #b9f6ca !important; }
    .aea-c-blue   { background: #b3e5fc !important; }
    .aea-c-pink   { background: #f8bbd0 !important; }
    .aea-c-orange { background: #ffcc80 !important; }
    [data-aea-pin] { background: #dbeafe !important; color: inherit !important; border-bottom: 2px dotted #1d4ed8 !important; cursor: pointer !important; }
    [data-aea-pin].aea-pin-user { background: #dcfce7 !important; border-bottom-color: #15803d !important; }
    [data-aea-pin]:hover { filter: brightness(.94); }
    [data-aea-flash] { outline: 3px solid #ef4444 !important; outline-offset: 2px; border-radius: 2px; animation: aeaFlash 1.6s ease-out; }
    @keyframes aeaFlash { 0% { background-color: rgba(239,68,68,.35); } 100% { background-color: transparent; } }
  `;

  function handleLink(e, a) {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("#")) {
      e.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      const target = id ? (pageDoc.getElementById(id) || pageDoc.getElementsByName(id)[0]) : pageDoc.body;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (/^(https?:|mailto:)/i.test(href) && !a.target) {
      e.preventDefault();
      window.open(a.href, "_blank", "noopener,noreferrer");
    }
  }

  function installFrameHelpers() {
    const style = pageDoc.createElement("style");
    style.setAttribute("data-aea-ignore", "");
    style.textContent = FRAME_CSS;
    (pageDoc.head || pageDoc.documentElement).appendChild(style);

    pageDoc.addEventListener("click", e => {
      const t = e.target;
      if (!t || t.nodeType !== 1) { if (!popEditing) hidePop(); return; }
      const a = t.closest("a[href]");
      if (a) handleLink(e, a);
      const pin = t.closest("[data-aea-pin]");
      if (pin) {
        const id = pin.getAttribute("data-aea-pin");
        if (!pop.hidden && pop.dataset.pinId === id) hidePop();
        else showPinPopover(id, pin);
      } else if (!popEditing) {
        hidePop();
      }
    }, true);

    const later = () => setTimeout(checkSelection, 10);
    pageDoc.addEventListener("mouseup", later);
    pageDoc.addEventListener("touchend", later);
    pageDoc.addEventListener("keyup", e => { if (e.shiftKey || e.key === "Shift") later(); });
    pageDoc.addEventListener("selectionchange", () => {
      const s = pageWin.getSelection();
      if (!s || s.isCollapsed) hideSelMenu();
    });
    pageDoc.addEventListener("keydown", e => {
      if (e.key === "Escape" && !popEditing) { hidePop(); hideSelMenu(); }
    });
    pageWin.addEventListener("scroll", () => { repositionFloating(); hideSelMenu(); }, { passive: true });
    pageWin.addEventListener("resize", repositionFloating);

    const onField = () => { clearTimeout(fieldSaveTimer); fieldSaveTimer = setTimeout(saveFields, 400); };
    pageDoc.addEventListener("input", onField, true);
    pageDoc.addEventListener("change", onField, true);
  }

  function onFrameLoad() {
    hidePop();
    hideSelMenu();
    try {
      pageDoc = frame.contentDocument;
      pageWin = frame.contentWindow;
      if (!pageDoc || !pageDoc.body) throw new Error("no document");
    } catch {
      pageDoc = null; pageWin = null;
      toast(T.frameLost);
      return;
    }
    // Ignore the initial about:blank document of the iframe.
    if (content.html != null && pageDoc.URL === "about:blank") { pageDoc = null; pageWin = null; return; }

    pins.clear();
    toolState.forEach(st => { st.active = false; st.hlId = null; st.pinId = null; });
    refreshAll();

    installFrameHelpers();
    restoreFields();

    userNotes = CFG.persist ? store.get(contentKey + ":notes", []) : userNotes;
    if (!Array.isArray(userNotes)) userNotes = [];
    for (const n of userNotes) {
      try { applyUserNote(n); } catch (e) { console.warn("[AEA] note could not be restored", e); }
    }

    lastSnapshot = captureState();
    lastSelection = "";

    if (mode === "content") {
      document.title = pageDoc.title || CFG.tabTitle || document.title;
    }
  }

  function startContent() {
    if (!hasContent) return;
    frame.addEventListener("load", onFrameLoad);
    if (content.html != null) frame.srcdoc = content.html;
    else frame.src = content.url;
  }

  // ==========================================================
  // Chat integration: renderer patch, button hydration, fetch hook
  // ==========================================================
  function patchRenderer() {
    const base = window.renderMarkdown;
    if (typeof base !== "function") return;
    window.renderMarkdown = function (text) {
      const blocks = [];
      text = String(text == null ? "" : text).replace(/```tools?[^\n]*\n([\s\S]*?)```/gi, (m, json) => {
        blocks.push(json);
        return "\n@@AEATOOLS" + (blocks.length - 1) + "@@\n";
      });
      let html = base(text);
      if (blocks.length) {
        html = html.replace(/(?:<p>\s*)?@@AEATOOLS(\d+)@@(?:\s*<\/p>)?/g, (m, i) => {
          const parsed = parseTools(blocks[+i]);
          if (parsed.error) return '<div class="aea-tools-error">' + T.toolsError + "</div>";
          return '<div class="aea-tools" data-tools="' + encodeURIComponent(JSON.stringify(parsed.items)) + '"></div>';
        });
      }
      return html;
    };
  }

  function hydrateTools(root) {
    root.querySelectorAll(".aea-tools:not([data-aea-ready])").forEach(box => {
      box.setAttribute("data-aea-ready", "1");
      let items = null;
      try { items = JSON.parse(decodeURIComponent(box.getAttribute("data-tools") || "")); } catch { /* ignore */ }
      if (!Array.isArray(items)) { box.className = "aea-tools-error"; box.textContent = T.toolsError; return; }
      box.replaceChildren(...items.map(it => buildTool(normalizeTool(it))).filter(Boolean));
    });
  }

  // While the AI reply is streaming, ```tools and ```quiz blocks are
  // still raw JSON. Everything from the earliest such block onward is
  // hidden from the preview and replaced with a note that an
  // interactive widget (buttons or quiz card) is being prepared.
  function hideStreamingTools(chat) {
    const previews = chat.querySelectorAll('.message.bot > div[style*="pre-wrap"]');
    const last = previews[previews.length - 1];
    if (!last) return;
    const t = last.textContent;

    const toolCut = t.search(/```tools?/i);
    const quizCut = t.search(/```quiz/i);

    if (quizCut !== -1 && (toolCut === -1 || quizCut < toolCut)) {
      last.textContent = t.slice(0, quizCut).trimEnd() + "\n\n" + T.quizPreparing;
      return;
    }

    if (toolCut !== -1) {
      last.textContent = t.slice(0, toolCut).trimEnd() + "\n\n" + T.preparing;
    }
  }

  function observeChat() {
    const chat = $("chat");
    if (!chat) return;
    new MutationObserver(() => {
      hideStreamingTools(chat);
      hydrateTools(chat);
    }).observe(chat, { childList: true, subtree: true });
  }

  function withNote(contentValue, note) {
    if (typeof contentValue === "string") return note + "\n\n" + contentValue;
    if (Array.isArray(contentValue)) {
      const copy = contentValue.slice();
      const i = copy.findIndex(p => p && p.type === "text");
      if (i === -1) copy.unshift({ type: "text", text: note });
      else copy[i] = Object.assign({}, copy[i], { text: note + "\n\n" + copy[i].text });
      return copy;
    }
    return contentValue;
  }

  function augmentRequest(body) {
    const msgs = body.messages;
    let sys = msgs[0] && msgs[0].role === "system" ? msgs[0] : null;
    if (!sys) { sys = { role: "system", content: "" }; msgs.unshift(sys); }
    if (typeof sys.content === "string") sys.content += buildArtifactPrompt();

    let convo = null;
    try {
      if (typeof messages !== "undefined" && Array.isArray(messages)) {
        convo = messages.filter(m => m && !m.deleted && (m.role === "user" || m.role === "assistant"));
      }
    } catch { /* tutor state unavailable */ }

    if (!convo || convo.length !== msgs.length - 1) {
      const last = msgs[msgs.length - 1];
      if (last && last.role === "user") {
        const n = computeChangeNote();
        if (n) last.content = withNote(last.content, n);
      }
      return;
    }

    const lastMsg = convo[convo.length - 1];
    if (lastMsg && lastMsg.role === "user" && typeof lastMsg.artifactNote !== "string") {
      // Stored on the message, so it is saved/exported and re-sent with later requests.
      lastMsg.artifactNote = computeChangeNote();
    }
    convo.forEach((m, i) => {
      if (m.role === "user" && m.artifactNote) msgs[i + 1].content = withNote(msgs[i + 1].content, m.artifactNote);
    });
  }

  function installFetchHook() {
    const nativeFetch = window.fetch.bind(window);
    let target = "";
    try { target = new URL(CFG.apiUrl, location.href).href; } catch { return; }

    window.fetch = function (resource, init) {
      try {
        const url = typeof resource === "string" ? resource
          : resource instanceof URL ? resource.href
          : (resource && resource.url) || "";
        if (pageDoc && url && new URL(url, location.href).href === target && init && typeof init.body === "string") {
          const body = JSON.parse(init.body);
          if (Array.isArray(body.messages)) {
            augmentRequest(body);
            init = Object.assign({}, init, { body: JSON.stringify(body) });
          }
        }
      } catch (e) {
        console.warn("[AEA] could not add the study material to the request", e);
      }
      return nativeFetch(resource, init);
    };
  }

  async function bootChat() {
    try {
      await Promise.all([LIBS.jszip, LIBS.pdfjs, LIBS.purify].map(src => loadScript(src).catch(e => console.warn(e))));
      await loadScript(LIBS.app);
      if (hasContent) patchRenderer();

      // aea_tutor_login.js initialises on DOMContentLoaded, which has already fired
      // for dynamically loaded scripts: capture its handler and run it ourselves.
      const captured = [];
      const nativeAdd = window.addEventListener;
      window.addEventListener = function (type, fn, opts) {
        if (type === "DOMContentLoaded") { captured.push(fn); return; }
        return nativeAdd.call(this || window, type, fn, opts);
      };
      try { await loadScript(LIBS.login); }
      finally { window.addEventListener = nativeAdd; }

      await domReady();
      for (const fn of captured) {
        try { await fn.call(window, new Event("DOMContentLoaded")); } catch (e) { console.error(e); }
      }
    } catch (e) {
      console.error(e);
      const chat = $("chat");
      if (chat) chat.appendChild(el("div", "aea-tools-error", T.chatLoadError));
    }
  }

  // ==========================================================
  // Public API (debugging + hooks for the material)
  // ==========================================================
  window.AEA = {
    mode,
    getMaterialText: () => extractText(),
    getState: () => captureState(),
    buildPrompt: () => (pageDoc ? buildArtifactPrompt() : ""),
    clearMarks,
    showChat,
    showContent,
    run(item) { const s = normalizeTool(item); if (s) { s.key = specKey(s); runTool(s); } },
    sendToChat(text) {
      if (!hasChat || typeof window.sendUserMessage !== "function") return false;
      showChat();
      window.sendUserMessage(String(text || ""));
      return true;
    }
  };

  // ==========================================================
  // Start
  // ==========================================================
  setupLayout();
  startContent();
  if (hasChat) {
    if (hasContent) { installFetchHook(); observeChat(); }
    bootChat();
  } else if (CFG.tabTitle) {
    document.title = CFG.tabTitle;
  }
})();
