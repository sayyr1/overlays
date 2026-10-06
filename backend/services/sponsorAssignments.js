import Sponsor from '../models/Sponsor.js';
export const sponsorFilter = tournament => ({ $or: [{ tournament }, { 'assignments.tournament': tournament }] });
export function forTournament(sponsor, tournament) {
 const a = sponsor.assignments?.find(a => String(a.tournament) === String(tournament));
 return a ? { ...sponsor, confirmed: a.confirmed, active: sponsor.active !== false && a.active, order: a.order, durationSeconds: a.durationSeconds } : { ...sponsor, confirmed: true };
}
export async function tournamentSponsors(tournament, live = false) {
 return (await Sponsor.find(sponsorFilter(tournament)).lean()).map(s => forTournament(s, tournament)).filter(s => !live || (s.active && s.confirmed)).sort((a,b) => a.order-b.order);
}
