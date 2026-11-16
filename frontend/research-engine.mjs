export const LEXICON = ['진실','화해','조사','피해자','명단','신청','기록','보상','사면','책임','국가','칠레','한국','법원','인권','기억','유족','정의'];
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function countLiteral(text, term) {
  if (!term) return 0;
  const source = String(text).toLocaleLowerCase(), needle = term.toLocaleLowerCase();
  let count = 0, start = 0, i;
  while ((i = source.indexOf(needle, start)) !== -1) { count++; start = i + needle.length; }
  return count;
}
export function splitLecture(blocks) {
  let index = blocks.findIndex(b => /^9\s*[.．]/.test(b.text) && /질의|토론/.test(b.text));
  if (index < 0) index = blocks.findIndex(b => /^h[1-4]$/.test(b.kind) && /질의응답/.test(b.text));
  return { body: index < 0 ? blocks : blocks.slice(0, index), qa: index < 0 ? [] : blocks.slice(index) };
}
export function analyzeText(blocks, term, lexicon = LEXICON) {
  const hits = blocks.map(b => ({...b, occurrences: countLiteral(b.text, term)})).filter(b => b.occurrences);
  const neighbors = lexicon.filter(w => w !== term).map(word => ({word, count: hits.filter(b => countLiteral(b.text, word)).length})).filter(x => x.count).sort((a,b) => b.count - a.count || a.word.localeCompare(b.word));
  return {term, documents: blocks.length, hits, occurrences: hits.reduce((sum,b) => sum + b.occurrences, 0), neighbors};
}
export function temporalCounts(rows) {
  const years = new Map(); let unknown = 0;
  for (const row of rows) {
    if (!Number.isInteger(row.event_year) && !/^\d{4}-\d{2}-\d{2}$/.test(row.event_date ?? '')) { unknown++; continue; }
    const year = Number.isInteger(row.event_year)?row.event_year:Number(row.event_date.slice(0,4));
    years.set(year, (years.get(year) || 0) + 1);
  }
  const entries = [...years].sort((a,b) => a[0]-b[0]).map(([year,count]) => ({year,count}));
  return {entries, unknown, total: rows.length, dated: rows.length - unknown};
}
export function paragraphExcerpt(text, term, maxLength = 190) {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  const start = Math.max(0,i - 45);
  return (start ? '…' : '') + text.slice(start,start+maxLength) + (start+maxLength<text.length ? '…' : '');
}
