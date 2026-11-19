import { describe, expect, it } from 'vitest';

import {
  bumpVersion,
  buildEditableTrilhasList,
  computeTargetForDomain,
  computeTargetGlobal,
  generateAutoTrilhas,
  generateApoiosFromTriage,
  mapRecommendationToPdiState,
  setTrailStateInPdiTrilhas,
} from './generation';
import { EMPTY_TRIAGE_RULE_INPUT } from './trailRules';
import {
  allReviewSectionsViewed,
  canAcceptPdi,
  canTransitionPdiStatus,
  validatePdiForSend,
} from './validation';
import type { PdiDoc } from './types';

describe('pdi generation', () => {
  it('mapRecommendationToPdiState', () => {
    expect(mapRecommendationToPdiState('obrigatoria')).toBe('OBRIGATORIA');
    expect(mapRecommendationToPdiState('recomendada')).toBe('RECOMENDADA');
    expect(mapRecommendationToPdiState('opcional')).toBe('OPCIONAL');
  });

  it('computeTargetGlobal aplica 20%', () => {
    expect(computeTargetGlobal(3)).toBe(3.6);
    expect(computeTargetGlobal(4)).toBe(4.8);
  });

  it('computeTargetForDomain mínimo 3,0 quando abaixo', () => {
    expect(computeTargetForDomain(2.5)).toBe(3);
    expect(computeTargetForDomain(3.2)).toBe(3.7);
  });

  it('generateAutoTrilhas por domínio', () => {
    const trilhas = generateAutoTrilhas(
      { score_d1: 2.5, score_d2: 3.2, score_d3: 4, score_d4: null, score_global: 3.1 },
      [
        { id: 't1', scas_domain: 'D1' },
        { id: 't2', scas_domain: 'D2' },
        { id: 't3', scas_domain: 'D3' },
      ]
    );
    expect(trilhas.find((t) => t.trail_id === 't1')?.recommended_state).toBe('OBRIGATORIA');
    expect(trilhas.find((t) => t.trail_id === 't2')?.recommended_state).toBe('RECOMENDADA');
    expect(trilhas.find((t) => t.trail_id === 't3')?.recommended_state).toBe('OPCIONAL');
  });

  it('generateAutoTrilhas aplica as regras do PDF às trilhas T1–T13 (título ou pdi_rule)', () => {
    const responses: Record<number, number> = {};
    for (let id = 1; id <= 21; id += 1) responses[id] = 4;
    Object.assign(responses, { 1: 3, 3: 3, 16: 3, 21: 3 }); // T1 média 3 → Necessária

    const trilhas = generateAutoTrilhas(
      { score_d1: 4, score_d2: 4, score_d3: 4, score_d4: 4, score_global: 4 },
      [
        { id: 'a', title: 'T1 - Relações Sociais' },
        { id: 'b', title: 'T2 - Comunicação' },
        { id: 'c', title: 'Trilha renomeada', pdi_rule: 'T6' },
        { id: 'd', title: 'T10 - Construção do CV' },
        { id: 'e', title: 'T0 - Apresentação' },
        { id: 'f', title: 'Sem regra', scas_domain: 'D2' },
      ],
      { responses, triage: { ...EMPTY_TRIAGE_RULE_INPUT, legal_status: 'not_regularized', work_status: 'employed' } }
    );

    const state = (id: string) => trilhas.find((t) => t.trail_id === id)?.recommended_state;
    expect(state('a')).toBe('OBRIGATORIA');
    expect(state('b')).toBe('OPCIONAL');
    expect(state('c')).toBe('RECOMENDADA');
    expect(state('d')).toBe('OPCIONAL');
    expect(state('e')).toBeUndefined();
    // Trilha sem regra mas com domínio continua a usar o score do domínio.
    expect(state('f')).toBe('OPCIONAL');
    expect(trilhas.every((t) => t.origin === 'AUTO')).toBe(true);
  });

  it('generateAutoTrilhas ignora trilhas T1–T5 quando faltam respostas do grupo', () => {
    const trilhas = generateAutoTrilhas(
      { score_d1: null, score_d2: null, score_d3: null, score_d4: null, score_global: null },
      [{ id: 'a', title: 'T1 - Relações Sociais' }, { id: 'b', title: 'T7 - Habitação' }],
      { responses: {}, triage: null }
    );
    expect(trilhas.map((t) => t.trail_id)).toEqual(['b']);
    expect(trilhas[0].recommended_state).toBe('RECOMENDADA');
  });

  it('generateApoiosFromTriage pré-marca urgências', () => {
    const apoios = generateApoiosFromTriage({
      urgencies: ['housing', 'health', 'psychological', 'employment'],
    });
    expect(apoios.some((a) => a.type === 'NECESSIDADES_BASICAS')).toBe(true);
    expect(apoios.some((a) => a.type === 'PSICOLOGICO')).toBe(true);
    expect(apoios.some((a) => a.type === 'SOCIOPROFISSIONAL')).toBe(true);
  });

  it('bumpVersion incrementa minor', () => {
    expect(bumpVersion('1.0')).toBe('1.1');
    expect(bumpVersion('2.3')).toBe('2.4');
  });

  it('buildEditableTrilhasList inclui catálogo completo', () => {
    const list = buildEditableTrilhasList(
      [
        { id: 't1', title: 'A', scas_domain: 'D1' },
        { id: 't2', title: 'B', scas_domain: 'D2' },
      ],
      [
        {
          trail_id: 't1',
          recommended_state: 'OBRIGATORIA',
          origin: 'AUTO',
          scas_domain: 'D1',
          completion_status: 'NAO_INICIADA',
        },
      ]
    );
    expect(list).toHaveLength(2);
    expect(list[0].recommended_state).toBe('OBRIGATORIA');
    expect(list[1].recommended_state).toBe('NAO_INCLUIDA');
  });

  it('setTrailStateInPdiTrilhas adiciona e remove trilhas', () => {
    const added = setTrailStateInPdiTrilhas([], 't2', 'RECOMENDADA', { id: 't2', scas_domain: 'D3' });
    expect(added).toHaveLength(1);
    expect(added[0].recommended_state).toBe('RECOMENDADA');
    const removed = setTrailStateInPdiTrilhas(added, 't2', 'NAO_INCLUIDA');
    expect(removed).toHaveLength(0);
  });
});

