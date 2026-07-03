# AnonXML — Ofuscador de NF-e

**🔗 Acesse: [anonxml.netlify.app](https://anonxml.netlify.app)**

[![Netlify Status](https://api.netlify.com/api/v1/badges/288f73f7-d369-4524-90f3-878e02a485fa/deploy-status)](https://anonxml.netlify.app)

Ferramenta web que **anonimiza XMLs de NF-e / NFC-e inteiramente no navegador**.
Nenhum dado sai da máquina: todo o processamento é client-side, sem back-end e sem
chamadas externas. Os valores sensíveis não são apenas mascarados — são substituídos
por dados fictícios **válidos** (CNPJ, CPF e chave de acesso com dígitos verificadores
corretos), preservando a quantidade de linhas do XML para leitura lado a lado.

## Recursos

- Colar, arrastar/soltar ou selecionar um arquivo `.xml`.
- Visão comparativa **Entrada × Resultado** com linhas alinhadas e destaque das
  linhas alteradas.
- Seleção do que ofuscar por categoria: **Nome / razão**, **CPF / CNPJ**,
  **Inscrição estadual** e **Chave / IDs**.
- Copiar o resultado ou baixar como `*-ofuscado.xml`.
- Tema claro/escuro (persistido) e interface responsiva.
- Substituição determinística: valores fictícios são gerados por PRNG com seed,
  então o mesmo campo gera sempre o mesmo valor fake naquele documento.

## Estrutura

```
.
├── web/                 # site estático publicado (Netlify)
│   ├── index.html       # interface
│   ├── app.js           # lógica de UI (upload, diff, chips, tema, copiar/baixar)
│   ├── anonimizador.js  # motor de anonimização (gera valores fake válidos)
│   └── logo/            # logos e favicon (PNG)
├── .claude/skills/      # skill "anonimizar-xml-nfe" p/ Claude Code (CLI Python)
├── netlify.toml         # publica apenas web/ + headers de segurança (CSP)
└── README.md
```

## Rodar localmente

Basta abrir `web/index.html` no navegador (funciona via `file://`, pois os
`<script src>` são relativos). Para servir por HTTP:

```bash
cd web && python -m http.server 8080
# abra http://localhost:8080
```

## Usar como skill no Claude Code

O repositório inclui uma **skill do Claude Code** (`.claude/skills/anonimizar-xml-nfe/`)
que faz a mesma anonimização direto no terminal/agente — útil para limpar um XML
antes de anexar em um card, reportar um bug ou pedir suporte, sem sair do fluxo.

Para plugar no seu Claude Code, copie a pasta da skill para o seu projeto (ou para
`~/.claude/skills/` para deixá-la global):

```bash
# no seu projeto
mkdir -p .claude/skills
cp -r /caminho/AnonXML/.claude/skills/anonimizar-xml-nfe .claude/skills/
```

Feito isso, o Claude aciona a skill sozinho quando você pedir para "anonimizar",
"ofuscar" ou "limpar para compartilhar" um XML fiscal. Também dá para rodar o
script direto:

```bash
python .claude/skills/anonimizar-xml-nfe/scripts/anonimizar.py entrada.xml -o entrada_anon.xml
# sem -o imprime no stdout; aceita "-" para ler do stdin
```

Diferenças em relação à versão web:

- **CLI/Python** (sem navegador), pensada para o agente e scripts.
- **Mapeamento consistente**: o mesmo valor real sempre vira o mesmo fake, então os
  vínculos entre emitente/destinatário/transportadora são preservados.
- Cobre também **CT-e/MDF-e**, **assinatura digital** (certificado/`DigestValue`)
  e campos de **NFC-e** (`qrCode`, `CSRT`), mantendo município/UF e valores fiscais.
- Não mexe em **texto livre** (`infCpl`, `obsCont`, `xJust`, `xProd`): revise esses
  campos manualmente se suspeitar de PII residual.

> As regras vivem em `scripts/anonimizar.py`; a versão web (`web/anonimizador.js`) é
> uma porta em JS das mesmas funções. Ao ajustar uma, replique na outra.

## Privacidade e segurança

O `netlify.toml` aplica uma Content-Security-Policy restritiva
(`connect-src 'none'`, `script-src 'self'`), reforçando que a página não faz
requisições de rede e não carrega scripts ou fontes de terceiros. Por isso toda
a lógica fica em arquivos JS externos (sem `<script>` ou `onclick` inline) e não
há uso de CDNs ou Google Fonts.
