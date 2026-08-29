import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudit } from './useAudit';
import type { AuditResult, AuditStep } from './types';
import type { AuditOptions } from './audit';

vi.mock('./audit', () => {
  return {
    createSteps: vi.fn(),
    runAudit: vi.fn(),
  };
});

import * as auditModule from './audit';

describe('useAudit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auditModule.createSteps).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handles error in runAudit', async () => {
    vi.mocked(auditModule.runAudit).mockRejectedValueOnce(new Error('Test error message'));

    const { result } = renderHook(() => useAudit());

    expect(result.current.phase).toBe('idle');

    await act(async () => {
      await result.current.start('example.com');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Test error message');
  });

  it('handles non-Error objects in catch block', async () => {
    vi.mocked(auditModule.runAudit).mockRejectedValueOnce('String error');

    const { result } = renderHook(() => useAudit());

    await act(async () => {
      await result.current.start('example.com');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Não foi possível concluir a análise.');
  });

  it('updates steps during audit', async () => {
    let onStepCallback: ((step: AuditStep) => void) | undefined;

    vi.mocked(auditModule.runAudit).mockImplementationOnce((_input: string, options?: AuditOptions) => {
      onStepCallback = options?.onStep;
      return new Promise((resolve) => setTimeout(() => resolve({ score: { value: 100 } } as unknown as AuditResult), 50));
    });

    vi.mocked(auditModule.createSteps).mockReturnValueOnce([{ id: 'step1', status: 'pending' } as unknown as AuditStep]);

    const { result } = renderHook(() => useAudit());

    let p: Promise<AuditResult | null>;
    act(() => {
      p = result.current.start('example.com');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.steps).toEqual([{ id: 'step1', status: 'pending' }]);

    act(() => {
      onStepCallback?.({ id: 'step1', status: 'running' } as unknown as AuditStep);
    });

    expect(result.current.steps).toEqual([{ id: 'step1', status: 'running' }]);

    act(() => {
      onStepCallback?.({ id: 'step2', status: 'pending' } as unknown as AuditStep);
    });

    expect(result.current.steps).toEqual([
      { id: 'step1', status: 'running' },
      { id: 'step2', status: 'pending' },
    ]);

    let p2: Promise<AuditResult | null>;
    act(() => {
      p2 = result.current.start('example2.com');
    });

    act(() => {
      onStepCallback?.({ id: 'step3', status: 'pending' } as unknown as AuditStep);
    });

    expect(result.current.steps).toEqual([
      { id: 'step1', status: 'running' },
      { id: 'step2', status: 'pending' },
    ]);

    await act(async () => {
      await p;
      await p2;
    });

    expect(result.current.phase).toBe('done');
  });

  it('reset clears state', async () => {
    vi.mocked(auditModule.runAudit).mockResolvedValueOnce({ score: { value: 100 } } as unknown as AuditResult);

    const { result } = renderHook(() => useAudit());

    await act(async () => {
      await result.current.start('example.com');
    });

    expect(result.current.phase).toBe('done');

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.domain).toBe('');
    expect(result.current.steps).toEqual([]);
    expect(result.current.result).toBeNull();
  });
});