describe('pdi validation', () => {
  const baseDoc: PdiDoc = {
    id: 'p1',
    participant_id: 'u1',
    version: '1.0',
    status: 'IN_REVIEW',
    perfil: 'A',
    source_t0_assessment_id: 'a1',
    score_d1: 3,
    score_d2: 3,
    score_d3: 3,
    score_d4: 3,
    score_global: 3,
    target_global: 3.6,
    target_d1: 3.5,
    target_d2: 3.5,
    target_d3: 3.5,
    target_d4: 3.5,
    created_by_user_id: 'tech1',
    created_at: '2026-01-01',
    is_locked: false,
    trilhas: [
      {
        trail_id: 't1',
        recommended_state: 'OBRIGATORIA',
        origin: 'AUTO',
        scas_domain: 'D1',
        completion_status: 'NAO_INICIADA',
      },
    ],
    apoios: [],
  };

  it('canTransitionPdiStatus', () => {
    expect(canTransitionPdiStatus('DRAFT_GENERATED', 'IN_REVIEW')).toBe(true);
    expect(canTransitionPdiStatus('IN_REVIEW', 'VALIDATED')).toBe(true);
    expect(canTransitionPdiStatus('VALIDATED', 'ACCEPTED')).toBe(true);
    expect(canTransitionPdiStatus('ACCEPTED', 'DRAFT_GENERATED')).toBe(false);
  });

  it('validatePdiForSend exige trilhas incluídas', () => {
    const empty = validatePdiForSend({ ...baseDoc, trilhas: [] });
    expect(empty.ok).toBe(false);
    expect(validatePdiForSend(baseDoc).ok).toBe(true);
  });

  it('canAcceptPdi exige secções percorridas', () => {
    const validated = { ...baseDoc, status: 'VALIDATED' as const };
    expect(canAcceptPdi(validated, ['trilhas'])).toBe(false);
    expect(
      canAcceptPdi(validated, ['trilhas', 'apoios', 'objetivos', 'declaracao'])
    ).toBe(true);
    expect(allReviewSectionsViewed(['trilhas', 'apoios', 'objetivos', 'declaracao'])).toBe(true);
  });
});
