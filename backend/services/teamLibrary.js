export const teamFilter = tournament => ({ $or: [{ tournament }, { tournaments: tournament }] });
export function teamIdentity(body) {
  const name = String(body.name || '').trim();
  const shortName = String(body.shortName || name).trim().slice(0, 24);
  const letters = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const code = String(body.code || (letters.length >= 3 ? letters.map(word => word[0]).join('').slice(0, 3) : letters.join('').slice(0, 3)).padEnd(3, 'X')).trim().toUpperCase();
  return { name, shortName, code };
}
