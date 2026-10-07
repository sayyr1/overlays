import React from 'react';
export function teamCrest(team) {
  if (team?.crest?.secureUrl) return team.crest.secureUrl;
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
  const color = /^#[a-f\d]{6}$/i.test(team?.primaryColor || '') ? team.primaryColor : '#123B6D';
  const secondary = /^#[a-f\d]{6}$/i.test(team?.secondaryColor || '') ? team.secondaryColor : '#FFFFFF';
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140"><path fill="${color}" stroke="${secondary}" stroke-width="4" d="M8 8h104v72q0 32-52 52Q8 112 8 80Z"/><path fill="${secondary}" opacity=".12" d="M44 10h32v108H44z"/><text x="60" y="78" text-anchor="middle" fill="${secondary}" font-family="Arial" font-size="26" font-weight="bold">${escape(team?.code || 'FC')}</text></svg>`);
}
export default function TeamBadge({ team }) {
  return <div className="brand-avatar team-avatar"><img src={teamCrest(team)} alt={`Escudo de ${team.name}`} /></div>;
}
