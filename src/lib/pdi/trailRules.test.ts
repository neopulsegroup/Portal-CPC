import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EMPTY_TRIAGE_RULE_INPUT,
  extractTriageRuleInput,
  PDI_SCAS_TRAIL_ITEMS,
  recommendFromScasAverage,
  recommendTrailByRule,
  resolveTrailRuleKey,
  scasItemsAverage,
  type PdiScasResponseMap,
  type PdiTriageRuleInput,
} from './trailRules';

function uniform(value: number): PdiScasResponseMap {
  const map: PdiScasResponseMap = {};
  for (let id = 1; id <= 21; id += 1) map[id] = value;
  return map;
}

function triage(overrides: Partial<PdiTriageRuleInput> = {}): PdiTriageRuleInput {
  return { ...EMPTY_TRIAGE_RULE_INPUT, ...overrides };
}

describe('trailRules — espelho frontend ⇄ Cloud Functions', () => {
  it('src/lib/pdi/trailRules.ts e functions/src/pdiTrailRules.ts são idênticos', () => {
    const front = readFileSync(resolve(__dirname, 'trailRules.ts'), 'utf-8');
    const server = readFileSync(resolve(__dirname, '../../../functions/src/pdiTrailRules.ts'), 'utf-8');
    expect(server).toBe(front);
  });
});

describe('trailRules — grupos SCAS (T1–T5) do documento do cliente', () => {
  it('usa os grupos de perguntas do PDF e deixa de fora as perguntas 10 e 20', () => {
    expect(PDI_SCAS_TRAIL_ITEMS).toEqual({
      T1: [1, 3, 16, 21],
      T2: [6, 11, 13],
      T3: [4, 8, 14, 18],
      T4: [5, 9, 15, 19],
      T5: [2, 7, 12, 17],
    });
    const used = Object.values(PDI_SCAS_TRAIL_ITEMS).flat();
    expect(used).not.toContain(10);
    expect(used).not.toContain(20);
    expect(new Set(used).size).toBe(19);
  });

  it('≤ 3 → Necessária; > 3 e ≤ 3,5 → Recomendada; > 3,5 → Facultativa', () => {
    expect(recommendFromScasAverage(1)).toBe('obrigatoria');
    expect(recommendFromScasAverage(3)).toBe('obrigatoria');
    expect(recommendFromScasAverage(3.01)).toBe('recomendada');
    expect(recommendFromScasAverage(3.5)).toBe('recomendada');
    expect(recommendFromScasAverage(3.51)).toBe('opcional');
    expect(recommendFromScasAverage(5)).toBe('opcional');
  });

  it('média exatamente 3 num grupo de 4 perguntas → Necessária', () => {
    const responses = uniform(5);
    Object.assign(responses, { 1: 3, 3: 3, 16: 3, 21: 3 });
    expect(scasItemsAverage(responses, PDI_SCAS_TRAIL_ITEMS.T1)).toBe(3);
    expect(recommendTrailByRule('T1', responses, triage())).toBe('obrigatoria');
  });

  it('T2 com média 3,33 (3, 3, 4) → Recomendada', () => {
    const responses = uniform(5);
    Object.assign(responses, { 6: 3, 11: 3, 13: 4 });
    expect(recommendTrailByRule('T2', responses, triage())).toBe('recomendada');
  });

  it('só as perguntas do grupo contam (T5 não é afetada pela pergunta 10)', () => {
    const responses = uniform(4);
    responses[10] = 1;
    expect(recommendTrailByRule('T5', responses, triage())).toBe('opcional');
  });

  it('devolve null quando falta uma resposta do grupo', () => {
    const responses = uniform(2);
    delete responses[18];
    expect(recommendTrailByRule('T3', responses, triage())).toBeNull();
    expect(recommendTrailByRule('T4', responses, triage())).toBe('obrigatoria');
  });
});

