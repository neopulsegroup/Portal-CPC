"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pdiLogic_1 = require("./pdiLogic");
const pdiTrailRules_1 = require("./pdiTrailRules");
(0, vitest_1.describe)('functions pdiLogic (espelho de src/lib/pdi/generation.ts)', () => {
    (0, vitest_1.it)('3,0 conta como Necessária (obrigatoria)', () => {
        (0, vitest_1.expect)((0, pdiLogic_1.recommendTrail)(3)).toBe('obrigatoria');
        (0, vitest_1.expect)((0, pdiLogic_1.recommendTrail)(3.25)).toBe('recomendada');
        (0, vitest_1.expect)((0, pdiLogic_1.recommendTrail)(3.75)).toBe('opcional');
    });
    (0, vitest_1.it)('gera trilhas pelas regras do PDF a partir do título "T<n> - …"', () => {
        const responses = {};
        for (let id = 1; id <= 21; id += 1)
            responses[id] = 2;
        const trilhas = (0, pdiLogic_1.generateAutoTrilhas)({ score_d1: 2, score_d2: 2, score_d3: 2, score_d4: 2 }, [
            { id: 't5', title: 'T5 - Inserção Profissional' },
            { id: 't8', title: 'T8 - Acesso ao Serviço Nacional de Saúde (SNS)' },
            { id: 't0', title: 'T0 - Apresentação' },
        ], { responses, triage: { ...pdiTrailRules_1.EMPTY_TRIAGE_RULE_INPUT, sns_registered: 'yes' } });
        (0, vitest_1.expect)(trilhas.map((t) => [t.trail_id, t.recommended_state])).toEqual([
            ['t5', 'OBRIGATORIA'],
            ['t8', 'OPCIONAL'],
        ]);
    });
});
