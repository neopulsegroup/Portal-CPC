# Módulo SCAS (Sociocultural Adaptation Scale)

Avaliação de impacto do projeto CPC/EMPIS. Mede a adaptação sociocultural dos
participantes em momentos do percurso e alimenta o Plano de Desenvolvimento
Individual (PDI).

## Stack

React + TypeScript + Firestore + Cloud Functions (não há SQL/migrações). As
"migrações" são: coleções Firestore + regras de segurança + seed + funções.

## Regras de negócio (fixas — EMPIS)

- 21 itens, 4 domínios (D1: 9 itens; D2/D3/D4: 4 cada). Escala 1–5 (emoji).
- Score por domínio = média dos itens do domínio. Score global = média dos 21.
- Recomendação de trilha: ver "Regras de trilhas do PDI" abaixo. Limites (decisão
  de 2026-11-19, doc. do cliente "Adaptação SCAS - Trilhas"): `≤ 3,0` Necessária;
  `> 3,0 e ≤ 3,5` Recomendada; `> 3,5` Facultativa. Antes, o 3,0 contava como Recomendada.
- Melhoria T0→T-PDI: `≥ 20%` → `meta_atingida`; `≥ 15% e < 20%` → `alarme_interno`.
- Momentos: `T0` (após triagem), `T_TRILHA` (por trilha do PDI com domínio
  mapeado), `T_PDI` (todas as trilhas concluídas), `T_ADICIONAL` (reavaliação).
- **Imutabilidade**: após submissão a sessão fica `is_locked`; nunca editável/
  apagável. O score é calculado no servidor (Cloud Function) e há log de auditoria.

Constantes centralizadas em `src/lib/scas/constants.ts` (e espelhadas em
`functions/src/scasScoring.ts`, porque o pacote `functions` compila isolado).

## Regras de trilhas do PDI (doc. "Adaptação SCAS - Trilhas")

Os 4 domínios (D1–D4) continuam a ser usados nas notas guardadas, nas estatísticas,
nas metas do PDI e nas reavaliações `T_TRILHA`. **A proposta de trilhas no PDI** usa
os grupos de perguntas do documento do cliente (`src/lib/pdi/trailRules.ts`, espelhado
em `functions/src/pdiTrailRules.ts`; os dois ficheiros têm de ser idênticos e há um
teste que o garante).

| Trilha | Regra |
|---|---|
| T1 Relações Sociais | média das perguntas 1, 3, 16, 21 |
| T2 Comunicação | média das perguntas 6, 11, 13 |
| T3 Acesso a Serviços Essenciais | média das perguntas 4, 8, 14, 18 |
| T4 Viver em Portugal | média das perguntas 5, 9, 15, 19 |
| T5 Inserção Profissional | média das perguntas 2, 7, 12, 17 |
| T6 Situação Legal | triagem "Não Regularizado" → Recomendada; caso contrário Facultativa |
| T7 Habitação | habitação "Estável (Própria/Alugada)" → Facultativa; caso contrário Recomendada |
| T8 SNS | inscrito no SNS ("Sim") → Facultativa; caso contrário Recomendada |
| T9 Bem-Estar Emocional | bem-estar Muito Mal/Mal/Razoável, ou pergunta 4 ou 14 ≤ 3 → Recomendada; caso contrário Facultativa |
| T10–T13 (CV, Procura de Emprego, LinkedIn, Entrevistas) | situação profissional "Empregado" → Facultativa; caso contrário Recomendada |

- T1–T5: `≤ 3,0` Necessária, `> 3,0 e ≤ 3,5` Recomendada, `> 3,5` Facultativa.
  As perguntas 10 e 20 (língua portuguesa) não entram em nenhuma trilha.
- A regra de cada trilha vem do campo **Regra do PDI** no editor de trilhas
  (`trails.pdi_rule`) ou, se vazio, do prefixo do título (`"T3 - …"`).
- Só entram trilhas **ativas**. Trilhas sem regra mas com `scas_domain` continuam
  a usar o score do domínio.
- Valores internos mantidos: `obrigatoria`/`OBRIGATORIA` = Necessária,
  `opcional`/`OPCIONAL` = Facultativa (só mudaram os textos no ecrã).

## Coleções Firestore

| Coleção | Conteúdo |
|---|---|
| `scas_items/{1..21}` | Catálogo (domínio, ordem, `i18n_key`). Seed. |
| `scas_assessments/{id}` | Sessão (momento, âmbito, modo, idioma, scores, `is_locked`). |
| `scas_responses/{assessmentId_itemId}` | Resposta 1–5 (id composto = único por item). |
| `scas_audit_log/{id}` | Log imutável de submissão (Admin SDK). |
| `pdi/{uid}` | Plano: trilhas atribuídas + estado (obrigatória/recomendada/opcional). |

## Fluxo

1. **Migrante** (`/dashboard/migrante/scas`): responde ao questionário (emoji,
   multilingue PT/EN/ES/FR, guarda progresso parcial). Banner de CTA na home.
2. **Submissão**: callable `submitScasAssessment` valida elegibilidade e
   completude, calcula os scores, bloqueia a sessão e escreve a auditoria.
3. **Equipa CPC** (perfil do participante): vê histórico/scores/variação/flags
   (apenas leitura), preenche em modo assistido, e constrói/valida o PDI a partir
   do T0. Dashboard agregado em `/dashboard/cpc/scas` com exportação CSV (REI).

## Como correr

### Seed dos 21 itens

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
  node scripts/seed-scas-items.mjs
```

### Regras de segurança

```bash
firebase deploy --only firestore:rules
```

### Cloud Function

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions:submitScasAssessment
```

### Testes

```bash
# Frontend (lógica de score, recomendação, metas, disparo de momentos)
npm test -- --run src/lib/scas

# Backend (espelho do cálculo de score)
cd functions && npx vitest run src/scasScoring.test.ts
```

## Ficheiros principais

| Área | Caminho |
|---|---|
| Lógica pura (score/recomendação/metas) | `src/lib/scas/{constants,scoring}.ts` |
| Disparo de momentos | `src/lib/scas/pending.ts` |
| Repositório Firestore + PDI | `src/lib/scas/repository.ts` |
| Hook/vista de preenchimento | `src/features/scas/{useScasFill.ts,ScasFillView.tsx}` |
| UI migrante | `src/pages/dashboard/migrant/ScasPage.tsx` + `src/features/scas/ScasPendingBanner.tsx` |
| UI equipa (perfil) | `src/features/scas/ScasParticipantPanel.tsx` |
| UI equipa (assistido) | `src/pages/dashboard/cpc/ScasAssistedPage.tsx` |
| Dashboard agregado | `src/pages/dashboard/cpc/ScasDashboardPage.tsx` |
| Exportação CSV | `src/features/scas/scasExport.ts` |
| Cloud Function | `functions/src/submitScasAssessment.ts` (+ `scasScoring.ts`) |
| Regras | `firestore.rules` (blocos `scas_*` e `pdi`) |
| Seed | `scripts/seed-scas-items.mjs` |
| i18n | `src/locales/{pt,en,es,fr}.json` → chave `scas` |
