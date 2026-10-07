import React from 'react';

const paths = {
  save: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M4 16v4h16v-4" /></>,
  play: <path d="m9 5 11 7-11 7Z" />,
  back: <><path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3" /></>,
  capture: <><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="4" /></>,
  match: <><circle cx="12" cy="12" r="9" /><path d="m12 7 5 4-2 6H9l-2-6Zm0-4v4m9 3-4 1m-1 8-1-2m-7 2 1-2m-6-7 4 1" /></>,
  graphics: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 13h6M7 17h4" /></>,
  ads: <><path d="m4 9 13-5v16L4 15Zm13 0h3v6h-3M7 16l2 5" /></>,
  replay: <><path d="M4 9a8 8 0 1 1 0 7M4 3v6h6" /><path d="m11 9 5 3-5 3Z" /></>,
  output: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
};
export default function ControlIcon({ name }) {
  return <svg className="control-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.graphics}</svg>;
}
