import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudit } from './useAudit';

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
    (auditModule.createSteps as any).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handles error in runAudit', async () => {
    (auditModule.runAudit as any).mockRejectedValueOnce(new Error('Test error message'));

    const { result } = renderHook(() => useAudit());

    expect(result.current.phase).toBe('idle');

    await act(async () => {
      await result.current.start('example.com');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Test error message');
  });

  it('handles non-Error objects in catch block', async () => {
    (auditModule.runAudit as any).mockRejectedValueOnce('String error');

    const { result } = renderHook(() => useAudit());

    await act(async () => {
      await result.current.start('example.com');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Não foi possível concluir a análise.');
  });

  it('updates steps during audit', async () => {
    let onStepCallback: any;

    (auditModule.runAudit as any).mockImplementationOnce((_input: any, options: any) => {
      onStepCallback = options.onStep;
      return new Promise((resolve) => setTimeout(() => resolve({ score: 100 } as any), 50));
    });

    (auditModule.createSteps as any).mockReturnValueOnce([{ id: 'step1', status: 'pending' }]);

    const { result } = renderHook(() => useAudit());

    let p: any;
    act(() => {
      p = result.current.start('example.com');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.steps).toEqual([{ id: 'step1', status: 'pending' }]);

    act(() => {
      onStepCallback({ id: 'step1', status: 'running' });
    });

    expect(result.current.steps).toEqual([{ id: 'step1', status: 'running' }]);

    act(() => {
      onStepCallback({ id: 'step2', status: 'pending' });
    });

    expect(result.current.steps).toEqual([
      { id: 'step1', status: 'running' },
      { id: 'step2', status: 'pending' },
    ]);

    let p2: any;
    act(() => {
      p2 = result.current.start('example2.com');
    });

    act(() => {
      onStepCallback({ id: 'step3', status: 'pending' });
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
    (auditModule.runAudit as any).mockResolvedValueOnce({ score: 100 } as any);

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
