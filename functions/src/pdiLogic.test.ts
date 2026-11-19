import { describe, expect, it } from 'vitest';

import { generateAutoTrilhas, recommendTrail } from './pdiLogic';
import { EMPTY_TRIAGE_RULE_INPUT } from './pdiTrailRules';

describe('functions pdiLogic (espelho de src/lib/pdi/generation.ts)', () => {
  it('3,0 conta como Necessária (obrigatoria)', () => {
    expect(recommendTrail(3)).toBe('obrigatoria');
    expect(recommendTrail(3.25)).toBe('recomendada');
    expect(recommendTrail(3.75)).toBe('opcional');
  });

  it('gera trilhas pelas regras do PDF a partir do título "T<n> - …"', () => {
    const responses: Record<number, number> = {};
    for (let id = 1; id <= 21; id += 1) responses[id] = 2;
    const trilhas = generateAutoTrilhas(
      { score_d1: 2, score_d2: 2, score_d3: 2, score_d4: 2 },
      [
        { id: 't5', title: 'T5 - Inserção Profissional' },
        { id: 't8', title: 'T8 - Acesso ao Serviço Nacional de Saúde (SNS)' },
        { id: 't0', title: 'T0 - Apresentação' },
      ],
      { responses, triage: { ...EMPTY_TRIAGE_RULE_INPUT, sns_registered: 'yes' } }
    );
    expect(trilhas.map((t) => [t.trail_id, t.recommended_state])).toEqual([
      ['t5', 'OBRIGATORIA'],
      ['t8', 'OPCIONAL'],
    ]);
  });
});
