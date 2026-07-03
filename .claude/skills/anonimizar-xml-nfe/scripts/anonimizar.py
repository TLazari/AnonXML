#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anonimiza XMLs de NF-e / NFC-e (e correlatos: CT-e, eventos) substituindo
dados pessoais/identificaveis por valores genericos, mantendo formato VALIDO
(CNPJ/CPF com DV correto, chave de acesso de 44 digitos com DV valido).

Uso:
    python anonimizar.py entrada.xml [-o saida.xml]
    python anonimizar.py entrada.xml            # imprime no stdout se sem -o
    cat entrada.xml | python anonimizar.py -     # le do stdin

Caracteristicas:
- Preserva municipio (cMun/xMun) e UF por padrao (nao sao dados pessoais).
- Mapeamento CONSISTENTE: o mesmo valor original vira sempre o mesmo fake,
  entao os relacionamentos (ex.: emitente citado em varios pontos) sao mantidos.
- Namespace-agnostico: opera sobre os nomes das tags, funciona com ou sem prefixo.
- Nao valida schema; apenas substitui conteudo de tags e atributos conhecidos.

ATENCAO: campos de texto livre (infCpl, xObs, obsCont, infAdFisco, xJust)
NAO sao alterados automaticamente porque podem conter informacao legitima.
Revise-os manualmente (o SKILL.md orienta o assistente a fazer isso).
"""

import sys
import re
import argparse
import hashlib


# ---------------------------------------------------------------------------
# Digitos verificadores
# ---------------------------------------------------------------------------
def _dv_cnpj(base12: str) -> str:
    def calc(nums, pesos):
        s = sum(int(n) * p for n, p in zip(nums, pesos))
        r = s % 11
        return "0" if r < 2 else str(11 - r)
    p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = calc(base12, p1)
    d2 = calc(base12 + d1, p2)
    return base12 + d1 + d2


def _dv_cpf(base9: str) -> str:
    def calc(nums):
        n = len(nums)
        s = sum(int(d) * (n + 1 - i) for i, d in enumerate(nums))
        r = (s * 10) % 11
        return "0" if r == 10 else str(r)
    d1 = calc(base9)
    d2 = calc(base9 + d1)
    return base9 + d1 + d2


def _dv_chave(base43: str) -> str:
    pesos = [2, 3, 4, 5, 6, 7, 8, 9]
    s = 0
    for i, d in enumerate(reversed(base43)):
        s += int(d) * pesos[i % 8]
    r = s % 11
    dv = 0 if r in (0, 1) else 11 - r
    return base43 + str(dv)


def _digitos_from(seed: str, n: int) -> str:
    """Gera n digitos deterministicos a partir de um seed (hash)."""
    h = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    out = "".join(str(int(c, 16) % 10) for c in h)
    while len(out) < n:
        h = hashlib.sha256(h.encode("utf-8")).hexdigest()
        out += "".join(str(int(c, 16) % 10) for c in h)
    return out[:n]


# ---------------------------------------------------------------------------
# Geradores de valores fake consistentes (cache por valor original)
# ---------------------------------------------------------------------------
class Faker:
    def __init__(self):
        self._cache = {}
        self._counters = {}

    def _next(self, tipo):
        self._counters[tipo] = self._counters.get(tipo, 0) + 1
        return self._counters[tipo]

    def cnpj(self, original):
        key = ("cnpj", original)
        if key not in self._cache:
            base = _digitos_from("cnpj" + original, 12)
            self._cache[key] = _dv_cnpj(base)
        return self._cache[key]

    def cpf(self, original):
        key = ("cpf", original)
        if key not in self._cache:
            base = _digitos_from("cpf" + original, 9)
            self._cache[key] = _dv_cpf(base)
        return self._cache[key]

    def chave(self, original):
        key = ("chave", original)
        if key not in self._cache:
            base = _digitos_from("chave" + original, 43)
            self._cache[key] = _dv_chave(base)
        return self._cache[key]

    def digitos(self, original, n):
        key = ("dig", n, original)
        if key not in self._cache:
            self._cache[key] = _digitos_from(f"d{n}" + original, n)
        return self._cache[key]

    def texto(self, original, template):
        key = ("txt", template, original)
        if key not in self._cache:
            self._cache[key] = template.format(n=self._next(template))
        return self._cache[key]


# ---------------------------------------------------------------------------
# Substituicao de conteudo de tags (namespace-agnostico)
# ---------------------------------------------------------------------------
def _replace_tag(xml, tag, fn):
    """Substitui o conteudo de <tag>...</tag> usando fn(valor_original)->novo.
    Ignora tags vazias, preserva prefixo de namespace e entende CDATA."""
    pattern = re.compile(
        r"(<(?:\w+:)?%s\b[^>]*>)(<!\[CDATA\[.*?\]\]>|[^<]*)(</(?:\w+:)?%s\s*>)"
        % (re.escape(tag), re.escape(tag)),
        re.DOTALL,
    )

    def repl(m):
        raw = m.group(2)
        cdata = raw.startswith("<![CDATA[")
        original = raw[9:-3] if cdata else raw
        if original.strip() == "":
            return m.group(0)
        return m.group(1) + fn(original) + m.group(3)

    return pattern.sub(repl, xml)


def _anonimizar_nomes(xml: str, f: "Faker") -> str:
    """Substitui <xNome> escolhendo o template conforme o bloco que o contem:
    bloco com CPF (e sem CNPJ) => pessoa fisica -> "NOME EXEMPLO N";
    caso contrario => empresa -> "RAZAO SOCIAL EXEMPLO N LTDA".
    Blocos considerados: emit, dest, transporta, retirada, entrega, avulsa."""
    blocos = ["emit", "dest", "transporta", "retirada", "entrega", "avulsa",
              "rem", "exped", "receb", "toma", "toma3", "toma4", "prest"]

    def repl_bloco(m):
        conteudo = m.group(0)
        tem_cpf = re.search(r"<(?:\w+:)?CPF\b[^>]*>\s*\d", conteudo) is not None
        tem_cnpj = re.search(r"<(?:\w+:)?CNPJ\b[^>]*>\s*\d", conteudo) is not None
        pessoa = tem_cpf and not tem_cnpj
        template = "NOME EXEMPLO {n}" if pessoa else "RAZAO SOCIAL EXEMPLO {n} LTDA"
        return _replace_tag(conteudo, "xNome", lambda v: f.texto(v, template))

    for tag in blocos:
        pattern = re.compile(
            r"<(?:\w+:)?%s\b[^>]*>.*?</(?:\w+:)?%s\s*>" % (re.escape(tag), re.escape(tag)),
            re.DOTALL,
        )
        xml = pattern.sub(repl_bloco, xml)

    # Fallback: <xNome> fora dos blocos conhecidos -> empresa. Ignora os que ja
    # foram substituidos por valores genericos (evita reprocessar).
    def fallback(v):
        if v.startswith("NOME EXEMPLO") or v.startswith("RAZAO SOCIAL EXEMPLO"):
            return v
        return f.texto(v, "RAZAO SOCIAL EXEMPLO {n} LTDA")
    xml = _replace_tag(xml, "xNome", fallback)
    return xml


def anonimizar(xml: str) -> str:
    f = Faker()

    # --- Documentos: CNPJ / CPF ---
    xml = _replace_tag(xml, "CNPJ", f.cnpj)
    xml = _replace_tag(xml, "CPF", f.cpf)
    xml = _replace_tag(xml, "CNPJCPF", lambda v: f.cnpj(v) if len(re.sub(r"\D", "", v)) > 11 else f.cpf(v))
    xml = _replace_tag(xml, "idEstrangeiro", lambda v: f.digitos(v, len(re.sub(r"\D", "", v)) or 8))

    # --- Inscricoes ---
    xml = _replace_tag(xml, "IE", lambda v: v if v.strip().upper() == "ISENTO" else f.digitos(v, len(re.sub(r"\D", "", v)) or 9))
    xml = _replace_tag(xml, "IEST", lambda v: f.digitos(v, len(re.sub(r"\D", "", v)) or 9))
    xml = _replace_tag(xml, "IM", lambda v: f.digitos(v, len(re.sub(r"\D", "", v)) or 8))
    xml = _replace_tag(xml, "ISUF", lambda v: f.digitos(v, len(re.sub(r"\D", "", v)) or 8))
    xml = _replace_tag(xml, "IEDest", lambda v: f.digitos(v, len(re.sub(r"\D", "", v)) or 9))

    # --- Razao social / nomes ---
    # xNome pode ser empresa (bloco com CNPJ) ou pessoa fisica (bloco com CPF).
    # Processamos por bloco (emit/dest/transporta/...) para escolher o template certo.
    xml = _anonimizar_nomes(xml, f)
    xml = _replace_tag(xml, "xFant", lambda v: f.texto(v, "NOME FANTASIA EXEMPLO {n}"))
    xml = _replace_tag(xml, "xContato", lambda v: f.texto(v, "CONTATO EXEMPLO {n}"))

    # --- Endereco (municipio/UF preservados) ---
    xml = _replace_tag(xml, "xLgr", lambda v: "RUA EXEMPLO")
    xml = _replace_tag(xml, "nro", lambda v: "123")
    xml = _replace_tag(xml, "xCpl", lambda v: "COMPLEMENTO EXEMPLO")
    xml = _replace_tag(xml, "xBairro", lambda v: "BAIRRO EXEMPLO")
    xml = _replace_tag(xml, "CEP", lambda v: "00000000")
    xml = _replace_tag(xml, "fone", lambda v: "0000000000")
    xml = _replace_tag(xml, "email", lambda v: "exemplo@exemplo.com.br")

    # --- Chaves de acesso e protocolos ---
    xml = _replace_tag(xml, "chNFe", f.chave)
    xml = _replace_tag(xml, "chCTe", f.chave)
    xml = _replace_tag(xml, "chave", f.chave)
    xml = _replace_tag(xml, "refNFe", f.chave)
    xml = _replace_tag(xml, "refCTe", f.chave)
    xml = _replace_tag(xml, "nProt", lambda v: f.digitos(v, len(re.sub(r"\D", "", v)) or 15))

    # Id="NFe444...(44 digitos)" / Id="CTe..." / Id="MDFe..." em infNFe/infCte etc.
    def _repl_id_attr(m):
        abre, prefixo, chave44 = m.group(1), m.group(2), m.group(3)
        return abre + prefixo + f.chave(chave44)
    xml = re.sub(r'(\bId=")((?:NFe|CTe|MDFe|ID)?)(\d{44})', _repl_id_attr, xml)
    # URI="#NFe...44 digitos" no <Reference> da assinatura (mesma chave do Id)
    xml = re.sub(r'(URI="#)((?:NFe|CTe|MDFe)?)(\d{44})', _repl_id_attr, xml)

    # --- Transporte ---
    xml = _replace_tag(xml, "placa", lambda v: "ABC1D23")
    xml = _replace_tag(xml, "RNTC", lambda v: f.digitos(v, len(re.sub(r"\D", "", v)) or 8))
    xml = _replace_tag(xml, "vagao", lambda v: "VAGAO EXEMPLO")
    xml = _replace_tag(xml, "balsa", lambda v: "BALSA EXEMPLO")

    # --- NFC-e: QRCode / URL / CSRT (contem chave + CNPJ) ---
    xml = _replace_tag(xml, "qrCode", lambda v: "https://www.exemplo.gov.br/nfce/qrcode?chNFe=EXEMPLO")
    xml = _replace_tag(xml, "urlChave", lambda v: "www.exemplo.gov.br/nfce")
    xml = _replace_tag(xml, "hashCSRT", lambda v: f.digitos(v, len(v) if v.isdigit() else 28))
    xml = _replace_tag(xml, "CSRT", lambda v: "CSRTEXEMPLO")

    # --- Assinatura digital (o certificado embute nome/CNPJ do emitente) ---
    xml = _replace_tag(xml, "DigestValue", lambda v: "DIGEST_EXEMPLO=")
    xml = _replace_tag(xml, "SignatureValue", lambda v: "SIGNATURE_EXEMPLO=")
    xml = _replace_tag(xml, "X509Certificate", lambda v: "CERTIFICADO_EXEMPLO=")
    xml = _replace_tag(xml, "Modulus", lambda v: "MODULUS_EXEMPLO=")
    xml = _replace_tag(xml, "X509IssuerName", lambda v: "CN=AC EXEMPLO")
    xml = _replace_tag(xml, "X509SerialNumber", lambda v: "0")

    return xml


def main():
    ap = argparse.ArgumentParser(description="Anonimiza XML de NF-e/NFC-e.")
    ap.add_argument("entrada", help="Arquivo XML de entrada (ou '-' para stdin).")
    ap.add_argument("-o", "--saida", help="Arquivo de saida (default: stdout).")
    args = ap.parse_args()

    if args.entrada == "-":
        xml = sys.stdin.read()
    else:
        with open(args.entrada, "r", encoding="utf-8") as fh:
            xml = fh.read()

    resultado = anonimizar(xml)

    if args.saida:
        with open(args.saida, "w", encoding="utf-8") as fh:
            fh.write(resultado)
        sys.stderr.write(f"XML anonimizado salvo em: {args.saida}\n")
    else:
        sys.stdout.write(resultado)


if __name__ == "__main__":
    main()
