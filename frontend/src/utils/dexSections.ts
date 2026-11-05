export interface DexSection {
  start: number;
  end: number;
  /** Position of `start` in the list, to know which page to load */
  index: number;
}

const SECTION_SIZE = 50;
const MIN_TOTAL = 100;
// So a 151-entry dex ends at 101–151, not a lone 151–151
const MIN_LAST_SECTION = 10;

/**
 * Dex-number quick-jump buckets of 50 numbers each, labelled by the numbers
 * actually present. `numbers` is the view's dex numbers in ascending order;
 * the national view's are sparse (Sword/Shield's 664 spread over 1–898).
 */
export function dexSections(numbers: number[]): DexSection[] {
  if (numbers.length < MIN_TOTAL) return [];

  const sections: (DexSection & { bucket: number; count: number })[] = [];
  numbers.forEach((number, index) => {
    const bucket = Math.floor((number - 1) / SECTION_SIZE);
    const last = sections[sections.length - 1];
    if (last?.bucket === bucket) {
      last.end = number;
      last.count++;
    } else {
      sections.push({ bucket, start: number, end: number, index, count: 1 });
    }
  });

  const last = sections[sections.length - 1];
  if (sections.length > 1 && last.count < MIN_LAST_SECTION) {
    sections.pop();
    sections[sections.length - 1].end = last.end;
  }
  return sections.map(({ start, end, index }) => ({ start, end, index }));
}
