# Telegram — resumo para compliance (LLM)

**Fontes oficiais (2026-04-26):**

- Terms of Service (plataforma): https://telegram.org/tos  
- Bot Developers: https://telegram.org/tos/bot-developers  
- Privacy (referência cruzada): https://telegram.org/privacy  

## Plataforma (`/tos`)

- Aceitação implícita ao usar o serviço, com referência à Privacy Policy.
- Proibições destacadas: spam ou scam; violência em canais/bots públicos; pornografia ilegal em conteúdo público; actividades ilegais na maioria dos países (incl. abuso infantil, drogas, armas, documentos falsos).
- Telegram reserva-se o direito de actualizar os termos.
- Idade mínima 18 anos (UE, Reino Unido, Austrália) para registo.
- Funcionalidades opcionais podem ter termos adicionais (Stars, Premium, Business, Bots, Mini Apps, API, etc.).
- Política adicional sobre scraping de dados / licenciamento de conteúdo para IA.

## Bot developers (`/tos/bot-developers`)

- Desenvolvedores de bots comprometem-se a seguir as regras da plataforma e guias para bots.
- Bots não devem ser usados para spam, engano ou violação de leis; Telegram pode restringir ou encerrar bots que violem políticas.
- *(Consultar a página completa para listas actualizadas de obrigações, limites de API e boas práticas.)*

## Implicações para o WalletHub

- O produto usa a **Bot API** com webhook; manter conformidade com termos de bot developers e com leis aplicáveis (mensagens financeiras, dados pessoais).
- Documentar retenção em `telegram_events` e fluxo de opt-out / desligação (`telegram_user_id`).
