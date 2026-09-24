import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('muestra el estado inicial de EduGestor', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'EduGestor V1.0' })).toBeInTheDocument();
  });
});
