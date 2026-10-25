import { describe, expect, it } from 'vitest';
import {
  FIX_CARDS, HERO_STEPS, HERO_TABS, LOOP_STEPS, SAMPLE_JDS, barWidth, cardFrame, countReqs, easeInOut,
  fixColX, gapNote, heroDbRows, loopNodePos, nextHeroStep, previewHandle,
} from './landingData';

describe('easeInOut', () => {
  it('starts at 0, ends at 1 and is symmetric about the middle', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(0.25) + easeInOut(0.75)).toBeCloseTo(1);
  });
});

describe('cardFrame', () => {
  it('is scattered at 0 and sorted into its column and row at 1', () => {
    FIX_CARDS.forEach((c, i) => {
      const a = cardFrame(c, i, 0);
      expect([a.left, a.top, a.rot, a.t]).toEqual([c.c[0], c.c[1], c.c[2], 0]);
      const b = cardFrame(c, i, 1);
      expect(b.t).toBe(1);
      expect(b.left).toBeCloseTo(fixColX(c.o[0]));
      expect(b.top).toBe(c.o[1] === 0 ? 15 : 52);
      expect(b.rot).toBeCloseTo(0);
    });
  });

  it('staggers cards so later ones lag behind', () => {
    const p = 0.3;
    expect(cardFrame(FIX_CARDS[0], 0, p).t).toBeGreaterThan(cardFrame(FIX_CARDS[8], 8, p).t);
  });

  it('clamps progress outside 0..1', () => {
    expect(cardFrame(FIX_CARDS[0], 0, -1).t).toBe(0);
    expect(cardFrame(FIX_CARDS[0], 0, 2).t).toBe(1);
  });
});

describe('hero demo', () => {
  it('loops back to the first step', () => {
    expect(nextHeroStep(HERO_STEPS.length - 1)).toBe(0);
    expect(nextHeroStep(0)).toBe(1);
  });

  it('each tab points at steps of its own scene', () => {
    HERO_TABS.forEach(([, , sc, first, last]) => {
      expect(HERO_STEPS[first].sc).toBe(sc);
      expect(HERO_STEPS[last].sc).toBe(sc);
    });
  });

  it('puts the saved row on top and keeps four rows', () => {
    expect(heroDbRows(false)).toHaveLength(4);
    const rows = heroDbRows(true);
    expect(rows).toHaveLength(4);
    expect(rows[0][1]).toBe('Freshworks');
    expect(rows[0][6]).toBe(true);
  });
});

describe('tailoring sample', () => {
  it('counts requirements by kind', () => {
    const fw = SAMPLE_JDS.fw;
    expect(countReqs(fw, 'm') + countReqs(fw, 'p') + countReqs(fw, 'g')).toBe(fw.reqs.length);
  });

  it('words the gap note for one or several missing skills', () => {
    expect(gapNote(SAMPLE_JDS.fw)).toEqual({ names: 'Kubernetes', rest: 'isn’t in your profile, so it’s not on this CV. Learn it first, then add it yourself.' });
    expect(gapNote(SAMPLE_JDS.sw).names).toBe('Spark and Airflow');
    expect(gapNote(SAMPLE_JDS.sw).rest).toMatch(/^aren’t .* they’re .* them/);
    expect(gapNote({ reqs: [['SQL', 'm', 'x']] })).toBeNull();
  });
});

describe('learning loop', () => {
  it('places step 1 at 12 o’clock and steps clockwise', () => {
    const p0 = loopNodePos(0);
    expect(p0.x).toBeCloseTo(200);
    expect(p0.y).toBeCloseTo(60);
    expect(loopNodePos(1).x).toBeGreaterThan(200);
    expect(LOOP_STEPS).toHaveLength(5);
  });

  it('never draws a bar thinner than 2%', () => {
    expect(barWidth(0, 41)).toBe('2.0%');
    expect(barWidth(6, 24)).toBe('25.0%');
    expect(barWidth(1, 0)).toBe('100.0%');
  });
});

describe('previewHandle', () => {
  it('slugs a typed name into an @handle', () => {
    expect(previewHandle('Interview Prep!')).toBe('@interview-prep');
    expect(previewHandle('@follow-up')).toBe('@follow-up');
    expect(previewHandle('  ')).toBe('@your-agent');
  });
});
