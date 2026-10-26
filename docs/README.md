# Documentação WalletHub

Bem-vindo à documentação do WalletHub! Este índice organiza toda a documentação técnica do projeto.

## 📚 Índice

### Documentação Principal

- **[Arquitetura](arquitetura.md)** - Arquitetura geral do sistema, componentes, modelo de dados e fluxos principais
- **[Desenvolvimento](desenvolvimento.md)** - Guia completo para setup, stack local, testes e pipeline
- **[CLI e Workflows](cli-workflows.md)** - Documentação completa da CLI, workflows automatizados e menu interativo
- **[Deploy e Operações](deploy-operacoes.md)** - Deploy, segurança, backups, monitoramento e variáveis de ambiente

### Integrações e Módulos

- **[WhatsApp](whatsapp.md)** - Integração WhatsApp (Baileys, compliance, IA, observabilidade, persistência, PostgreSQL, segredos)
- **[Telegram](telegram.md)** - Integração Telegram Bot API (webhook, filas, emparelhamento, IA partilhada com WhatsApp, compliance)
- **[Notion](notion.md)** - Integração bidirecional WalletHub ↔ Notion para sincronização de dados financeiros

### Outros

- **[Compliance](compliance/README.md)** - Biblioteca de documentos de compliance (lei, normas, terceiros) por módulo
- **[Regras](Regras.md)** - Regras absolutas e melhores práticas do projeto
- **[Roadmap](roadmap.md)** - Evolução planeada (RAG, IA, features futuras)
- **[Backlog](backlog.md)** - Pendências atuais e próximos passos

## 🚀 Início Rápido

### Para Desenvolvedores

1. Leia [Desenvolvimento](desenvolvimento.md) para configurar o ambiente
2. Consulte [CLI e Workflows](cli-workflows.md) para usar os comandos
3. Explore [Arquitetura](arquitetura.md) para entender o sistema (multi-tenant: `X-Organization-Id`, memberships, `GET /users/active` por org)

### Para DevOps/Deploy

1. Comece com [Deploy e Operações](deploy-operacoes.md) (inclui deploy passo a passo Docker + Traefik e checklist pré-deploy)
2. Configure segurança e backups conforme documentado

## 📖 Estrutura da Documentação

A documentação está organizada em seções temáticas para facilitar a navegação:

- **Arquitetura**: Visão técnica do sistema
- **Desenvolvimento**: Como desenvolver e testar
- **CLI e Workflows**: Ferramentas e automação
- **Deploy e Operações**: Produção e manutenção
- **Anexos**: Documentação específica de módulos

Cada seção é independente, mas contém links cruzados quando necessário.

---

**Última atualização**: Documentação unificada em `docs/`; índice único com links para arquitetura, desenvolvimento, CLI, deploy, WhatsApp, Notion, Regras e Backlog.