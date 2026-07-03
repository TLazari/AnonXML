---
name: anonimizar-xml-nfe
description: Anonimiza XMLs de NF-e/NFC-e (e correlatos como CT-e/MDF-e) substituindo dados pessoais e identificáveis — CNPJ, CPF, razão social, endereço, inscrições, chave de acesso, assinatura digital, QRCode — por valores genéricos com formato válido, para que o XML possa ser compartilhado com segurança. Use quando o usuário pedir para anonimizar, ofuscar, mascarar, "limpar" ou "tornar seguro para compartilhar" um XML fiscal.
---

# Anonimizar XML de NF-e

Substitui dados sensíveis de um XML fiscal por valores genéricos, mantendo o
documento estruturalmente válido para que possa ser compartilhado (ex.: anexar
em card do ClickUp, reportar bug, enviar para suporte) sem expor dados reais.

## Como usar

Execute o script sobre o XML. Ele é determinístico e não altera a estrutura:

```bash
python .claude/skills/anonimizar-xml-nfe/scripts/anonimizar.py entrada.xml -o entrada_anon.xml
```

Sem `-o`, imprime no stdout. Aceita `-` como entrada para ler do stdin.

Se o usuário colar o XML direto no chat, salve-o em um arquivo temporário no
scratchpad, rode o script e devolva o resultado anonimizado.

## O que o script anonimiza (formato válido preservado)

- **Documentos**: `CNPJ` (DV recalculado), `CPF` (DV recalculado), `CNPJCPF`, `idEstrangeiro`
- **Inscrições**: `IE` (mantém "ISENTO"), `IEST`, `IM`, `ISUF`, `IEDest`
- **Nomes**: `xNome` → empresa (bloco com CNPJ) vira "RAZAO SOCIAL EXEMPLO N LTDA";
  pessoa física (bloco com CPF) vira "NOME EXEMPLO N". Também `xFant`, `xContato`.
- **Endereço**: `xLgr`, `nro`, `xCpl`, `xBairro`, `CEP`, `fone`, `email`
- **Chaves/protocolo**: `chNFe`, `chCTe`, `chave`, `refNFe`, `refCTe`, `nProt`,
  e o atributo `Id="...44 dígitos"` (chave de acesso com DV recalculado)
- **Transporte**: `placa`, `RNTC`, `vagao`, `balsa`
- **NFC-e**: `qrCode`, `urlChave`, `CSRT`, `hashCSRT`
- **Assinatura digital**: `DigestValue`, `SignatureValue`, `X509Certificate`,
  `Modulus`, `X509IssuerName`, `X509SerialNumber` (o certificado embute nome/CNPJ do emitente)

Características importantes:
- **Mapeamento consistente**: o mesmo valor original sempre vira o mesmo fake,
  então os vínculos entre entidades (emitente/destinatário/transportadora) são preservados.
- **Município e UF são preservados** (`cMun`, `xMun`, `UF`) — não são dados
  pessoais e ajudam a entender o contexto do XML.
- Valores fiscais (produtos, impostos, totais, datas, `nNF`) **não** são alterados.

## Passo manual obrigatório: revisar texto livre

O script NÃO altera campos de texto livre, pois costumam conter informação
legítima que se perderia. Após rodar, **inspecione** estes campos e avise o
usuário se houver dado pessoal residual (nome, CPF/CNPJ, telefone, etc.):

- `infCpl` / `infAdFisco` (informações complementares)
- `obsCont` / `obsFisco` / `xTexto` (observações)
- `xJust` (justificativa de eventos/cancelamento)
- `xProd` (descrição do produto — raro, mas pode citar nomes)

Se encontrar PII nesses campos, proponha ao usuário substituí-los também.

## Cobertura

Cobre o layout padrão da SEFAZ (NF-e 4.00 / NFC-e). Se o XML tiver uma tag
sensível não listada, acrescente a chamada correspondente em
`scripts/anonimizar.py` seguindo o padrão `_replace_tag(xml, "TAG", fn)`.
