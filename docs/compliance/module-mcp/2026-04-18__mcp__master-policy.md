---
id: MCP-POLICY-001
title: "Política Mestre de Compliance MCP"
obtained_date: 2026-04-18
kind: internal_policy
---

# Política Mestre de Compliance para Model Context Protocol (MCP)

## 1. Contexto e Âmbito
O WalletHub utiliza a arquitetura Model Context Protocol (MCP) para estender as capacidades da IA através de ferramentas externas. Esta política define os requisitos de compliance para qualquer servidor MCP integrado ao sistema.

## 2. Requisito de Documentação Individual
Cada servidor MCP configurado no `MCP_SERVERS_JSON` que não seja estritamente local ou de código aberto (sem processamento de dados por terceiros) deve ter seus próprios Termos de Serviço e Política de Privacidade arquivados na pasta `docs/compliance/module-mcp/`.

## 3. Critérios de Avaliação
Ao adicionar um novo servidor MCP, os seguintes pontos devem ser verificados:
1. **Localização dos Dados**: O servidor MCP processa dados localmente ou envia para uma API externa?
2. **Propriedade Intelectual**: Os termos permitem o uso dos dados processados para treino de modelos do fornecedor?
3. **Segurança**: O servidor implementa autenticação (tokens, headers) conforme o padrão do `McpClientService`.

## 4. Inventário de Servidores
Servidores atualmente ativos e seu status de compliance:
- **[Servidor A]**: [Status]
- **[Servidor B]**: [Status]

---
*Esta política foi estabelecida em 18 de Abril de 2026 para garantir que a expansão via MCP não crie lacunas de responsabilidade sobre dados de utilizadores.*
