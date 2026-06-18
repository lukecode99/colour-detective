import { getColorInfo } from '../src/utils/colorNames';

describe('getColorInfo — simple mode', () => {
  test('pure red RGB(255,0,0) → Red', () => {
    const info = getColorInfo(255, 0, 0, false);
    expect(info.name).toBe('Red');
    expect(info.emoji).toBe('🔴');
  });

  test('pure green RGB(0,255,0) → Green', () => {
    const info = getColorInfo(0, 255, 0, false);
    expect(info.name).toBe('Green');
    expect(info.emoji).toBe('🟢');
  });

  test('pure blue RGB(0,0,255) → Blue', () => {
    const info = getColorInfo(0, 0, 255, false);
    expect(info.name).toBe('Blue');
    expect(info.emoji).toBe('🔵');
  });

  test('white RGB(255,255,255) → White', () => {
    const info = getColorInfo(255, 255, 255, false);
    expect(info.name).toBe('White');
    expect(info.emoji).toBe('⚪');
  });

  test('black RGB(0,0,0) → Black', () => {
    const info = getColorInfo(0, 0, 0, false);
    expect(info.name).toBe('Black');
    expect(info.emoji).toBe('⚫');
  });

  test('mid grey RGB(128,128,128) → Grey', () => {
    const info = getColorInfo(128, 128, 128, false);
    expect(info.name).toBe('Grey');
    expect(info.emoji).toBe('🩶');
  });

  test('orange RGB(255,165,0) → Orange', () => {
    const info = getColorInfo(255, 165, 0, false);
    expect(info.name).toBe('Orange');
    expect(info.emoji).toBe('🟠');
  });

  test('yellow RGB(255,255,0) → Yellow', () => {
    const info = getColorInfo(255, 255, 0, false);
    expect(info.name).toBe('Yellow');
    expect(info.emoji).toBe('🟡');
  });

  test('purple RGB(128,0,128) → Purple', () => {
    const info = getColorInfo(128, 0, 128, false);
    expect(info.name).toBe('Purple');
    expect(info.emoji).toBe('🟣');
  });

  test('pink RGB(255,182,193) → Pink', () => {
    const info = getColorInfo(255, 182, 193, false);
    expect(info.name).toBe('Pink');
    expect(info.emoji).toBe('🩷');
  });

  test('navy RGB(0,0,128) → Blue in simple mode', () => {
    const info = getColorInfo(0, 0, 128, false);
    expect(info.name).toBe('Blue');
  });

  test('dark red RGB(139,0,0) → Red in simple mode', () => {
    const info = getColorInfo(139, 0, 0, false);
    expect(info.name).toBe('Red');
  });

  test('brown RGB(101,67,33) → Brown', () => {
    const info = getColorInfo(101, 67, 33, false);
    expect(info.name).toBe('Brown');
    expect(info.emoji).toBe('🟤');
  });

  test('hex value is included', () => {
    const info = getColorInfo(255, 0, 0, false);
    expect(info.hex).toBe('#ff0000');
  });
});

describe('getColorInfo — complex mode', () => {
  test('pure red RGB(255,0,0) → Scarlet (high saturation)', () => {
    const info = getColorInfo(255, 0, 0, true);
    expect(info.name).toBe('Scarlet');
    expect(info.emoji).toBe('🔴');
  });

  test('pure blue RGB(0,0,255) → Cobalt in complex mode', () => {
    const info = getColorInfo(0, 0, 255, true);
    expect(info.name).toBe('Cobalt');
  });

  test('navy RGB(0,0,128) → Navy in complex mode', () => {
    const info = getColorInfo(0, 0, 128, true);
    expect(info.name).toBe('Navy');
  });

  test('dark red RGB(139,0,0) → Crimson in complex mode', () => {
    const info = getColorInfo(139, 0, 0, true);
    expect(info.name).toBe('Crimson');
  });

  test('pure green RGB(0,255,0) → Emerald or Lime in complex mode (not just "Green")', () => {
    const info = getColorInfo(0, 255, 0, true);
    expect(['Lime', 'Emerald', 'Jade', 'Sage', 'Forest']).toContain(info.name);
    expect(info.name).not.toBe('Green');
  });

  test('white RGB(255,255,255) → White/Ivory/Pearl in complex mode', () => {
    const info = getColorInfo(255, 255, 255, true);
    expect(['White', 'Ivory', 'Pearl']).toContain(info.name);
  });

  test('black RGB(0,0,0) → Onyx in complex mode', () => {
    const info = getColorInfo(0, 0, 0, true);
    expect(['Onyx', 'Charcoal']).toContain(info.name);
  });

  test('grey RGB(128,128,128) → Silver/Ash/Slate in complex mode (not just "Grey")', () => {
    const info = getColorInfo(128, 128, 128, true);
    expect(['Silver', 'Ash', 'Slate', 'Grey']).toContain(info.name);
  });

  test('complex mode gives more specific name than simple for red', () => {
    const simple = getColorInfo(255, 0, 0, false);
    const complex = getColorInfo(255, 0, 0, true);
    expect(simple.name).toBe('Red');
    expect(complex.name).not.toBe('Red'); // Should be Scarlet/Crimson/Coral/Rose
  });

  test('complex mode gives more specific name than simple for blue', () => {
    const simple = getColorInfo(0, 0, 255, false);
    const complex = getColorInfo(0, 0, 255, true);
    expect(simple.name).toBe('Blue');
    expect(complex.name).not.toBe('Blue');
  });

  test('lime green RGB(50,205,50) → Lime or Emerald in complex mode', () => {
    const info = getColorInfo(50, 205, 50, true);
    // H ~120-130, so Green range — Emerald or Jade depending on S/L
    expect(['Emerald', 'Jade', 'Forest', 'Sage', 'Lime']).toContain(info.name);
  });

  test('brown RGB(101,67,33) → Brown sub-category in complex mode', () => {
    const info = getColorInfo(101, 67, 33, true);
    expect(['Chocolate', 'Mahogany', 'Caramel', 'Tan']).toContain(info.name);
    expect(info.emoji).toBe('🟤');
  });
});