describe('trailRules — regras da triagem (T6–T13)', () => {
  const highScas = uniform(5);

  it('T6 Situação Legal: só "Não Regularizado" recomenda', () => {
    expect(recommendTrailByRule('T6', highScas, triage({ legal_status: 'not_regularized' }))).toBe('recomendada');
    expect(recommendTrailByRule('T6', highScas, triage({ legal_status: 'regularized' }))).toBe('opcional');
    expect(recommendTrailByRule('T6', highScas, triage({ legal_status: 'pending' }))).toBe('opcional');
    expect(recommendTrailByRule('T6', highScas, triage())).toBe('opcional');
  });

  it('T7 Habitação: estável → Facultativa; caso contrário (incl. sem resposta) → Recomendada', () => {
    expect(recommendTrailByRule('T7', highScas, triage({ housing_status: 'stable' }))).toBe('opcional');
    expect(recommendTrailByRule('T7', highScas, triage({ housing_status: 'temporary' }))).toBe('recomendada');
    expect(recommendTrailByRule('T7', highScas, triage())).toBe('recomendada');
  });

  it('T8 SNS: inscrito → Facultativa; caso contrário → Recomendada', () => {
    expect(recommendTrailByRule('T8', highScas, triage({ sns_registered: 'yes' }))).toBe('opcional');
    expect(recommendTrailByRule('T8', highScas, triage({ sns_registered: 'no' }))).toBe('recomendada');
    expect(recommendTrailByRule('T8', highScas, triage({ sns_registered: 'dont_know_how' }))).toBe('recomendada');
  });

  it('T9 Bem-Estar: Muito Mal/Mal/Razoável ou pergunta 4/14 ≤ 3 → Recomendada', () => {
    expect(recommendTrailByRule('T9', highScas, triage({ emotional_wellbeing: 3 }))).toBe('recomendada');
    expect(recommendTrailByRule('T9', highScas, triage({ emotional_wellbeing: 1 }))).toBe('recomendada');
    expect(recommendTrailByRule('T9', highScas, triage({ emotional_wellbeing: 4 }))).toBe('opcional');
    expect(recommendTrailByRule('T9', { ...highScas, 4: 3 }, triage({ emotional_wellbeing: 5 }))).toBe('recomendada');
    expect(recommendTrailByRule('T9', { ...highScas, 14: 2 }, triage({ emotional_wellbeing: 5 }))).toBe('recomendada');
    expect(recommendTrailByRule('T9', highScas, triage())).toBe('opcional');
  });

  it('T10–T13 Emprego: Empregado → Facultativa; caso contrário → Recomendada', () => {
    for (const rule of ['T10', 'T11', 'T12', 'T13'] as const) {
      expect(recommendTrailByRule(rule, highScas, triage({ work_status: 'employed' }))).toBe('opcional');
      expect(recommendTrailByRule(rule, highScas, triage({ work_status: 'unemployed_seeking' }))).toBe('recomendada');
      expect(recommendTrailByRule(rule, highScas, triage())).toBe('recomendada');
    }
  });
});

describe('trailRules — leitura da triagem e da trilha', () => {
  it('extrai campos de topo e, se faltarem, das respostas cruas', () => {
    expect(
      extractTriageRuleInput({
        legal_status: 'not_regularized',
        work_status: 'employed',
        answers: { housing_status: 'stable', sns_registered: 'yes', emotional_wellbeing: '2', legal_status: 'regularized' },
      })
    ).toEqual({
      legal_status: 'not_regularized',
      housing_status: 'stable',
      sns_registered: 'yes',
      emotional_wellbeing: 2,
      work_status: 'employed',
    });
    expect(extractTriageRuleInput(null)).toEqual(EMPTY_TRIAGE_RULE_INPUT);
  });

  it('usa pdi_rule e, se vazio, o prefixo "T<n> - " do título', () => {
    expect(resolveTrailRuleKey({ pdi_rule: 'T7', title: 'T3 - Acesso a Serviços Essenciais' })).toBe('T7');
    expect(resolveTrailRuleKey({ title: 'T3 - Acesso a Serviços Essenciais' })).toBe('T3');
    expect(resolveTrailRuleKey({ title: 'T13 - Preparação de Entrevistas' })).toBe('T13');
    expect(resolveTrailRuleKey({ title: 'T0 - Apresentação' })).toBeNull();
    expect(resolveTrailRuleKey({ title: 'T14 - Outra' })).toBeNull();
    expect(resolveTrailRuleKey({ title: 'Conheça Portugal' })).toBeNull();
    expect(resolveTrailRuleKey({ pdi_rule: 'X1', title: null })).toBeNull();
  });
});
