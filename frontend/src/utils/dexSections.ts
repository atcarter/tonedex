export interface DexSection {
  start: number;
  end: number;
}

const SECTION_SIZE = 50;
// Dexes smaller than this scroll comfortably without quick-jump sections
const MIN_TOTAL = 100;
// A trailing bucket smaller than this folds into the one before it, so a
// 151-entry dex ends at 101–151 rather than a lone 151–151
const MIN_LAST_SECTION = 10;

/** Dex-number quick-jump buckets for a dex of `total` entries. */
export function dexSections(total: number): DexSection[] {
  if (total < MIN_TOTAL) return [];

  const sections: DexSection[] = [];
  for (let start = 1; start <= total; start += SECTION_SIZE) {
    sections.push({ start, end: Math.min(start + SECTION_SIZE - 1, total) });
  }

  const last = sections[sections.length - 1];
  if (sections.length > 1 && last.end - last.start + 1 < MIN_LAST_SECTION) {
    sections.pop();
    sections[sections.length - 1].end = total;
  }
  return sections;
}
