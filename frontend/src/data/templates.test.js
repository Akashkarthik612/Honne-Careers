import { describe, expect, it } from 'vitest';
import { response } from '@/test/contracts';
import { SECTION_LABELS, TEMPLATES, moveSection, sectionOrderOf } from './templates';

const templates = response('templates.json');

describe('templates (PDF-1)', () => {
  it('every live template has UI copy, and every default order uses known sections', () => {
    for (const t of templates) {
      expect(TEMPLATES.map((x) => x.id)).toContain(t.id);
      expect([...t.default_order].sort()).toEqual(Object.keys(SECTION_LABELS).sort());
    }
  });

  it('sectionOrderOf: the resume\'s own order, else its template\'s default (live, then built-in)', () => {
    const own = ['projects', 'experience', 'skills', 'education', 'certifications', 'languages'];
    expect(sectionOrderOf({ template: 'jake', sectionOrder: own }, templates)).toBe(own);
    const pro = templates.find((t) => t.id === 'honne_professional').default_order;
    expect(sectionOrderOf({ template: 'honne_professional', sectionOrder: null }, templates)).toEqual(pro);
    // Before GET /templates answers, the built-in copy must equal the server's defaults.
    for (const t of templates) expect(sectionOrderOf({ template: t.id, sectionOrder: null })).toEqual(t.default_order);
  });

  it('moveSection swaps neighbours and stops at the ends', () => {
    const order = ['a', 'b', 'c'];
    expect(moveSection(order, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveSection(order, 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveSection(order, 0, -1)).toBe(order);
    expect(moveSection(order, 2, 1)).toBe(order);
  });
});
