---
id: TP-003-deepseek-api
title: "DeepSeek API — documentação técnica (contexto de uso)"
canonical_path: n/a
source_url: "https://api-docs.deepseek.com/"
obtained_date: 2026-04-16
kind: excerpt
---

# Your First API Call | DeepSeek API Docs

Texto útil para auditoria de **como** o projecto integra (`base_url`, modelos). **Não** substitui política de privacidade ou termos legais completos — ver lacuna em [`2026-04-16__deepseek__privacy-policy.md`](2026-04-16__deepseek__privacy-policy.md) (snapshot do site principal; conteúdo legal integral pode exigir captura manual ou outra URL oficial).

The DeepSeek API uses an API format compatible with OpenAI. By modifying the configuration, you can use the OpenAI SDK or softwares compatible with the OpenAI API to access the DeepSeek API.

| PARAM | VALUE |
| --- | --- |
| base_url * | `https://api.deepseek.com` |
| api_key | apply for an API key at https://platform.deepseek.com/api_keys |

* To be compatible with OpenAI, you can also use `https://api.deepseek.com/v1` as the `base_url`. But note that the `v1` here has NO relationship with the model's version.

* The `deepseek-chat` and `deepseek-reasoner` correspond to the model version DeepSeek-V3.2 (128K context limit), which differs from the APP/WEB version. `deepseek-chat` is the non-thinking mode of DeepSeek-V3.2 and `deepseek-reasoner` is the thinking mode of DeepSeek-V3.2.
