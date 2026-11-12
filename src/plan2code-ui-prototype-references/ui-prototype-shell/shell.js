/* Plan2Code UI prototype: the tool script. It reads the round facts, builds
   the tabs, the frames' layout, the floating panel and its dials, presets,
   extras, resets and Surprise me, writes every dial's value onto the root of
   every variant frame, and builds the copied block. One classic inline
   script; its only global is window.p2c ({ state, apply }, plus an optional
   random source the page tests set). Long-supported features only: the page
   is checked by hand in Firefox and Safari. */
(function () {
  "use strict";

  var facts = JSON.parse(document.getElementById("p2c-round").textContent);
  var starts = facts.starts || {};
  var kind = facts.kind || "screen";
  var terminal = kind === "terminal";

  var FONT_SETS = {
    "System UI": "system-ui",
    Humanist: "humanist",
    Transitional: "transitional",
    "Slab Serif": "slab-serif",
    "Rounded Sans": "rounded-sans",
    "Monospace Code": "monospace-code",
  };
  var APP_FONT = "App font";
  var SCREENS = { "Phone 390": 390, "Tablet 820": 820, "Desktop 1280": 1280 };
  var WINDOWS = ["80x24", "120x30", "160x48"];
  var PALETTES = ["Graphite", "Amber", "Phosphor", "Ocean"];
  var STATES = [
    { value: "ready", label: "Ready" },
    { value: "empty", label: "Empty" },
    { value: "loading", label: "Loading" },
    { value: "error", label: "Error" },
  ];
  var LENGTHS = [
    { value: "short", label: "Short" },
    { value: "typical", label: "Typical" },
    { value: "long", label: "Very long" },
  ];

  // The presets: each sets only spacing, text size and corners (density on a
  // terminal). "start" means the round's own start for that dial.
  var PRESETS = terminal
    ? [
        { name: "Compact", set: { density: 1.15 } },
        { name: "Balanced", set: { density: "start" } },
        { name: "Airy", set: { density: 1.8 } },
        { name: "Bold", set: { density: 1.5 } },
      ]
    : [
        { name: "Compact", set: { space: 0.75, textSize: 14, radius: 4 } },
        { name: "Balanced", set: { space: "start", textSize: "start", radius: "start" } },
        { name: "Airy", set: { space: 1.5, textSize: 17, radius: 12 } },
        { name: "Bold", set: { space: 1.25, textSize: 20, radius: 16 } },
      ];

  // Which dials follow which carry-over item. When the item is freed up,
  // each variant starts the dial from its own value in round.json.
  var FREED_DIALS = terminal
    ? { colors: ["palette"], spacing: ["density"] }
    : { colors: ["accent", "neutral"], fonts: ["fontSet", "textSize"], spacing: ["space"], components: ["radius"] };

  // The block's dial lines, in their fixed order.
  var BLOCK_LINES = terminal
    ? [
        ["window", "Window size"],
        ["theme", "Theme"],
        ["palette", "Palette"],
        ["density", "Density"],
        ["state", "State"],
        ["length", "Content length"],
      ]
    : [
        ["screen", "Screen size"],
        ["theme", "Theme"],
        ["accent", "Accent color"],
        ["neutral", "Neutral color"],
        ["fontSet", "Font set"],
        ["textSize", "Text size"],
        ["space", "Spacing"],
        ["radius", "Corners"],
        ["state", "State"],
        ["length", "Content length"],
      ];

  // Layout, in tool pixels: the stage's inner margin, the gap between frames
  // in Compare all, the height of a frame's label there and of a terminal
  // window's title strip.
  var PAD = 16;
  var GAP = 24;
  var LABEL_H = 24;
  var TITLE_H = 24;
  // A frame's own border (content-box), added outside the chosen width.
  var BORDER = 2;

  function byId(id) {
    return document.getElementById(id);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function same(a, b) {
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
    if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
    return a === b;
  }

  // A number as the block and the read-outs write it: at most two decimals,
  // no trailing zeros (1, 1.25, 1.4).
  function num(v) {
    return String(Number(Number(v).toFixed(2)));
  }

  var bar = byId("p2c-bar");
  var stage = byId("p2c-stage");
  var tabList = byId("p2c-tabs");
  var compareButton = byId("p2c-compare");
  var panel = byId("p2c-panel");
  var handle = byId("p2c-panel-handle");
  var hideButton = byId("p2c-hide");
  var panelBody = byId("p2c-panel-body");
  var dialsTab = byId("p2c-dials-tab");
  var copyButton = byId("p2c-copy");
  var copyPop = byId("p2c-copy-pop");
  var noteBox = byId("p2c-note");
  var blockBox = byId("p2c-block");
  var copyBlockButton = byId("p2c-copy-block");
  var copyClose = byId("p2c-copy-close");
  var copyStatus = byId("p2c-copy-status");

  /* ---------------------------------------------------------------- state */

  var frames = [];
  Array.prototype.forEach.call(stage.querySelectorAll("iframe.p2c-frame"), function (el) {
    var letter = el.getAttribute("data-variant");
    var name = "";
    (facts.variants || []).forEach(function (v) {
      if (v.letter === letter) name = v.name || "";
    });
    frames.push({ letter: letter, name: name, el: el, tab: null, label: null, title: null });
  });

  var state = {
    variant: frames.length ? frames[0].letter : "",
    compare: false,
    preset: null,
    dials: {},
  };
  var controls = {};
  var scaleText = null;
  var ready = false;

  var freedIds = {};
  (facts.freed || []).forEach(function (item) {
    (FREED_DIALS[item] || []).forEach(function (id) {
      freedIds[id] = true;
    });
  });

  // A variant's own start for a dial, falling back to the shared start.
  function variantStart(letter, key, fallback) {
    var value = fallback;
    (facts.variants || []).forEach(function (v) {
      if (v.letter === letter && v.starts && v.starts[key] != null) value = v.starts[key];
    });
    return value;
  }

  // A dial is { value, start, moved }; a freed-up one also holds own, each
  // variant's own start by letter. An unmoved freed-up dial gives each frame
  // its own value and shows the current variant's.
  function addDial(id, start, normalize) {
    var d = { value: start, start: start, moved: false };
    if (freedIds[id]) {
      d.own = {};
      frames.forEach(function (f) {
        var v = variantStart(f.letter, id, start);
        d.own[f.letter] = normalize ? normalize(v) : v;
      });
      d.value = d.own[state.variant];
    }
    state.dials[id] = d;
    return d;
  }

  function startOf(id, letter) {
    var d = state.dials[id];
    return d.own ? d.own[letter] : d.start;
  }

  function frameOf(letter) {
    for (var i = 0; i < frames.length; i++) if (frames[i].letter === letter) return frames[i];
    return null;
  }

  /* ---------------------------------------------------------------- apply */

  function dialValue(id) {
    return state.dials[id] ? state.dials[id].value : undefined;
  }

  // The value a dial gives one frame.
  function valueFor(id, letter) {
    var d = state.dials[id];
    if (!d) return undefined;
    return d.own && !d.moved ? d.own[letter] : d.value;
  }

  function applyTo(frame) {
    var doc = frame.el.contentDocument;
    if (!doc || !doc.documentElement) return;
    var root = doc.documentElement;
    var style = root.style;
    var letter = frame.letter;
    var theme = dialValue("theme") === "dark" ? "dark" : "light";
    root.setAttribute("data-p2c-theme", theme);
    root.setAttribute("data-p2c-state", dialValue("state"));
    root.setAttribute("data-p2c-length", dialValue("length"));
    if (terminal) {
      var palette = slug(valueFor("palette", letter));
      ["bg", "fg", "accent"].forEach(function (part) {
        style.setProperty("--p2c-term-" + part, "var(--p2c-palette-" + palette + "-" + theme + "-" + part + ")");
      });
      style.setProperty("--p2c-density", num(valueFor("density", letter)));
    } else {
      var font = valueFor("fontSet", letter);
      style.setProperty("--p2c-accent", valueFor("accent", letter));
      style.setProperty("--p2c-neutral", valueFor("neutral", letter));
      style.setProperty("--p2c-font", font === APP_FONT ? "var(--p2c-font-set-app)" : "var(--p2c-font-set-" + FONT_SETS[font] + ")");
      style.setProperty("--p2c-text-size", valueFor("textSize", letter) + "px");
      style.setProperty("--p2c-space", String(valueFor("space", letter)));
      style.setProperty("--p2c-radius", valueFor("radius", letter) + "px");
      style.setProperty("--p2c-screen-width", SCREENS[dialValue("screen")] + "px");
    }
    (facts.extras || []).forEach(function (x) {
      var v = valueFor("x-" + x.name, letter);
      if (x.type === "toggle") {
        style.setProperty("--p2c-x-" + x.name, v ? "1" : "0");
        root.setAttribute("data-p2c-x-" + x.name, v ? "on" : "off");
      } else {
        style.setProperty("--p2c-x-" + x.name, String(v));
        root.setAttribute("data-p2c-x-" + x.name, String(v));
      }
    });
  }

  function apply() {
    frames.forEach(applyTo);
  }

  /* --------------------------------------------------------------- layout */

  // The steps of a flow variant, counted once its document has loaded.
  function stepCount(frame) {
    var doc = frame.el.contentDocument;
    var body = doc && doc.body;
    if (!body) return 1;
    var n = 0;
    for (var i = 0; i < body.children.length; i++) if (body.children[i].hasAttribute("data-p2c-step")) n++;
    return Math.max(1, n);
  }

  function loaded(frame) {
    var doc = frame.el.contentDocument;
    return !!(doc && doc.body && doc.documentElement.hasAttribute("data-p2c-kind"));
  }

  // The frame's inner width in pixels: what a variant's @media rules see.
  function frameWidth(frame) {
    if (terminal) return frame.el.offsetWidth - BORDER;
    var screen = SCREENS[dialValue("screen")];
    if (kind !== "flow") return screen;
    // The row's padding and gap as the frame's body has them (base.css sets
    // --p2c-space-5 and --p2c-space-6; a variant may set its own). Before the
    // frame loads, base.css's own values stand in.
    var n = stepCount(frame);
    var space = Number(valueFor("space", frame.letter));
    var padding = 2 * 24 * space;
    var gap = 32 * space;
    if (loaded(frame)) {
      var doc = frame.el.contentDocument;
      var cs = doc.defaultView.getComputedStyle(doc.body);
      padding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      gap = parseFloat(cs.columnGap) || 0;
    }
    return Math.ceil(screen * n + (n - 1) * gap + padding);
  }

  // A terminal frame holds the chosen columns and rows, measured in the
  // frame's own monospace set and line height. Before the frame loads, a
  // common character size stands in.
  function sizeTerminal(frame) {
    var m = /^(\d+)x(\d+)$/.exec(dialValue("window")) || [0, 120, 30];
    var cols = Number(m[1]);
    var rows = Number(m[2]);
    var ch = 8;
    var line = 16 * Number(valueFor("density", frame.letter));
    var padX = 16;
    var padY = 8;
    if (loaded(frame)) {
      var doc = frame.el.contentDocument;
      var body = doc.body;
      var probe = doc.createElement("span");
      probe.textContent = "0000000000";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "pre";
      body.appendChild(probe);
      ch = probe.getBoundingClientRect().width / 10 || ch;
      body.removeChild(probe);
      var cs = doc.defaultView.getComputedStyle(body);
      var lh = parseFloat(cs.lineHeight);
      line = isNaN(lh) ? (parseFloat(cs.fontSize) || 16) * Number(valueFor("density", frame.letter)) : lh;
      padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    }
    frame.el.style.width = Math.ceil(cols * ch + padX) + "px";
    frame.el.style.height = Math.ceil(rows * line + padY) + "px";
  }

  function place(frame, left, top, width, height, scale) {
    var s = frame.el.style;
    s.left = left + "px";
    s.top = top + "px";
    if (!terminal) {
      s.width = width + "px";
      s.height = Math.max(0, height) + "px";
    }
    s.transform = scale < 1 ? "scale(" + scale + ")" : "";
    if (frame.title) {
      frame.title.style.left = left + "px";
      frame.title.style.top = top - TITLE_H + "px";
      frame.title.style.width = frame.el.offsetWidth * scale + "px";
    }
  }

  var sizer = make("div", "tool-sizer");
  sizer.setAttribute("aria-hidden", "true");

  function layout() {
    var current = frameOf(state.variant);
    var head = terminal ? TITLE_H : 0;
    var widths = frames.map(function (f) {
      if (terminal) sizeTerminal(f);
      return frameWidth(f);
    });
    // Read the stage's size with no scroll bars: the last layout's frames
    // may still overflow it until they are placed again.
    stage.style.overflow = "hidden";
    var stageWidth = stage.clientWidth;
    var stageHeight = stage.clientHeight;
    var avail = Math.max(1, stageWidth - 2 * PAD);
    var scale = 1;
    var right = 0;
    var bottom = 0;

    document.body.classList.toggle("tool-compare", state.compare);
    frames.forEach(function (f) {
      var shown = state.compare || f === current;
      f.el.classList.toggle("tool-away", !shown);
      f.el.classList.toggle("tool-current-frame", f === current);
      f.el.setAttribute("aria-hidden", shown ? "false" : "true");
      f.el.tabIndex = shown ? 0 : -1;
      f.label.hidden = !state.compare;
      f.label.setAttribute("aria-current", f === current ? "true" : "false");
      if (f.title) f.title.classList.toggle("tool-away", !shown);
    });

    if (!state.compare) {
      var i = frames.indexOf(current);
      if (i === -1) return;
      var w = widths[i] + BORDER;
      // A flow scales so one screen fits and then scrolls sideways; anything
      // else scales so its whole width fits.
      var fit = kind === "flow" ? SCREENS[dialValue("screen")] + BORDER : w;
      scale = Math.min(1, avail / fit);
      var left = PAD + Math.max(0, (avail - w * scale) / 2);
      // A row wider than the stage scrolls sideways: take the height left
      // above that scroll bar.
      if (left + w * scale + PAD > stageWidth) {
        stage.style.overflowX = "scroll";
        stageHeight = stage.clientHeight;
      }
      var height = (stageHeight - 2 * PAD) / scale;
      // The frames on hold take the current frame's place and size, so a
      // switch shows them ready and none widens the scroll area.
      frames.forEach(function (f) {
        if (f !== current) place(f, left, PAD + head, widths[i], height - BORDER, scale);
      });
      place(current, left, PAD + head, widths[i], height - BORDER, scale);
      right = left + w * scale + PAD;
      bottom = PAD + head + (terminal ? current.el.offsetHeight : height) * scale + PAD;
    } else {
      var total = 0;
      widths.forEach(function (w) {
        total += w + BORDER;
      });
      var gaps = GAP * (frames.length - 1);
      scale = Math.min(1, (avail - gaps) / total);
      var x = PAD + Math.max(0, (avail - gaps - total * scale) / 2);
      var tall = (stageHeight - 2 * PAD - LABEL_H) / scale;
      frames.forEach(function (f, k) {
        var w = (widths[k] + BORDER) * scale;
        f.label.style.left = x + "px";
        f.label.style.top = PAD + "px";
        f.label.style.width = w + "px";
        place(f, x, PAD + LABEL_H + head, widths[k], tall - BORDER, scale);
        x += w + GAP;
        bottom = Math.max(bottom, PAD + LABEL_H + head + (terminal ? f.el.offsetHeight : tall) * scale + PAD);
      });
      right = x - GAP + PAD;
    }
    sizer.style.width = Math.ceil(right) + "px";
    sizer.style.height = Math.ceil(bottom) + "px";
    stage.style.overflow = "";
    stage.style.overflowX = "";
    if (scaleText) scaleText.textContent = scale < 1 ? Math.round(scale * 100) + "%" : "";
  }

  /* --------------------------------------------------------- the variants */

  function selectVariant(letter, focusTab) {
    var frame = frameOf(letter);
    if (!frame) return;
    state.variant = letter;
    var d = state.dials.variant;
    if (d) {
      d.value = letter;
      d.moved = !same(letter, d.start);
    }
    frames.forEach(function (f) {
      var on = f === frame;
      f.tab.setAttribute("aria-selected", on ? "true" : "false");
      f.tab.tabIndex = on ? 0 : -1;
    });
    if (controls.variant) controls.variant.set(letter);
    // An unmoved freed-up dial shows the current variant's own value.
    Object.keys(state.dials).forEach(function (id) {
      var dial = state.dials[id];
      if (dial.own && !dial.moved) {
        dial.value = dial.own[letter];
        if (controls[id]) controls[id].set(dial.value);
      }
    });
    if (focusTab) frame.tab.focus();
    layout();
    refreshBlock();
  }

  frames.forEach(function (f) {
    var el = f.el;
    el.id = "p2c-frame-" + f.letter;
    el.title = "Variant " + f.letter + (f.name ? ": " + f.name : "");

    var tab = make("button", "tool-tab");
    tab.type = "button";
    tab.id = "p2c-tab-" + f.letter;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", el.id);
    tab.appendChild(make("span", "tool-tab-letter", f.letter));
    tab.appendChild(document.createTextNode(f.name));
    tab.addEventListener("click", function () {
      selectVariant(f.letter);
    });
    tabList.appendChild(tab);
    f.tab = tab;

    var label = make("button", "tool-label");
    label.type = "button";
    label.hidden = true;
    label.appendChild(make("span", "tool-tab-letter", f.letter));
    label.appendChild(document.createTextNode(f.name));
    label.addEventListener("click", function (e) {
      e.stopPropagation();
      selectVariant(f.letter);
    });
    stage.appendChild(label);
    f.label = label;

    // A terminal frame is drawn as a window: the shell's title strip above it.
    if (terminal) {
      var title = make("div", "tool-term-title");
      title.setAttribute("aria-hidden", "true");
      title.appendChild(make("span", "tool-term-dots"));
      title.appendChild(make("span", "tool-term-name", f.name));
      stage.appendChild(title);
      f.title = title;
    }

    // A frame's document is replaced when its srcdoc loads, so write the
    // dials again on every load (and lay a flow or a terminal out once its
    // content can be measured).
    el.addEventListener("load", function () {
      applyTo(f);
      if (kind === "flow" || terminal) layout();
    });
  });
  stage.appendChild(sizer);

  tabList.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var i = frames.indexOf(frameOf(state.variant));
    var next = (i + (e.key === "ArrowRight" ? 1 : -1) + frames.length) % frames.length;
    e.preventDefault();
    selectVariant(frames[next].letter, true);
  });

  compareButton.addEventListener("click", function () {
    state.compare = !state.compare;
    compareButton.setAttribute("aria-pressed", state.compare ? "true" : "false");
    layout();
  });

  // In the row the frames take no clicks, so a click on one lands here.
  stage.addEventListener("click", function (e) {
    if (!state.compare) return;
    frames.forEach(function (f) {
      var r = f.el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) selectVariant(f.letter);
    });
  });

  /* ---------------------------------------------------------- the panel */

  var panelAt = null;
  var drag = null;

  function movePanel(left, top) {
    var minTop = bar.offsetHeight;
    var maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    var handleBottom = handle.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
    var maxTop = Math.max(minTop, window.innerHeight - handleBottom);
    left = Math.min(Math.max(0, left), maxLeft);
    top = Math.min(Math.max(minTop, top), maxTop);
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panelAt = { left: left, top: top };
  }

  handle.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 || (e.target.closest && e.target.closest("button"))) return;
    var r = panel.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("tool-dragging");
    e.preventDefault();
  });

  handle.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    movePanel(e.clientX - drag.dx, e.clientY - drag.dy);
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    handle.classList.remove("tool-dragging");
    if (handle.hasPointerCapture && handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  hideButton.addEventListener("click", function () {
    var r = panel.getBoundingClientRect();
    panelAt = { left: r.left, top: r.top };
    panel.hidden = true;
    dialsTab.style.left = r.left + "px";
    dialsTab.style.top = r.top + "px";
    dialsTab.hidden = false;
    dialsTab.focus();
  });

  dialsTab.addEventListener("click", function () {
    dialsTab.hidden = true;
    panel.hidden = false;
    if (panelAt) movePanel(panelAt.left, panelAt.top);
    hideButton.focus();
  });

  /* ------------------------------------------------------ the control kit */

  // Each returns { row, set, side, reset }: a labeled row carrying
  // data-dial="<id>", a value read-out and a reset place, and set(value) to
  // show a value without reporting it. Changes come back through
  // onChange(value).

  function makeRow(id, label, labelFor) {
    var row = make("div", "tool-row");
    row.setAttribute("data-dial", id);
    var name = make(labelFor ? "label" : "span", "tool-row-label", label);
    name.id = "p2c-label-" + id;
    if (labelFor) name.htmlFor = labelFor;
    var side = make("span", "tool-row-side");
    var value = make("span", "tool-value");
    var reset = make("span", "tool-reset");
    side.appendChild(value);
    side.appendChild(reset);
    var control = make("div", "tool-row-control");
    row.appendChild(name);
    row.appendChild(side);
    row.appendChild(control);
    return { row: row, name: name, side: side, value: value, reset: reset, control: control };
  }

  function kitResult(r, set) {
    return { row: r.row, set: set, side: r.side, reset: r.reset };
  }

  function slider(o) {
    var inputId = "p2c-dial-" + o.id;
    var r = makeRow(o.id, o.label, inputId);
    var input = make("input");
    input.type = "range";
    input.id = inputId;
    input.min = String(o.min);
    input.max = String(o.max);
    input.step = String(o.step);
    var format = o.format || String;
    function set(v) {
      input.value = String(v);
      r.value.textContent = format(v);
    }
    input.addEventListener("input", function () {
      var v = Number(input.value);
      r.value.textContent = format(v);
      o.onChange(v);
    });
    r.control.appendChild(input);
    set(o.value);
    return kitResult(r, set);
  }

  function color(o) {
    var inputId = "p2c-dial-" + o.id;
    var r = makeRow(o.id, o.label, inputId);
    var input = make("input");
    input.type = "color";
    input.id = inputId;
    function set(v) {
      input.value = v;
      r.value.textContent = v;
    }
    input.addEventListener("input", function () {
      r.value.textContent = input.value;
      o.onChange(input.value);
    });
    r.control.appendChild(input);
    set(o.value);
    return kitResult(r, set);
  }

  function toggle(o) {
    var inputId = "p2c-dial-" + o.id;
    var r = makeRow(o.id, o.label);
    var box = make("input");
    box.type = "checkbox";
    box.id = inputId;
    var sw = make("label", "tool-switch");
    sw.htmlFor = inputId;
    sw.appendChild(box);
    sw.appendChild(make("span", null, o.text));
    var format = o.format || String;
    function set(v) {
      box.checked = !!v;
      r.value.textContent = format(!!v);
    }
    box.addEventListener("change", function () {
      r.value.textContent = format(box.checked);
      o.onChange(box.checked);
    });
    r.control.appendChild(sw);
    set(o.value);
    return kitResult(r, set);
  }

  // Up to four choices are a segmented set of buttons; more are a select.
  function pick(o) {
    var choices = o.choices.map(function (c) {
      return typeof c === "string" ? { value: c, label: c } : c;
    });
    var r;
    var set;
    if (choices.length <= 4) {
      r = makeRow(o.id, o.label);
      var seg = make("div", "tool-seg");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-labelledby", r.name.id);
      var buttons = choices.map(function (c) {
        var b = make("button", null, c.label);
        b.type = "button";
        b.setAttribute("data-value", c.value);
        if (c.title) b.title = c.title;
        b.addEventListener("click", function () {
          set(c.value);
          o.onChange(c.value);
        });
        seg.appendChild(b);
        return b;
      });
      set = function (v) {
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", b.getAttribute("data-value") === String(v) ? "true" : "false");
        });
      };
      r.control.appendChild(seg);
    } else {
      var selectId = "p2c-dial-" + o.id;
      r = makeRow(o.id, o.label, selectId);
      var select = make("select");
      select.id = selectId;
      choices.forEach(function (c) {
        var opt = make("option", null, c.label);
        opt.value = c.value;
        select.appendChild(opt);
      });
      set = function (v) {
        select.value = String(v);
      };
      select.addEventListener("change", function () {
        o.onChange(select.value);
      });
      r.control.appendChild(select);
    }
    set(o.value);
    return kitResult(r, set);
  }

  /* ------------------------------------------------------------ the dials */

  // Set a dial's value as one value for every frame. A freed-up dial counts
  // as moved unless every variant's own value already equals it.
  function setDial(id, value) {
    var d = state.dials[id];
    d.value = value;
    if (d.own) {
      d.moved = Object.keys(d.own).some(function (k) {
        return !same(value, d.own[k]);
      });
      if (!d.moved) d.value = d.own[state.variant];
    } else {
      d.moved = !same(value, d.start);
    }
    if (controls[id]) controls[id].set(d.value);
  }

  // Back to the start: a freed-up dial gives each variant its own again.
  function resetDial(id) {
    var d = state.dials[id];
    d.moved = false;
    d.value = d.own ? d.own[state.variant] : d.start;
    if (controls[id]) controls[id].set(d.value);
  }

  // Dials whose change resizes a frame.
  function resizes(id) {
    if (id === "screen" || id === "window") return true;
    if (terminal) return id === "density";
    return kind === "flow" && id === "space";
  }

  // Show each moved dial's reset and each unmoved freed-up dial's tag.
  function syncRows() {
    Object.keys(controls).forEach(function (id) {
      var c = controls[id];
      var d = state.dials[id];
      if (c.resetButton) c.resetButton.hidden = !d.moved;
      if (c.ownTag) c.ownTag.hidden = d.moved;
    });
    presetButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-preset") === state.preset ? "true" : "false");
    });
  }

  // After any change: write the frames, then the panel's marks and the block.
  function refresh(relayout) {
    apply();
    if (relayout) layout();
    syncRows();
    refreshBlock();
  }

  function change(id, value) {
    setDial(id, value);
    if (id === "variant") {
      apply();
      selectVariant(value);
      return;
    }
    // Write the values first: a flow's layout reads the spacing back from
    // its frames.
    refresh(resizes(id));
  }

  function onChangeOf(id) {
    return function (value) {
      change(id, value);
    };
  }

  function between(lo, hi, value) {
    return { min: Math.min(lo, value), max: Math.max(hi, value) };
  }

  function px(v) {
    return v + "px";
  }

  function hex(v) {
    return String(v).toLowerCase();
  }

  // The panel, top to bottom: presets, the core dials, Extras, then Reset
  // everything and Surprise me.
  var presetRow = make("div", "tool-presets");
  presetRow.setAttribute("role", "group");
  presetRow.setAttribute("aria-label", "Presets");
  panelBody.appendChild(presetRow);
  var presetButtons = PRESETS.map(function (p) {
    var b = make("button", "tool-button tool-small", p.name);
    b.type = "button";
    b.id = "p2c-preset-" + slug(p.name);
    b.setAttribute("data-preset", p.name);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      usePreset(p);
    });
    presetRow.appendChild(b);
    return b;
  });

  var dialsBox = make("div", "tool-dials");
  panelBody.appendChild(dialsBox);

  function addControl(id, control, parent, label) {
    controls[id] = control;
    (parent || dialsBox).appendChild(control.row);
    if (id === "variant") return;
    var reset = make("button", "tool-reset-button", "Reset");
    reset.type = "button";
    reset.hidden = true;
    reset.setAttribute("aria-label", "Reset " + (label || id));
    reset.addEventListener("click", function () {
      resetDial(id);
      refresh(resizes(id));
    });
    control.reset.appendChild(reset);
    control.resetButton = reset;
    if (state.dials[id].own) {
      var tag = make("span", "tool-own", "each variant's own");
      control.side.insertBefore(tag, control.side.firstChild);
      control.ownTag = tag;
    }
  }

  addDial("variant", state.variant);
  addControl(
    "variant",
    pick({
      id: "variant",
      label: "Variant",
      choices: frames.map(function (f) {
        return { value: f.letter, label: frames.length > 4 ? f.letter + "  " + f.name : f.letter, title: f.name };
      }),
      value: state.variant,
      onChange: onChangeOf("variant"),
    })
  );

  if (terminal) {
    var windowStart = WINDOWS.indexOf(starts.window) !== -1 ? starts.window : "120x30";
    addDial("window", windowStart);
    addControl("window", pick({ id: "window", label: "Window size", choices: WINDOWS, value: windowStart, onChange: onChangeOf("window") }), null, "Window size");
  } else {
    var screenStart = SCREENS[starts.screen] ? starts.screen : "Desktop 1280";
    addDial("screen", screenStart);
    var screenControl = pick({ id: "screen", label: "Screen size", choices: Object.keys(SCREENS), value: screenStart, onChange: onChangeOf("screen") });
    scaleText = make("span", "tool-scale");
    screenControl.side.insertBefore(scaleText, screenControl.side.firstChild);
    addControl("screen", screenControl, null, "Screen size");
  }

  var themeStart = starts.theme === "dark" ? "dark" : "light";
  addDial("theme", themeStart);
  addControl(
    "theme",
    toggle({
      id: "theme",
      label: "Theme",
      text: "Dark",
      value: themeStart === "dark",
      format: function (on) {
        return on ? "Dark" : "Light";
      },
      onChange: function (on) {
        change("theme", on ? "dark" : "light");
      },
    }),
    null,
    "Theme"
  );
  // The toggle shows a boolean; the dial holds "dark" or "light".
  (function () {
    var setOn = controls.theme.set;
    controls.theme.set = function (v) {
      setOn(v === "dark" || v === true);
    };
  })();

  function paletteOf(v) {
    return PALETTES.indexOf(v) !== -1 ? v : "Graphite";
  }

  function fontOf(choices) {
    return function (v) {
      return choices.indexOf(v) !== -1 ? v : "System UI";
    };
  }

  function numberOr(fallback) {
    return function (v) {
      return typeof v === "number" ? v : fallback;
    };
  }

  if (terminal) {
    var paletteStart = paletteOf(starts.palette);
    var pd = addDial("palette", paletteStart, paletteOf);
    addControl("palette", pick({ id: "palette", label: "Palette", choices: PALETTES, value: pd.value, onChange: onChangeOf("palette") }), null, "Palette");

    var densityStart = typeof starts.density === "number" ? starts.density : 1.4;
    var densityRange = between(1, 2, densityStart);
    var dd = addDial("density", densityStart, numberOr(densityStart));
    addControl(
      "density",
      slider({ id: "density", label: "Density", min: densityRange.min, max: densityRange.max, step: 0.05, value: dd.value, format: num, onChange: onChangeOf("density") }),
      null,
      "Density"
    );
  } else {
    var accentStart = hex(starts.accent || "#2f6fed");
    var neutralStart = hex(starts.neutral || "#6b7280");
    var ad = addDial("accent", accentStart, hex);
    addControl("accent", color({ id: "accent", label: "Accent", value: ad.value, onChange: onChangeOf("accent") }), null, "Accent");
    var nd = addDial("neutral", neutralStart, hex);
    addControl("neutral", color({ id: "neutral", label: "Neutral", value: nd.value, onChange: onChangeOf("neutral") }), null, "Neutral");

    var fontChoices = Object.keys(FONT_SETS);
    if (facts.appFont === true) fontChoices.push(APP_FONT);
    var fontStart = fontOf(fontChoices)(starts.fontSet);
    var fd = addDial("fontSet", fontStart, fontOf(fontChoices));
    addControl("fontSet", pick({ id: "fontSet", label: "Font set", choices: fontChoices, value: fd.value, onChange: onChangeOf("fontSet") }), null, "Font set");

    // Each slider spans its planned range, widened only to take a start the
    // contract allows outside it (a variant's own start included).
    function rangeOf(lo, hi, d) {
      var r = between(lo, hi, d.start);
      if (d.own) {
        Object.keys(d.own).forEach(function (k) {
          r = between(r.min, r.max, d.own[k]);
        });
      }
      return r;
    }

    var sizeStart = typeof starts.textSize === "number" ? starts.textSize : 16;
    var sd = addDial("textSize", sizeStart, numberOr(sizeStart));
    var sizeRange = rangeOf(12, 22, sd);
    addControl("textSize", slider({ id: "textSize", label: "Text size", min: sizeRange.min, max: sizeRange.max, step: 1, value: sd.value, format: px, onChange: onChangeOf("textSize") }), null, "Text size");

    var spaceStart = typeof starts.space === "number" ? starts.space : 1;
    var spd = addDial("space", spaceStart, numberOr(spaceStart));
    var spaceRange = rangeOf(0.75, 1.5, spd);
    addControl(
      "space",
      slider({
        id: "space",
        label: "Spacing",
        min: spaceRange.min,
        max: spaceRange.max,
        step: 0.05,
        value: spd.value,
        format: function (v) {
          return Number(v).toFixed(2);
        },
        onChange: onChangeOf("space"),
      }),
      null,
      "Spacing"
    );

    var radiusStart = typeof starts.radius === "number" ? starts.radius : 8;
    var rd = addDial("radius", radiusStart, numberOr(radiusStart));
    var radiusRange = rangeOf(0, 24, rd);
    addControl("radius", slider({ id: "radius", label: "Corners", min: radiusRange.min, max: radiusRange.max, step: 1, value: rd.value, format: px, onChange: onChangeOf("radius") }), null, "Corners");
  }

  var stateStart = STATES.some(function (c) {
    return c.value === starts.state;
  })
    ? starts.state
    : "ready";
  addDial("state", stateStart);
  addControl("state", pick({ id: "state", label: "State", choices: STATES, value: stateStart, onChange: onChangeOf("state") }), null, "State");

  var lengthStart = LENGTHS.some(function (c) {
    return c.value === starts.length;
  })
    ? starts.length
    : "typical";
  addDial("length", lengthStart);
  addControl("length", pick({ id: "length", label: "Content length", choices: LENGTHS, value: lengthStart, onChange: onChangeOf("length") }), null, "Content length");

  /* ----------------------------------------------------------- the extras */

  var extras = facts.extras || [];
  var extrasBox = make("details", "tool-extras");
  extrasBox.id = "p2c-extras";
  extrasBox.open = true;
  extrasBox.hidden = extras.length === 0;
  extrasBox.appendChild(make("summary", "tool-extras-title", "Extras"));
  var extrasBody = make("div", "tool-extras-body");
  extrasBox.appendChild(extrasBody);
  panelBody.appendChild(extrasBox);

  extras.forEach(function (x) {
    var id = "x-" + x.name;
    var label = x.label || x.name;
    var control;
    if (x.type === "toggle") {
      addDial(id, !!x.start);
      control = toggle({
        id: id,
        label: label,
        text: "On",
        value: !!x.start,
        format: function (on) {
          return on ? "On" : "Off";
        },
        onChange: onChangeOf(id),
      });
    } else if (x.type === "pick") {
      addDial(id, String(x.start));
      control = pick({ id: id, label: label, choices: (x.choices || []).map(String), value: String(x.start), onChange: onChangeOf(id) });
    } else {
      addDial(id, Number(x.start));
      var r = between(Number(x.min), Number(x.max), Number(x.start));
      control = slider({ id: id, label: label, min: r.min, max: r.max, step: x.step || 1, value: Number(x.start), format: num, onChange: onChangeOf(id) });
    }
    addControl(id, control, extrasBody, label);
  });

  /* ---------------------------------- presets, Reset everything, Surprise */

  function usePreset(p) {
    var relayout = false;
    Object.keys(p.set).forEach(function (id) {
      if (!state.dials[id]) return;
      if (p.set[id] === "start") resetDial(id);
      else setDial(id, p.set[id]);
      if (resizes(id)) relayout = true;
    });
    state.preset = p.name;
    refresh(relayout);
  }

  function resetAll() {
    Object.keys(state.dials).forEach(function (id) {
      if (id !== "variant") resetDial(id);
    });
    state.preset = null;
    refresh(true);
  }

  // The random source: window.p2c.random when the page tests set one.
  function random() {
    var r = window.p2c && typeof window.p2c.random === "function" ? window.p2c.random : Math.random;
    var v = Number(r());
    return isNaN(v) ? 0 : Math.min(Math.max(v, 0), 0.999999);
  }

  function oneOf(list) {
    return list[Math.floor(random() * list.length)];
  }

  // A value on the slider's steps, never past its max when the range is
  // not a whole number of steps.
  function stepIn(min, max, step) {
    var count = Math.floor((max - min) / step + 1e-9);
    var n = Math.min(count, Math.round((random() * (max - min)) / step));
    return Number((min + n * step).toFixed(4));
  }

  // A color from hue, saturation and lightness (percent), as #rrggbb.
  function hslHex(h, s, l) {
    s /= 100;
    l /= 100;
    var a = s * Math.min(l, 1 - l);
    function f(n) {
      var k = (n + h / 30) % 12;
      var v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      var t = Math.round(v * 255).toString(16);
      return t.length < 2 ? "0" + t : t;
    }
    return "#" + f(0) + f(8) + f(4);
  }

  function sliderRange(id) {
    var input = byId("p2c-dial-" + id);
    return { min: Number(input.min), max: Number(input.max), step: Number(input.step) || 1 };
  }

  // Surprise me moves only the look: colors (or the palette), fonts,
  // spacing (or density), corners and the extras marked look.
  function surprise() {
    var moves = {};
    if (terminal) {
      moves.palette = oneOf(PALETTES);
      var dr = sliderRange("density");
      moves.density = stepIn(dr.min, dr.max, dr.step);
    } else {
      var hue = Math.floor(random() * 360);
      moves.accent = hslHex(hue, 70, 48);
      moves.neutral = hslHex(hue, 10, 46);
      moves.fontSet = oneOf(Object.keys(FONT_SETS));
      ["textSize", "space", "radius"].forEach(function (id) {
        var r = sliderRange(id);
        moves[id] = stepIn(r.min, r.max, r.step);
      });
    }
    extras.forEach(function (x) {
      if (x.look !== true) return;
      var id = "x-" + x.name;
      if (x.type === "toggle") moves[id] = random() < 0.5;
      else if (x.type === "pick") moves[id] = oneOf((x.choices || []).map(String));
      else {
        var r = sliderRange(id);
        moves[id] = stepIn(r.min, r.max, r.step);
      }
    });
    Object.keys(moves).forEach(function (id) {
      setDial(id, moves[id]);
    });
    state.preset = null;
    refresh(true);
  }

  var foot = make("div", "tool-panel-foot");
  var resetAllButton = make("button", "tool-button tool-small", "Reset everything");
  resetAllButton.type = "button";
  resetAllButton.id = "p2c-reset-all";
  resetAllButton.addEventListener("click", resetAll);
  var surpriseButton = make("button", "tool-button tool-small", "Surprise me");
  surpriseButton.type = "button";
  surpriseButton.id = "p2c-surprise";
  surpriseButton.addEventListener("click", surprise);
  foot.appendChild(resetAllButton);
  foot.appendChild(surpriseButton);
  panelBody.appendChild(foot);

  /* ------------------------------------------------------- the copied block */

  function stateLabel(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label;
    return String(v);
  }

  function formatDial(id, v) {
    switch (id) {
      case "theme":
        return v === "dark" ? "Dark" : "Light";
      case "accent":
      case "neutral":
        return hex(v);
      case "textSize":
      case "radius":
        return num(v) + "px";
      case "space":
      case "density":
        return num(v);
      case "state":
        return stateLabel(STATES, v);
      case "length":
        return stateLabel(LENGTHS, v);
      default:
        return String(v);
    }
  }

  function formatExtra(x, v) {
    if (x.type === "toggle") return v ? "On" : "Off";
    if (x.type === "pick") return oneLine(v);
    return num(v);
  }

  function list(items) {
    return items && items.length ? items.join(", ") : "none";
  }

  // A free-text value on one line, so it can never start a line of its own
  // in the block.
  function oneLine(text) {
    return String(text).replace(/\s*[\r\n]+\s*/g, " ").trim();
  }

  // The page's own path when it is opened from a file, so a saved or moved
  // copy always names itself; otherwise the path in the round facts.
  function pagePath() {
    var fromFacts = typeof facts.file === "string" ? facts.file : "";
    if (location.protocol !== "file:") return fromFacts;
    var p = location.pathname;
    try {
      p = decodeURIComponent(p);
    } catch (e) {
      // keep the encoded path
    }
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1).replace(/\//g, "\\");
    else if (location.host) p = "\\\\" + location.host + p.replace(/\//g, "\\");
    return p;
  }

  // One dial's line: the value the chosen variant has, and what it changed
  // from when it was moved.
  function dialLine(label, id, format) {
    var d = state.dials[id];
    var start = startOf(id, state.variant);
    var value = valueFor(id, state.variant);
    var line = label + ": " + format(value);
    if (d.moved && !same(value, start)) line += " (changed from " + format(start) + ")";
    return line;
  }

  function buildBlock() {
    var lines = ["Plan2Code UI prototype choice"];
    lines.push("Prototype: " + (facts.name || ""));
    lines.push("File: " + pagePath());
    lines.push("Round: " + (facts.round != null ? facts.round : ""));
    var chosen = frameOf(state.variant);
    var others = frames
      .filter(function (f) {
        return f !== chosen;
      })
      .map(function (f) {
        return f.letter + ' "' + oneLine(f.name) + '"';
      });
    lines.push("Chosen: " + (chosen ? chosen.letter + ' "' + oneLine(chosen.name) + '"' : "") + (others.length ? " (others: " + others.join(", ") + ")" : ""));
    lines.push("Carried over: " + list(facts.carried));
    lines.push("Freed up: " + list(facts.freed));
    var direction = typeof facts.direction === "string" ? oneLine(facts.direction) : "";
    if (direction) lines.push("Direction: " + direction);
    if (state.preset) lines.push("Preset: " + state.preset);
    BLOCK_LINES.forEach(function (entry) {
      var id = entry[0];
      lines.push(
        dialLine(entry[1], id, function (v) {
          return formatDial(id, v);
        })
      );
    });
    extras.forEach(function (x) {
      lines.push(
        dialLine("Extra, " + oneLine(x.label || x.name), "x-" + x.name, function (v) {
          return formatExtra(x, v);
        })
      );
    });
    var note = oneLine(noteBox.value);
    if (note) lines.push("Note: " + note);
    return lines.join("\n");
  }

  function refreshBlock() {
    if (!ready) return "";
    var text = buildBlock();
    blockBox.value = text;
    return text;
  }

  function say(copied) {
    copyStatus.textContent = copied ? "Copied. Paste it into the conversation." : "Select the text above and copy it.";
  }

  function copyNow() {
    var text = refreshBlock();
    function fallback() {
      var ok = false;
      try {
        blockBox.focus();
        blockBox.select();
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      say(ok);
    }
    copyStatus.textContent = "";
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(function () {
        say(true);
      }, fallback);
    } else {
      fallback();
    }
  }

  // The top bar's Copy opens the popover and copies in one click; the
  // popover stays open so the block can be seen.
  copyButton.setAttribute("aria-expanded", "false");
  copyButton.setAttribute("aria-controls", copyPop.id);
  copyButton.addEventListener("click", function () {
    copyPop.hidden = false;
    copyButton.setAttribute("aria-expanded", "true");
    copyNow();
  });
  copyBlockButton.addEventListener("click", copyNow);
  copyClose.addEventListener("click", function () {
    copyPop.hidden = true;
    copyButton.setAttribute("aria-expanded", "false");
    copyButton.focus();
  });
  // Escape closes the popover wherever focus is, since the top bar's Copy
  // leaves focus on that button.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !copyPop.hidden) copyClose.click();
  });
  noteBox.addEventListener("input", refreshBlock);

  /* ------------------------------------------------------------- start-up */

  if (facts.name) {
    document.title = facts.name;
    byId("p2c-name").textContent = facts.name;
  }

  window.p2c = { state: state, apply: apply };

  ready = true;
  selectVariant(state.variant);
  refresh(false);
  window.addEventListener("resize", function () {
    layout();
    if (panelAt && !panel.hidden) movePanel(panelAt.left, panelAt.top);
    if (!dialsTab.hidden) {
      // Keep the Dials tab, and the place the panel returns to, on screen.
      var r = dialsTab.getBoundingClientRect();
      var left = Math.min(Math.max(0, r.left), Math.max(0, window.innerWidth - r.width));
      var top = Math.min(Math.max(bar.offsetHeight, r.top), Math.max(bar.offsetHeight, window.innerHeight - r.height));
      dialsTab.style.left = left + "px";
      dialsTab.style.top = top + "px";
      panelAt = { left: left, top: top };
    }
  });
})();
