import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BudgetProvider } from './BudgetContext';

const getBudgetMock = vi.fn();

vi.mock('@/app/services/budgetIdb', () => ({
  getBudget: (...args: unknown[]) => getBudgetMock(...args),
  setBudget: vi.fn(() => Promise.resolve()),
}));

describe('BudgetProvider load failure', () => {
  beforeEach(() => {
    getBudgetMock.mockReset();
    getBudgetMock.mockRejectedValue(new Error('read failed'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls onLoadError after retries are exhausted', async () => {
    const onLoadError = vi.fn();
    render(<BudgetProvider onLoadError={onLoadError} />);

    expect(screen.getByRole('status', { name: /loading budget/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(onLoadError).toHaveBeenCalledWith('Failed to load budget. Try again or restore from backup.');
    });

    expect(getBudgetMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load budget. Try again or restore from backup.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
