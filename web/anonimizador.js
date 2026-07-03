/*
 * Anonimizador de XML de NF-e/NFC-e — versao JavaScript (100% client-side).
 * Porta fiel de scripts/anonimizar.py. Nenhum dado sai do navegador.
 */

// ---------------------------------------------------------------------------
// Digitos verificadores
// ---------------------------------------------------------------------------
function dvCnpj(base12) {
  const calc = (nums, pesos) => {
    let s = 0;
    for (let i = 0; i < pesos.length; i++) s += parseInt(nums[i], 10) * pesos[i];
    const r = s % 11;
    return r < 2 ? "0" : String(11 - r);
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(base12, p1);
  const d2 = calc(base12 + d1, p2);
  return base12 + d1 + d2;
}

function dvCpf(base9) {
  const calc = (nums) => {
    const n = nums.length;
    let s = 0;
    for (let i = 0; i < n; i++) s += parseInt(nums[i], 10) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? "0" : String(r);
  };
  const d1 = calc(base9);
  const d2 = calc(base9 + d1);
  return base9 + d1 + d2;
}

function dvChave(base43) {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let s = 0;
  const rev = base43.split("").reverse();
  for (let i = 0; i < rev.length; i++) s += parseInt(rev[i], 10) * pesos[i % 8];
  const r = s % 11;
  const dv = r === 0 || r === 1 ? 0 : 11 - r;
  return base43 + String(dv);
}

// Gerador deterministico de digitos a partir de um seed (hash simples + PRNG).
function _xfnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function _mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function digitosFrom(seed, n) {
  const rng = _mulberry32(_xfnv1a(seed));
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(rng() * 10);
  return out;
}

// ---------------------------------------------------------------------------
// Faker — valores fake consistentes (mesmo original -> mesmo fake)
// ---------------------------------------------------------------------------
class Faker {
  constructor() {
    this.cache = new Map();
    this.counters = new Map();
  }
  _next(tipo) {
    const v = (this.counters.get(tipo) || 0) + 1;
    this.counters.set(tipo, v);
    return v;
  }
  _cached(key, fn) {
    if (!this.cache.has(key)) this.cache.set(key, fn());
    return this.cache.get(key);
  }
  cnpj(original) {
    return this._cached("cnpj|" + original, () => dvCnpj(digitosFrom("cnpj" + original, 12)));
  }
  cpf(original) {
    return this._cached("cpf|" + original, () => dvCpf(digitosFrom("cpf" + original, 9)));
  }
  chave(original) {
    return this._cached("chave|" + original, () => dvChave(digitosFrom("chave" + original, 43)));
  }
  digitos(original, n) {
    return this._cached("dig|" + n + "|" + original, () => digitosFrom("d" + n + original, n));
  }
  texto(original, template) {
    return this._cached("txt|" + template + "|" + original, () =>
      template.replace("{n}", this._next(template))
    );
  }
}

// ---------------------------------------------------------------------------
// Substituicao de conteudo de tags (namespace-agnostico, entende CDATA)
// ---------------------------------------------------------------------------
function _esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTag(xml, tag, fn) {
  const t = _esc(tag);
  const pattern = new RegExp(
    "(<(?:\\w+:)?" + t + "\\b[^>]*>)(<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|[^<]*)(</(?:\\w+:)?" + t + "\\s*>)",
    "g"
  );
  return xml.replace(pattern, (m, abre, raw, fecha) => {
    const cdata = raw.startsWith("<![CDATA[");
    const original = cdata ? raw.slice(9, -3) : raw;
    if (original.trim() === "") return m;
    return abre + fn(original) + fecha;
  });
}

function _soDigitos(v) {
  return v.replace(/\D/g, "");
}

function anonimizarNomes(xml, f) {
  const blocos = [
    "emit", "dest", "transporta", "retirada", "entrega", "avulsa",
    "rem", "exped", "receb", "toma", "toma3", "toma4", "prest",
  ];
  const replBloco = (m) => {
    const conteudo = m;
    const temCpf = /<(?:\w+:)?CPF\b[^>]*>\s*\d/.test(conteudo);
    const temCnpj = /<(?:\w+:)?CNPJ\b[^>]*>\s*\d/.test(conteudo);
    const pessoa = temCpf && !temCnpj;
    const template = pessoa ? "NOME EXEMPLO {n}" : "RAZAO SOCIAL EXEMPLO {n} LTDA";
    return replaceTag(conteudo, "xNome", (v) => f.texto(v, template));
  };
  for (const tag of blocos) {
    const t = _esc(tag);
    const pattern = new RegExp(
      "<(?:\\w+:)?" + t + "\\b[^>]*>[\\s\\S]*?</(?:\\w+:)?" + t + "\\s*>",
      "g"
    );
    xml = xml.replace(pattern, replBloco);
  }
  // Fallback: xNome fora dos blocos -> empresa (ignora os ja substituidos).
  xml = replaceTag(xml, "xNome", (v) => {
    if (v.startsWith("NOME EXEMPLO") || v.startsWith("RAZAO SOCIAL EXEMPLO")) return v;
    return f.texto(v, "RAZAO SOCIAL EXEMPLO {n} LTDA");
  });
  return xml;
}

// ---------------------------------------------------------------------------
// Funcao principal
// ---------------------------------------------------------------------------
// opts (todos default = true) permite ligar/desligar grupos de campos pela UI:
//   nome  -> razao social / nome / fantasia / contato
//   doc   -> CNPJ / CPF / CNPJCPF / idEstrangeiro
//   ie    -> inscricoes (IE, IEST, IM, ISUF, IEDest)
//   chave -> chaves de acesso, protocolos e atributos Id/URI
// Endereco, transporte, NFC-e e assinatura sao sempre anonimizados (nao tem toggle).
function anonimizarXml(xml, opts) {
  const o = opts || {};
  const on = (k) => o[k] !== false; // ausente = ligado
  const f = new Faker();

  // Documentos
  if (on("doc")) {
    xml = replaceTag(xml, "CNPJ", (v) => f.cnpj(v));
    xml = replaceTag(xml, "CPF", (v) => f.cpf(v));
    xml = replaceTag(xml, "CNPJCPF", (v) => (_soDigitos(v).length > 11 ? f.cnpj(v) : f.cpf(v)));
    xml = replaceTag(xml, "idEstrangeiro", (v) => f.digitos(v, _soDigitos(v).length || 8));
  }

  // Inscricoes
  if (on("ie")) {
    xml = replaceTag(xml, "IE", (v) =>
      v.trim().toUpperCase() === "ISENTO" ? v : f.digitos(v, _soDigitos(v).length || 9)
    );
    xml = replaceTag(xml, "IEST", (v) => f.digitos(v, _soDigitos(v).length || 9));
    xml = replaceTag(xml, "IM", (v) => f.digitos(v, _soDigitos(v).length || 8));
    xml = replaceTag(xml, "ISUF", (v) => f.digitos(v, _soDigitos(v).length || 8));
    xml = replaceTag(xml, "IEDest", (v) => f.digitos(v, _soDigitos(v).length || 9));
  }

  // Nomes (empresa vs pessoa fisica por bloco)
  if (on("nome")) {
    xml = anonimizarNomes(xml, f);
    xml = replaceTag(xml, "xFant", (v) => f.texto(v, "NOME FANTASIA EXEMPLO {n}"));
    xml = replaceTag(xml, "xContato", (v) => f.texto(v, "CONTATO EXEMPLO {n}"));
  }

  // Endereco (municipio/UF preservados)
  xml = replaceTag(xml, "xLgr", () => "RUA EXEMPLO");
  xml = replaceTag(xml, "nro", () => "123");
  xml = replaceTag(xml, "xCpl", () => "COMPLEMENTO EXEMPLO");
  xml = replaceTag(xml, "xBairro", () => "BAIRRO EXEMPLO");
  xml = replaceTag(xml, "CEP", () => "00000000");
  xml = replaceTag(xml, "fone", () => "0000000000");
  xml = replaceTag(xml, "email", () => "exemplo@exemplo.com.br");

  // Chaves de acesso e protocolos
  if (on("chave")) {
    xml = replaceTag(xml, "chNFe", (v) => f.chave(v));
    xml = replaceTag(xml, "chCTe", (v) => f.chave(v));
    xml = replaceTag(xml, "chave", (v) => f.chave(v));
    xml = replaceTag(xml, "refNFe", (v) => f.chave(v));
    xml = replaceTag(xml, "refCTe", (v) => f.chave(v));
    xml = replaceTag(xml, "nProt", (v) => f.digitos(v, _soDigitos(v).length || 15));

    // Id="NFe...44" e URI="#NFe...44" (mesma chave)
    const replChave44 = (m, abre, prefixo, chave44) => abre + prefixo + f.chave(chave44);
    xml = xml.replace(/(\bId=")((?:NFe|CTe|MDFe|ID)?)(\d{44})/g, replChave44);
    xml = xml.replace(/(URI="#)((?:NFe|CTe|MDFe)?)(\d{44})/g, replChave44);
  }

  // Transporte
  xml = replaceTag(xml, "placa", () => "ABC1D23");
  xml = replaceTag(xml, "RNTC", (v) => f.digitos(v, _soDigitos(v).length || 8));
  xml = replaceTag(xml, "vagao", () => "VAGAO EXEMPLO");
  xml = replaceTag(xml, "balsa", () => "BALSA EXEMPLO");

  // NFC-e: QRCode / URL / CSRT
  xml = replaceTag(xml, "qrCode", () => "https://www.exemplo.gov.br/nfce/qrcode?chNFe=EXEMPLO");
  xml = replaceTag(xml, "urlChave", () => "www.exemplo.gov.br/nfce");
  xml = replaceTag(xml, "hashCSRT", (v) => f.digitos(v, /^\d+$/.test(v) ? v.length : 28));
  xml = replaceTag(xml, "CSRT", () => "CSRTEXEMPLO");

  // Assinatura digital
  xml = replaceTag(xml, "DigestValue", () => "DIGEST_EXEMPLO=");
  xml = replaceTag(xml, "SignatureValue", () => "SIGNATURE_EXEMPLO=");
  xml = replaceTag(xml, "X509Certificate", () => "CERTIFICADO_EXEMPLO=");
  xml = replaceTag(xml, "Modulus", () => "MODULUS_EXEMPLO=");
  xml = replaceTag(xml, "X509IssuerName", () => "CN=AC EXEMPLO");
  xml = replaceTag(xml, "X509SerialNumber", () => "0");

  return xml;
}

// ---------------------------------------------------------------------------
// Pretty-print de XML (identacao) — para XMLs gerados em uma linha so
// ---------------------------------------------------------------------------
function formatarXml(xml) {
  xml = xml.trim();
  // Quebra linha somente nas fronteiras entre tags (>< ), preservando texto de folhas.
  xml = xml.replace(/>\s*</g, ">\n<");
  const linhas = xml.split("\n");
  const PAD = "  ";
  let indent = 0;
  const out = [];
  for (let linha of linhas) {
    linha = linha.trim();
    if (!linha) continue;
    const fechamento = /^<\/[^>]+>$/.test(linha);
    const declOuComentario = /^<\?.*\?>$/.test(linha) || /^<!--/.test(linha) || /^<!\[CDATA\[/.test(linha);
    const autoFechada = /\/>$/.test(linha);
    const inline = /^<([\w:.-]+)\b[^>]*>.*<\/\1\s*>$/.test(linha); // <tag>texto</tag>
    const abertura = /^<[^/!?][^>]*[^/]>$/.test(linha);

    if (fechamento) {
      indent = Math.max(indent - 1, 0);
      out.push(PAD.repeat(indent) + linha);
    } else if (declOuComentario || autoFechada || inline) {
      out.push(PAD.repeat(indent) + linha);
    } else if (abertura) {
      out.push(PAD.repeat(indent) + linha);
      indent += 1;
    } else {
      out.push(PAD.repeat(indent) + linha);
    }
  }
  return out.join("\n");
}

// Expor no escopo global para o index.html (e permitir testes em Node)
if (typeof window !== "undefined") {
  window.anonimizarXml = anonimizarXml;
  window.formatarXml = formatarXml;
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { anonimizarXml, formatarXml, dvCnpj, dvCpf, dvChave };
