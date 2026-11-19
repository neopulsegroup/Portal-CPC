/**
 * PDI — regras de recomendação de trilhas (documento do cliente "Adaptação SCAS - Trilhas").
 *
 * FICHEIRO ESPELHADO: `src/lib/pdi/trailRules.ts` ⇄ `functions/src/pdiTrailRules.ts`.
 * Os dois têm de ser idênticos (o teste `trailRules.test.ts` falha se divergirem).
 * Não tem imports de propósito, para compilar igual no frontend e nas Cloud Functions.
 *
 * Resumo das regras:
 * - T1–T5: média das perguntas SCAS do grupo no T0.
 *   ≤ 3,0 → Necessária; > 3,0 e ≤ 3,5 → Recomendada; > 3,5 → Facultativa.
 *   As perguntas 10 e 20 (língua portuguesa) não entram em nenhuma trilha.
 * - T6–T13: respostas da triagem (e, na T9, também as perguntas SCAS 4 e 14).
 *
 * Valores internos: 'obrigatoria' = Necessária, 'opcional' = Facultativa.
 */

export type PdiTrailRecommendation = 'obrigatoria' | 'recomendada' | 'opcional';

export type PdiScasTrailRuleKey = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export type PdiTrailRuleKey =
  | PdiScasTrailRuleKey
  | 'T6'
  | 'T7'
  | 'T8'
  | 'T9'
  | 'T10'
  | 'T11'
  | 'T12'
  | 'T13';

export const PDI_TRAIL_RULE_KEYS: PdiTrailRuleKey[] = [
  'T1',
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
  'T7',
  'T8',
  'T9',
  'T10',
  'T11',
  'T12',
  'T13',
];

/** Perguntas SCAS cuja média decide cada trilha T1–T5. */
export const PDI_SCAS_TRAIL_ITEMS: Record<PdiScasTrailRuleKey, number[]> = {
  T1: [1, 3, 16, 21],
  T2: [6, 11, 13],
  T3: [4, 8, 14, 18],
  T4: [5, 9, 15, 19],
  T5: [2, 7, 12, 17],
};

/** Média ≤ a este valor → Necessária (inclusive). */
export const PDI_SCAS_NECESSARY_MAX = 3.0;

/** Média ≤ a este valor (e acima de PDI_SCAS_NECESSARY_MAX) → Recomendada; acima → Facultativa. */
export const PDI_SCAS_RECOMMENDED_MAX = 3.5;

/** T9: pontuação de bem-estar emocional na triagem (1 Muito Mal … 5 Muito Bem) que recomenda a trilha. */
export const PDI_EMOTIONAL_WELLBEING_RECOMMENDED_MAX = 3;

/** T9: perguntas SCAS que, com resposta ≤ 3, recomendam a trilha. */
export const PDI_T9_SCAS_ITEMS = [4, 14];

export type PdiScasResponseMap = Record<number, number>;

export interface PdiTriageRuleInput {
  legal_status: string | null;
  housing_status: string | null;
  sns_registered: string | null;
  emotional_wellbeing: number | null;
  work_status: string | null;
}

export const EMPTY_TRIAGE_RULE_INPUT: PdiTriageRuleInput = {
  legal_status: null,
  housing_status: null,
  sns_registered: null,
  emotional_wellbeing: null,
  work_status: null,
};

function isScasValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Recomendação a partir da média de um grupo de perguntas SCAS. */
export function recommendFromScasAverage(average: number): PdiTrailRecommendation {
  if (average <= PDI_SCAS_NECESSARY_MAX) return 'obrigatoria';
  if (average <= PDI_SCAS_RECOMMENDED_MAX) return 'recomendada';
  return 'opcional';
}

