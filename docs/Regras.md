## 🚨 Regras Absolutas

Estas regras **NÃO PODEM** ser violadas sob nenhuma circunstância.

### 1. DRY — Don't Repeat Yourself
- Deve existir **uma única fonte de verdade**
- É proibida duplicação de lógica, regras de negócio ou configurações
- Constantes e configurações devem ser centralizadas

### 2. KISS — Keep It Simple
- Priorizar soluções **simples, diretas e legíveis**
- Evitar abstrações, camadas ou padrões sem necessidade real
- Over-engineering é considerado erro

### 3. SOLID
Aplicar SOLID com foco em **manutenibilidade**, não complexidade.

- **SRP**: uma responsabilidade por módulo/classe
- **OCP**: extensão sem modificar código existente sempre que possível
- **LSP**: substituições não exigem lógica defensiva
- **ISP**: evitar interfaces grandes ou genéricas
- **DIP**: depender de abstrações, não de implementações concretas

### 4. Validação de Build
- Sempre validar a build ao final das alterações
- A build **não pode** conter erros ou warnings críticos
- Validar em **Debug** e **Release**

### 5. Dados em Produção
- É proibido usar dados fictícios, mocks ou sintéticos em produção
- Dados de teste são permitidos **apenas** em ambientes de desenvolvimento ou teste

### 6. Testes
- Testes **não podem** estar embutidos no código de produção
- Testes não devem impactar fluxo, performance ou UX
- Testes devem residir em projetos/módulos separados

### 7. CHANGELOG
- O CHANGELOG **deve ser atualizado a cada alteração**
- Ficheiro: [`CHANGELOG.md`](../CHANGELOG.md) na raiz do repositório
- Incluir:
  - status da build
  - resultados dos testes
  - cobertura (quando aplicável)

### 8. Qualidade de UI e Frontend
- **Mobile-first:** A UI deve ser **sempre** pensada e implementada em abordagem **mobile-first**: partir do **ecrã pequeno** (toque, espaçamento, legibilidade) e **progressivamente** melhorar para ecrãs maiores. É proibido tratar o mobile como um adendo ao layout desktop.
- **Camadas e recorte:** É proibido que menus suspensos, popovers, modais, toasts ou outros overlays fiquem **invisíveis, recortados ou inacessíveis** por **stacking context** (`z-index` / ordem de pintura) ou por **clipping** de antepassados (`overflow` diferente de `visible`). Quando a biblioteca o suportar, usar **portais** para renderizar overlays fora de contentores que recortam.
- **Revisão obrigatória:** Após alterações de UI, é obrigatório **rever manualmente** os fluxos afetados (abrir/fechar overlays, formulários, navegação) e confirmar **legibilidade**, alinhamento e ausência de sobreposições erradas.
- **Responsividade e validação:** Interfaces com elementos flutuantes ou fixos devem ser verificadas em **pelo menos** um viewport estreito (representativo de telemóvel) e um largo (desktop ou tablet em landscape), para evitar obstruções e quebras de layout — em coerência com mobile-first.

### 9. Compliance
- O cumprimento das exigências legais, normativas e de **terceiros** documentadas para o projecto é **obrigatório**; a biblioteca em [`docs/compliance/`](../compliance/README.md) é a referência operacional (índice em [`docs/compliance/00-meta/INDEX.md`](../compliance/00-meta/INDEX.md), pastas por módulo).
- Alterações de código, integrações ou tratamento de dados que afectem compliance **devem** estar alinhadas com a pasta `docs/compliance/` aplicável e, quando se introduzam novos requisitos ou fontes, **devem** actualizar o índice e o `README` do módulo correspondente (ou `01-brasil-lei-e-normas/` quando for transversal).
- Não implementar nem manter funcionalidades que violem conscientemente os requisitos arquivados ou, na ausência de documento arquivado, sem antes registar a lacuna no índice ou no `README` relevante e tratar o risco.

---

### Referências (melhores práticas)

Seguir as melhores práticas e documentação oficial das tecnologias do projeto.

- **Compliance:** [`docs/compliance/`](../compliance/README.md) (regra §9)
- **Backend:** [NestJS](https://docs.nestjs.com/), [TypeORM](https://typeorm.io/), [BullMQ](https://docs.bullmq.io/), [Joi](https://joi.dev/)
- **Frontend:** [React](https://react.dev/), [Vite](https://vitejs.dev/), [TanStack Query](https://tanstack.com/query/latest), [Vitest](https://vitest.dev/)
- **Infra:** [Docker](https://docs.docker.com/), [PostgreSQL](https://www.postgresql.org/docs/), [Redis](https://redis.io/docs/)
