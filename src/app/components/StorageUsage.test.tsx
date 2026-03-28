import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StorageUsage } from './StorageUsage';

describe('StorageUsage', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 2_000_000, quota: 50_000_000 }),
      },
    });
  });

  it('renders storage used and quota when estimate is available', async () => {
    render(<StorageUsage />);
    await screen.findByText(/used/, {}, { timeout: 3000 });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/left/)).toBeInTheDocument();
  });
});
