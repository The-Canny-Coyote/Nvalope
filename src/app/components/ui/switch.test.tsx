import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './switch';

describe('Switch', () => {
  it('renders with role switch and unchecked by default when checked={false}', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);
    const root = screen.getByRole('switch');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('aria-checked', 'false');
    expect(root).toHaveClass('h-5', 'w-14', 'shrink-0');
  });

  it('renders checked when checked={true}', () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);
    const root = screen.getByRole('switch');
    expect(root).toHaveAttribute('aria-checked', 'true');
    expect(root).toHaveAttribute('data-state', 'checked');
    expect(root).toHaveClass('switch-track');
  });

  it('has track with fixed dimensions and no layout shift', () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} />);
    const root = screen.getByRole('switch');
    expect(root).toHaveClass('h-5', 'w-14', 'shrink-0');
    const thumb = root.querySelector('[data-slot="switch-thumb"]');
    expect(thumb).toHaveClass('h-5', 'w-5');
    rerender(<Switch checked={true} onCheckedChange={() => {}} />);
    expect(root).toHaveClass('h-5', 'w-14', 'shrink-0');
    expect(thumb).toHaveClass('h-5', 'w-5');
  });

  it('thumb has correct transform classes for unchecked (left) and checked (right)', () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} />);
    const root = screen.getByRole('switch');
    const thumb = root.querySelector('[data-slot="switch-thumb"]');
    expect(thumb).toBeInTheDocument();
    expect(root).toHaveAttribute('data-state', 'unchecked');
    expect(thumb!.className).toContain('translate-x-0.5');
    expect(thumb!.className).toContain('translate-x-[2.125rem]');
    rerender(<Switch checked={true} onCheckedChange={() => {}} />);
    expect(root).toHaveAttribute('data-state', 'checked');
    expect(thumb!.className).toContain('translate-x-[2.125rem]');
  });

  it('calls onCheckedChange when clicked', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
