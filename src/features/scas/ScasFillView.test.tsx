import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { getTranslationStringAtPath } from '@/lib/i18n';
import { SCAS_ITEM_IDS } from '@/lib/scas/constants';

import { ScasFillView } from './ScasFillView';
import type { UseScasFillResult } from './useScasFill';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt' }),
}));

function makeFill(overrides: Partial<UseScasFillResult> = {}): UseScasFillResult {
  return {
    loading: false,
    pending: { moment_type: 'T0' } as UseScasFillResult['pending'],
    items: SCAS_ITEM_IDS,
    responses: {},
    formLanguage: 'pt',
    setFormLanguage: vi.fn(),
    answeredCount: 0,
    allAnswered: false,
    savingItem: null,
    submitting: false,
    submitted: false,
    submitError: null,
    handleAnswer: vi.fn(async () => undefined),
    submit: vi.fn(async () => true),
    ...overrides,
  };
}

function renderView(fill: UseScasFillResult) {
  return render(
    <TooltipProvider>
      <ScasFillView fill={fill} onBack={vi.fn()} onSubmitted={vi.fn()} />
    </TooltipProvider>
  );
}

describe('ScasFillView — dicas por pergunta', () => {
  it('todas as 21 perguntas têm dica traduzida em PT/EN/ES/FR', () => {
    for (const lang of ['pt', 'en', 'es', 'fr'] as const) {
      for (const id of SCAS_ITEM_IDS) {
        const hint = getTranslationStringAtPath(lang, `scas.itemHints.${id}`);
        expect(hint, `${lang} scas.itemHints.${id}`).toBeTypeOf('string');
        expect(hint?.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('mostra um botão de ajuda por pergunta e abre a explicação ao tocar', async () => {
    const user = userEvent.setup();
    renderView(makeFill());

    const helpButtons = screen.getAllByRole('button', { name: 'O que significa esta pergunta?' });
    expect(helpButtons).toHaveLength(21);

    await user.click(helpButtons[0]);
    const tooltip = await screen.findByRole('tooltip');
    expect(
      within(tooltip).getByText(
        'Tenho facilidade em fazer novos amigos e manter contacto regular com pessoas portuguesas ou residentes cá?'
      )
    ).toBeInTheDocument();
  });

  it('usa o idioma do formulário na dica', async () => {
    const user = userEvent.setup();
    renderView(makeFill({ formLanguage: 'en' }));

    const helpButtons = screen.getAllByRole('button', { name: 'What does this question mean?' });
    await user.click(helpButtons[9]);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(/hold everyday conversations/)).toBeInTheDocument();
  });
});
