/*
 * AnonXML — UI do Ofuscador de NF-e (100% client-side).
 * Porta do componente Claude Design "Ofuscador NF-e.dc.html" para JS puro,
 * usando o motor comprovado de anonimizador.js (window.anonimizarXml / formatarXml).
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  // ---------------------------------------------------------------- estado
  var state = {
    rawXml: "",
    fileName: "",
    fields: { nome: true, doc: true, ie: true, chave: true },
    copied: false,
    theme: null, // resolvido em getTheme()
  };

  var CHIP_DEFS = [
    { k: "nome", label: "Nome / razão" },
    { k: "doc", label: "CPF / CNPJ" },
    { k: "ie", label: "Insc. estadual" },
    { k: "chave", label: "Chave / IDs" },
  ];

  var ICON_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var ICON_COPY = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  function getTheme() {
    if (state.theme) return state.theme;
    var stored = null;
    try { stored = localStorage.getItem("anonxml-theme"); } catch (e) {}
    if (stored === "light" || stored === "dark") return stored;
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  // ---------------------------------------------------------------- helpers
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function looksLikeXml(s) {
    return /<[a-zA-Z?][^>]*>/.test(s) && /<\//.test(s.replace(/<\?[^>]*\?>/g, ""));
  }
  function prettyXml(xml) {
    if (window.formatarXml) {
      try { return window.formatarXml(xml); } catch (e) {}
    }
    return xml;
  }
  function obfuscate(xml, fields) {
    var out = window.anonimizarXml(xml, fields);
    // conta linhas efetivamente alteradas (para o rótulo de status)
    var a = xml.split("\n"), b = out.split("\n"), n = 0;
    for (var i = 0; i < b.length; i++) if (a[i] !== b[i]) n++;
    return { out: out, count: n };
  }

  // ------------------------------------------------------------- renderers
  function buildPaneRows(text, other) {
    var lines = text.split("\n");
    var oth = other ? other.split("\n") : null;
    var html = "";
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var changed = oth && oth[i] !== ln;
      var bg = changed ? "var(--after-bg)" : "var(--surface)";
      var bar = changed ? "var(--good)" : "transparent";
      html +=
        '<div style="display:flex;background:' + bg + ';">' +
          '<span style="position:sticky;left:0;flex:0 0 42px;text-align:right;padding:1px 10px 1px 0;color:var(--num);user-select:none;border-left:2px solid ' + bar + ';background:' + bg + ';z-index:1;">' + (i + 1) + '</span>' +
          '<span style="white-space:pre;padding-right:16px;">' + (esc(ln) || " ") + '</span>' +
        '</div>';
    }
    return html;
  }

  function renderPane() {
    var pane = $("paneArea");
    var has = state.rawXml.trim().length > 0;
    if (!has) {
      pane.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;flex:1;min-height:360px;text-align:center;color:var(--faint);">' +
          '<div style="width:64px;height:64px;border-radius:16px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--num)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l6-4"></path></svg>' +
          '</div>' +
          '<p style="margin:0;font-size:14px;font-weight:600;color:var(--muted);">Nenhum XML ainda</p>' +
          '<p style="margin:0;font-size:13px;max-width:260px;">Cole ou carregue uma NF-e à esquerda para ver os dados ofuscados aqui.</p>' +
        '</div>';
      return;
    }
    var res = obfuscate(state.rawXml, state.fields);
    var container = document.createElement("div");
    container.id = "out";
    // padding vertical de 14px espelha a textarea da entrada (que tem padding interno),
    // para a barra de rolagem encostar na barra de ações sem sobrar espaço embaixo.
    container.style.cssText = "font-family:var(--font-mono);font-size:12.5px;line-height:1.75;color:var(--mono-ink);flex:1 1 0;min-height:0;overflow:auto;padding:14px 0;";
    container.innerHTML = buildPaneRows(res.out, state.rawXml);
    pane.innerHTML = "";
    pane.appendChild(container);
    bindPaneScroll();
  }

  function renderChips() {
    var wrap = $("chips");
    wrap.innerHTML = "";
    CHIP_DEFS.forEach(function (d) {
      var on = state.fields[d.k];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText =
        "display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-family:inherit;font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:100px;cursor:pointer;transition:all .12s;" +
        (on
          ? "background:var(--accent-bg);color:var(--accent);border:1px solid var(--accent-border);"
          : "background:var(--surface-2);color:var(--faint);border:1px solid var(--border);");
      btn.innerHTML =
        '<span style="width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:' +
        (on ? "var(--accent)" : "var(--num)") + ';"></span>' + d.label;
      btn.addEventListener("click", function () {
        state.fields[d.k] = !state.fields[d.k];
        state.copied = false;
        renderChips();
        renderPane();
        renderStatus();
        renderActions();
      });
      wrap.appendChild(btn);
    });
  }

  function renderStatus() {
    var has = state.rawXml.trim().length > 0;
    var stat = $("statText");
    var meta = $("inputMeta");
    if (!has) {
      stat.textContent = "aguardando XML";
      stat.style.color = "var(--faint)";
      meta.textContent = "cole ou carregue";
      return;
    }
    var res = obfuscate(state.rawXml, state.fields);
    if (res.count > 0) {
      stat.textContent = res.count + (res.count === 1 ? " linha ofuscada" : " linhas ofuscadas");
      stat.style.color = "var(--good)";
    } else {
      stat.textContent = "nenhum campo encontrado";
      stat.style.color = "var(--faint)";
    }
    meta.textContent = state.fileName ? state.fileName : state.rawXml.split("\n").length + " linhas";
  }

  function renderGutter() {
    var n = Math.max(1, state.rawXml.split("\n").length);
    var s = "";
    for (var i = 1; i <= n; i++) s += i + (i < n ? "\n" : "");
    $("gutter").textContent = s;
  }

  function renderActions() {
    var disabled = state.rawXml.trim().length === 0;
    var copy = $("btnCopy"), dl = $("btnDownload");
    copy.disabled = disabled;
    dl.disabled = disabled;

    copy.style.cssText =
      "flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-size:13.5px;font-weight:600;padding:10px 14px;border-radius:10px;border:none;cursor:" +
      (disabled ? "not-allowed;" : "pointer;") +
      (state.copied
        ? "background:var(--good);color:#fff;"
        : disabled
        ? "background:var(--surface-2);color:var(--faint);"
        : "background:var(--accent);color:#fff;box-shadow:0 2px 8px var(--accent-shadow);");

    dl.style.cssText =
      "flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-size:13.5px;font-weight:600;padding:10px 16px;border-radius:10px;cursor:" +
      (disabled ? "not-allowed;" : "pointer;") +
      (disabled
        ? "background:var(--surface-2);color:var(--faint);border:1px solid var(--border);"
        : "background:var(--surface);color:var(--accent);border:1px solid var(--accent-border);");

    $("copyIcon").innerHTML = state.copied ? ICON_CHECK : ICON_COPY;
    $("copyLabel").textContent = state.copied ? "Copiado!" : "Copiar resultado";
  }

  function segStyle(active) {
    return "font-family:inherit;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:7px;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:6px;transition:all .12s;" +
      (active ? "background:var(--surface);color:var(--ink);box-shadow:0 1px 2px var(--shadow);" : "background:transparent;color:var(--muted);");
  }

  function renderTheme() {
    var theme = getTheme();
    var root = $("root");
    root.setAttribute("data-theme", theme);
    document.body.style.background = theme === "dark" ? "#1A1917" : "#F4F2EC";
    // PNGs transparentes: no tema claro usa a logo escura (contraste no fundo claro);
    // no tema escuro usa a logo clara (branca) para aparecer no fundo escuro.
    $("brandLogo").src = theme === "dark" ? "logo/AnonXML-Logo-Light.png" : "logo/AnonXML-Logo-Dark.png";
    $("btnLight").style.cssText = segStyle(theme === "light");
    $("btnDark").style.cssText = segStyle(theme === "dark");
  }

  function renderAll() {
    renderTheme();
    renderGutter();
    renderChips();
    renderPane();
    renderStatus();
    renderActions();
  }

  // ------------------------------------------------------------- scroll sync
  var syncing = false;
  function bindPaneScroll() {
    var src = $("src"), out = $("out"), g = $("gutter");
    if (!src || !out) return;
    out.onscroll = function () {
      if (syncing) return;
      syncing = true;
      var range = out.scrollHeight - out.clientHeight;
      var ratio = range > 0 ? out.scrollTop / range : 0;
      src.scrollTop = ratio * (src.scrollHeight - src.clientHeight);
      if (g) g.scrollTop = src.scrollTop;
      requestAnimationFrame(function () { syncing = false; });
    };
  }
  function bindSrcScroll() {
    var src = $("src");
    src.addEventListener("scroll", function () {
      var g = $("gutter"), out = $("out");
      if (g) g.scrollTop = src.scrollTop;
      if (out && !syncing) {
        syncing = true;
        var range = src.scrollHeight - src.clientHeight;
        var ratio = range > 0 ? src.scrollTop / range : 0;
        out.scrollTop = ratio * (out.scrollHeight - out.clientHeight);
        requestAnimationFrame(function () { syncing = false; });
      }
    });
  }

  // ------------------------------------------------------------- input flow
  function setXml(xml, fileName) {
    state.rawXml = xml;
    state.fileName = fileName || "";
    state.copied = false;
    renderGutter();
    renderPane();
    renderStatus();
    renderActions();
  }

  function readFile(file) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      var txt = String(r.result);
      if (looksLikeXml(txt)) txt = prettyXml(txt);
      $("src").value = txt;
      setXml(txt, file.name);
    };
    r.readAsText(file, "utf-8");
  }

  // ---------------------------------------------------------------- init
  function init() {
    var src = $("src"), dropArea = $("dropArea");

    src.addEventListener("input", function () { setXml(src.value, ""); });
    src.addEventListener("paste", function (e) {
      var cd = e.clipboardData || window.clipboardData;
      var text = cd && cd.getData("text");
      if (text && looksLikeXml(text)) {
        e.preventDefault();
        var pretty = prettyXml(text);
        src.value = pretty;
        setXml(pretty, "");
      }
    });

    bindSrcScroll();

    $("fileInput").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      readFile(f);
      e.target.value = "";
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      dropArea.addEventListener(ev, function (e) {
        e.preventDefault();
        dropArea.style.borderColor = "var(--accent)";
        dropArea.style.background = "var(--accent-bg)";
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dropArea.addEventListener(ev, function (e) {
        e.preventDefault();
        dropArea.style.borderColor = "var(--border)";
        dropArea.style.background = "var(--surface)";
      });
    });
    dropArea.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      readFile(f);
    });

    $("btnSample").addEventListener("click", function () {
      src.value = SAMPLE;
      setXml(SAMPLE, "exemplo-nfe.xml");
    });
    $("btnClear").addEventListener("click", function () {
      src.value = "";
      setXml("", "");
    });

    $("btnCopy").addEventListener("click", function () {
      if (!state.rawXml.trim()) return;
      var res = obfuscate(state.rawXml, state.fields);
      var done = function () {
        state.copied = true;
        renderActions();
        clearTimeout(window._anonCopyT);
        window._anonCopyT = setTimeout(function () { state.copied = false; renderActions(); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(res.out).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = res.out; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        ta.remove(); done();
      }
    });

    $("btnDownload").addEventListener("click", function () {
      if (!state.rawXml.trim()) return;
      var res = obfuscate(state.rawXml, state.fields);
      var blob = new Blob([res.out], { type: "application/xml" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var base = (state.fileName || "nfe.xml").replace(/\.xml$/i, "");
      a.href = url; a.download = base + "-ofuscado.xml";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    function pickTheme(t) {
      state.theme = t;
      try { localStorage.setItem("anonxml-theme", t); } catch (e) {}
      renderTheme();
    }
    $("btnLight").addEventListener("click", function () { pickTheme("light"); });
    $("btnDark").addEventListener("click", function () { pickTheme("dark"); });

    renderAll();
  }

  // ---------------------------------------------------------------- sample
  var SAMPLE = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<nfeProc versao="4.00">',
    '  <NFe>',
    '    <infNFe Id="NFe35240612345678000190550010000004271098765432" versao="4.00">',
    '      <emit>',
    '        <CNPJ>12345678000190</CNPJ>',
    '        <xNome>Comercial Aurora Distribuidora LTDA</xNome>',
    '        <xFant>Aurora Distribuidora</xFant>',
    '        <enderEmit>',
    '          <xLgr>Avenida das Palmeiras</xLgr>',
    '          <nro>1500</nro>',
    '          <xBairro>Centro</xBairro>',
    '          <xMun>Sao Paulo</xMun>',
    '          <UF>SP</UF>',
    '          <CEP>01310100</CEP>',
    '          <fone>1133224455</fone>',
    '        </enderEmit>',
    '        <IE>110042490114</IE>',
    '      </emit>',
    '      <dest>',
    '        <CPF>52998224725</CPF>',
    '        <xNome>Mariana Ribeiro de Souza</xNome>',
    '        <enderDest>',
    '          <xLgr>Rua dos Girassois</xLgr>',
    '          <nro>85</nro>',
    '          <xBairro>Jardim America</xBairro>',
    '          <xMun>Campinas</xMun>',
    '          <UF>SP</UF>',
    '          <CEP>13010200</CEP>',
    '        </enderDest>',
    '        <IE>253647890</IE>',
    '        <email>mariana.souza@email.com.br</email>',
    '      </dest>',
    '    </infNFe>',
    '  </NFe>',
    '  <protNFe versao="4.00">',
    '    <infProt>',
    '      <chNFe>35240612345678000190550010000004271098765432</chNFe>',
    '      <nProt>135240001234567</nProt>',
    '    </infProt>',
    '  </protNFe>',
    '</nfeProc>',
  ].join("\n");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