/** Média (2 casas) das perguntas indicadas; `null` se faltar alguma resposta válida. */
export function scasItemsAverage(responses: PdiScasResponseMap, items: number[]): number | null {
  if (items.length === 0) return null;
  let sum = 0;
  for (const itemId of items) {
    const value = responses[itemId];
    if (!isScasValue(value)) return null;
    sum += value;
  }
  return roundTwo(sum / items.length);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readWellbeing(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/**
 * Extrai da triagem os campos usados pelas regras T6–T13.
 * Lê primeiro os campos de topo (`legal_status`, `housing_status`, `work_status`) e,
 * se faltarem, as respostas cruas em `answers`.
 */
export function extractTriageRuleInput(triage: unknown): PdiTriageRuleInput {
  if (!triage || typeof triage !== 'object') return { ...EMPTY_TRIAGE_RULE_INPUT };
  const doc = triage as Record<string, unknown>;
  const answers =
    doc.answers && typeof doc.answers === 'object' ? (doc.answers as Record<string, unknown>) : {};
  return {
    legal_status: readString(doc.legal_status) ?? readString(answers.legal_status),
    housing_status: readString(doc.housing_status) ?? readString(answers.housing_status),
    sns_registered: readString(doc.sns_registered) ?? readString(answers.sns_registered),
    emotional_wellbeing: readWellbeing(doc.emotional_wellbeing) ?? readWellbeing(answers.emotional_wellbeing),
    work_status: readString(doc.work_status) ?? readString(answers.work_status),
  };
}

function isRuleKey(value: unknown): value is PdiTrailRuleKey {
  return typeof value === 'string' && (PDI_TRAIL_RULE_KEYS as string[]).includes(value);
}

/**
 * Regra do PDI associada à trilha: campo `pdi_rule` (definido no editor de trilhas) ou,
 * se vazio, o prefixo do título no formato "T<n> - …" (ex.: "T3 - Acesso a Serviços Essenciais").
 */
export function resolveTrailRuleKey(trail: { pdi_rule?: unknown; title?: unknown }): PdiTrailRuleKey | null {
  if (isRuleKey(trail.pdi_rule)) return trail.pdi_rule;
  if (typeof trail.title !== 'string') return null;
  const match = trail.title.match(/^\s*T(\d{1,2})\s*[-–—:]/i);
  if (!match) return null;
  const key = `T${Number(match[1])}`;
  return isRuleKey(key) ? key : null;
}

/**
 * Recomendação para uma trilha segundo a regra do PDF.
 * Devolve `null` quando a regra depende de respostas SCAS que estão em falta (T1–T5).
 */
export function recommendTrailByRule(
  rule: PdiTrailRuleKey,
  responses: PdiScasResponseMap,
  triage: PdiTriageRuleInput
): PdiTrailRecommendation | null {
  switch (rule) {
    case 'T1':
    case 'T2':
    case 'T3':
    case 'T4':
    case 'T5': {
      const average = scasItemsAverage(responses, PDI_SCAS_TRAIL_ITEMS[rule]);
      return average == null ? null : recommendFromScasAverage(average);
    }
    case 'T6':
      // Só "Não Regularizado" recomenda; restantes casos (incl. sem resposta) → Facultativa.
      return triage.legal_status === 'not_regularized' ? 'recomendada' : 'opcional';
    case 'T7':
      // Habitação estável (própria/alugada) → Facultativa; caso contrário → Recomendada.
      return triage.housing_status === 'stable' ? 'opcional' : 'recomendada';
    case 'T8':
      // Inscrito no SNS → Facultativa; caso contrário → Recomendada.
      return triage.sns_registered === 'yes' ? 'opcional' : 'recomendada';
    case 'T9': {
      const wellbeing = triage.emotional_wellbeing;
      if (wellbeing != null && wellbeing <= PDI_EMOTIONAL_WELLBEING_RECOMMENDED_MAX) return 'recomendada';
      const lowScas = PDI_T9_SCAS_ITEMS.some((itemId) => {
        const value = responses[itemId];
        return isScasValue(value) && value <= PDI_SCAS_NECESSARY_MAX;
      });
      return lowScas ? 'recomendada' : 'opcional';
    }
    case 'T10':
    case 'T11':
    case 'T12':
    case 'T13':
      // Empregado → Facultativa; caso contrário → Recomendada.
      return triage.work_status === 'employed' ? 'opcional' : 'recomendada';
    default:
      return null;
  }
}
