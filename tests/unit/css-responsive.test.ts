import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/App.module.css'), 'utf8');

describe('App.module.css - responsive navigation', () => {
  it('defines the appNavigation class used by App.tsx', () => {
    expect(css).toMatch(/\.appNavigation\s*\{/);
  });

  it('has no orphan .appNav rules', () => {
    expect(css).not.toMatch(/\.appNav\s*\{/);
  });

  it('the mobile media query targets .appNavigation', () => {
    const start = css.indexOf('@media (max-width: 719px)', css.indexOf('HU-MON-007'));
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start)).toMatch(/\.appNavigation\s*\{/);
  });
});