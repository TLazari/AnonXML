# AnonXML — Ofuscador de NF-e

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

## Privacidade e segurança

O `netlify.toml` aplica uma Content-Security-Policy restritiva
(`connect-src 'none'`, `script-src 'self'`), reforçando que a página não faz
requisições de rede e não carrega scripts ou fontes de terceiros. Por isso toda
a lógica fica em arquivos JS externos (sem `<script>` ou `onclick` inline) e não
há uso de CDNs ou Google Fonts.

## Deploy no Netlify

O `netlify.toml` na raiz já define `publish = "web"` (sem etapa de build).

```bash
# instale a CLI uma vez: npm i -g netlify-cli
netlify deploy --dir=web            # preview
netlify deploy --dir=web --prod     # produção
```

Ou conecte o repositório no painel do Netlify — ele lê o `netlify.toml`
automaticamente e publica apenas a pasta `web/`.
