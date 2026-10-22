function validCas(value) {
  if (typeof value !== 'string' || !/^\d{2,7}-\d{2}-\d$/.test(value)) return false;
  const digits = value.replaceAll('-', '');
  return [...digits.slice(0, -1)].reverse().reduce((sum, d, i) => sum + Number(d) * (i + 1), 0) % 10 === Number(digits.at(-1));
}
export function casQuery(search) {
  const value = new URLSearchParams(search).get('cas');
  return validCas(value) ? value : '';
}
export function casHref(value, base = '/') {
  return validCas(value) ? `${base.replace(/\/$/, '')}/aroma-threshold/?cas=${encodeURIComponent(value)}` : null;
}
