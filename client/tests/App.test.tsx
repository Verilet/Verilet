import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../src/App';

describe('App Component', () => {
  it('renders without crashing and displays the headline', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /get started/i })).toBeInTheDocument();
  });
});
