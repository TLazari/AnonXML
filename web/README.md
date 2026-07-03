# Anonimizador de XML de NF-e (web)

Página estática que anonimiza XMLs de NF-e/NFC-e **inteiramente no navegador**.
Nenhum dado é enviado para servidores — todo o processamento é client-side.

## Arquivos
- `index.html` — interface (upload, colar, copiar, baixar)
- `anonimizador.js` — lógica de anonimização (porta JS de `../.claude/skills/anonimizar-xml-nfe/scripts/anonimizar.py`)

## Testar localmente
Basta abrir `index.html` no navegador. Como o `<script src>` é relativo, funciona
via `file://`. Para servir por HTTP:

```bash
cd web && python -m http.server 8080
# abra http://localhost:8080
```

## Deploy no Netlify

### Opção A — Drag & drop (mais rápido)
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `web/` para a página. Pronto, sai a URL.

### Opção B — Git + CLI (contínuo)
Na raiz do projeto há um `netlify.toml` com `publish = "web"`.

```bash
# instale a CLI uma vez: npm i -g netlify-cli
netlify deploy --dir=web            # preview
netlify deploy --dir=web --prod     # produção
```

Ou conecte o repositório no painel do Netlify — ele lê o `netlify.toml`
automaticamente (sem build step, apenas publica `web/`).

## Manutenção
Ao alterar as regras em `anonimizar.py`, replique em `anonimizador.js` para manter
os dois em paridade (as funções têm os mesmos nomes/estrutura).
