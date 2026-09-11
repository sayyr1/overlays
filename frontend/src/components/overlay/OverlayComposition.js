import React, { useEffect, useState } from "react";
import "./broadcast.css";

const seconds = (clock, now) =>
  (clock?.elapsedSeconds || 0) +
  (clock?.running && clock?.startedAt
    ? Math.max(
        0,
        Math.floor((now - new Date(clock.startedAt).getTime()) / 1000),
      )
    : 0);
const clockText = (clock, now) => {
  const value = seconds(clock, now);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
};

export default function OverlayComposition({ snapshot, preview = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const match = snapshot?.match;
  const general = snapshot?.mode && snapshot.mode !== 'sports';
  const live = graphic => graphic?.expiresAt && new Date(graphic.expiresAt).getTime() <= now ? null : graphic;
  const graphics = { ...snapshot?.graphics, main: live(snapshot?.graphics?.main), temporary: live(snapshot?.graphics?.temporary), lowerThird: live(snapshot?.graphics?.lowerThird) };
  const colors = snapshot?.tournament?.colors || {};
  if (!match && !general)
    return (
      <div className={`tv-overlay-root ${preview ? "tv-overlay-preview" : ""}`}>
        {preview && <div className="tv-overlay-empty">Esperando partido activo</div>}
      </div>
    );
  return (
    <div
      className={`tv-overlay-root ${preview ? "tv-overlay-preview" : ""} ${graphics.sponsorBugVisible && snapshot?.sponsors?.length ? "tv-with-sponsor" : ""}`}
      style={{
        "--primary": colors.primary,
        "--secondary": colors.secondary,
        "--accent": colors.accent,
        "--text": colors.text,
        "--background": colors.background,
      }}
    >
      {!general && graphics.scoreboardVisible && (
        <div className="tv-scorebug">
          {snapshot.tournament?.logo?.secureUrl && (
            <img
              className="tv-scorebug-brand"
              src={snapshot.tournament.logo.secureUrl}
              alt=""
            />
          )}
          <div className="tv-team-side">
            {match.homeTeam?.crest?.secureUrl && (
              <img src={match.homeTeam.crest.secureUrl} alt="" />
            )}
            <b>{match.homeTeam?.code || match.homeTeam?.shortName || "LOC"}</b>
          </div>
          <strong>
            <span>{match.score.home}</span><i>:</i><span>{match.score.away}</span>
          </strong>
          <div className="tv-team-side tv-right">
            <b>{match.awayTeam?.code || match.awayTeam?.shortName || "VIS"}</b>
            {match.awayTeam?.crest?.secureUrl && (
              <img src={match.awayTeam.crest.secureUrl} alt="" />
            )}
          </div>
          {graphics.clockVisible && (
            <span className="tv-clock">
              <b>{clockText(match.clock, now)}</b>
              <small>{({ "Primer tiempo": "1T", "Segundo tiempo": "2T", "Descanso": "MT", "Penales": "PEN" })[match.clock.period] || match.clock.period}</small>
              {match.clock.addedTime > 0 && <em>+{match.clock.addedTime}</em>}
            </span>
          )}
        </div>
      )}
      {!general && graphics.clockVisible && !graphics.scoreboardVisible && (
        <div className="tv-standalone-clock">
          {clockText(match.clock, now)} · {match.clock.period}
        </div>
      )}
      {graphics.channelBugVisible && (
        <div className="tv-channel-bug">
          IMBABURA
          <br />
          <b>EN VIVO</b>
        </div>
      )}
      {graphics.sponsorBugVisible && (
        <SponsorRibbon sponsors={snapshot?.sponsors || []} now={now} />
      )}
      {general && ['main', 'temporary', 'lowerThird'].map(layer => graphics[layer] && <BroadcastGraphic key={graphics[layer].id} graphic={graphics[layer]} now={now} tournament={snapshot.tournament} />)}
      {!general && graphics.main && (
        <RenderGraphic
          key={graphics.main.id}
          graphic={graphics.main}
          match={match}
          tournament={snapshot.tournament}
          kind="main"
        />
      )}
      {!general && graphics.temporary && (
        <Graphic
          key={graphics.temporary.id}
          graphic={graphics.temporary}
          match={match}
          tournament={snapshot.tournament}
          kind="temporary"
        />
      )}
      {!general && graphics.lowerThird && (
        <Graphic
          key={graphics.lowerThird.id}
          graphic={graphics.lowerThird}
          match={match}
          tournament={snapshot.tournament}
          kind="lower"
        />
      )}
    </div>
  );
}

function BroadcastGraphic({ graphic, now, tournament }) {
  const type = graphic.type.replace('broadcast_', '');
  const full = ['opening', 'break', 'ending', 'countdown'].includes(type);
  const labels = { opening: 'BIENVENIDOS', break: 'PAUSA', ending: 'HASTA PRONTO', countdown: 'COMENZAMOS EN', speaker: 'EN CONVERSACIÓN', topic: 'AHORA', location: 'DESDE', social: 'CONECTA', announcement: 'INFORMACIÓN' };
  const remaining = Math.max(0, Math.ceil(((new Date(graphic.activatedAt).getTime() || now) + (graphic.data?.seconds || 300) * 1000 - now) / 1000));
  return <section className={`tv-broadcast-card ${full ? 'tv-broadcast-full' : type === 'announcement' ? 'tv-broadcast-notice' : 'tv-broadcast-lower'}`}>
    {full && <div className="tv-broadcast-brand">{tournament?.logo?.secureUrl && <img src={tournament.logo.secureUrl} alt="" />}<span>{tournament?.name}</span></div>}
    <span className="tv-graphic-kicker">{labels[type] || 'EN VIVO'}</span>
    <h1>{graphic.data?.title}</h1>
    {graphic.data?.subtitle && <p>{graphic.data.subtitle}</p>}
    {type === 'countdown' && <strong className="tv-broadcast-countdown">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</strong>}
  </section>;
}

function SponsorRibbon({ sponsors, now }) {
  const active = sponsors.filter((sponsor) => sponsor.active !== false);
  if (!active.length) return null;
  const total = active.reduce(
    (sum, sponsor) => sum + Math.max(3, Number(sponsor.durationSeconds) || 10),
    0,
  );
  let cursor = Math.floor(now / 1000) % total;
  let sponsor = active[0];
  for (const item of active) {
    cursor -= Math.max(3, Number(item.durationSeconds) || 10);
    if (cursor < 0) {
      sponsor = item;
      break;
    }
  }
  return (
    <section
      key={sponsor.id}
      className="tv-sponsor-ribbon"
      style={{
        "--sponsor-bg": sponsor.backgroundColor || "#101720",
        "--sponsor-text": sponsor.textColor || "#ffffff",
        "--sponsor-accent": sponsor.accentColor || "#e0b84d",
      }}
    >
      <div className="tv-sponsor-logo">
        {sponsor.logo?.secureUrl ? (
          <img src={sponsor.logo.secureUrl} alt="" />
        ) : (
          <b>{sponsor.name.slice(0, 2).toUpperCase()}</b>
        )}
      </div>
      <div className="tv-sponsor-copy">
        <span>{sponsor.category || "AUSPICIANTE OFICIAL"}</span>
        <strong>{sponsor.name}</strong>
        {sponsor.headline && <b>{sponsor.headline}</b>}
        {sponsor.description && <p>{sponsor.description}</p>}
      </div>
      <div className="tv-sponsor-details">
        {[
          ["DIRECCIÓN", sponsor.location],
          ["TELÉFONO", sponsor.phone],
          ["WEB / EMAIL", sponsor.url?.replace(/^https?:\/\//, "")],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div className="tv-sponsor-detail" key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
      </div>
    </section>
  );
}

function RenderGraphic(props) {
  const { graphic, match } = props;
  if (["descanso", "resultado_final"].includes(graphic.type))
    return (
      <MatchScoreCard
        match={match}
        tournament={props.tournament}
        final={graphic.type === "resultado_final"}
      />
    );
  if (graphic.type === "estadisticas") {
    const rows = [
      ["Posesión", "possession", "%"],
      ["Remates", "shots", ""],
      ["Al arco", "onTarget", ""],
      ["Corners", "corners", ""],
      ["Faltas", "fouls", ""],
    ];
    return (
      <section className="tv-graphic tv-graphic-full">
        <span className="tv-graphic-kicker">ESTADÍSTICAS DEL PARTIDO</span>
        <h1>
          {match.homeTeam?.shortName} <em>vs</em> {match.awayTeam?.shortName}
        </h1>
        <div className="tv-stat-board">
          {rows.map(([name, field, suffix]) => (
            <p key={field}>
              <b>
                {match.stats?.home?.[field] ?? 0}
                {suffix}
              </b>
              <span>{name}</span>
              <b>
                {match.stats?.away?.[field] ?? 0}
                {suffix}
              </b>
            </p>
          ))}
        </div>
        <div className="tv-graphic-bar" />
      </section>
    );
  }
  if (graphic.type === "tabla_vivo")
    return (
      <section className="tv-graphic tv-graphic-full">
        <span className="tv-graphic-kicker">TABLA EN VIVO</span>
        <h1>
          {match.homeTeam?.name}{" "}
          <em>
            {match.score.home} - {match.score.away}
          </em>{" "}
          {match.awayTeam?.name}
        </h1>
        <p>Resultado provisional de la jornada</p>
        <div className="tv-graphic-bar" />
      </section>
    );
  if (graphic.type === "arbitros")
    return (
      <section className="tv-graphic tv-graphic-full">
        <span className="tv-graphic-kicker">CUERPO ARBITRAL</span>
        <h1>{match.officials?.referee || "Árbitro por confirmar"}</h1>
        <p>
          {(match.officials?.assistants || []).join(" · ") ||
            "Asistentes por confirmar"}
        </p>
        <div className="tv-graphic-bar" />
      </section>
    );
  if (["presentacion", "enfrentamiento"].includes(graphic.type))
    return (
      <section className="tv-opening-card">
        <span className="tv-opening-kicker">{match.round || "EL PARTIDO"}</span>
        <p>{props.tournament?.name || "FUTBOL EN VIVO"}</p>
        <div className="tv-opening-matchup">
          <div>
            {match.homeTeam?.crest?.secureUrl ? (
              <img src={match.homeTeam.crest.secureUrl} alt="" />
            ) : null}
            <b>
              {match.homeTeam?.shortName || match.homeTeam?.name || "Local"}
            </b>
          </div>
          <strong>VS</strong>
          <div>
            {match.awayTeam?.crest?.secureUrl ? (
              <img src={match.awayTeam.crest.secureUrl} alt="" />
            ) : null}
            <b>
              {match.awayTeam?.shortName || match.awayTeam?.name || "Visitante"}
            </b>
          </div>
        </div>
        <footer>{match.stadium || "ESTADIO POR CONFIRMAR"}</footer>
      </section>
    );
  return <Graphic {...props} />;
}

function MatchScoreCard({ match, tournament, final }) {
  const stage = final ? "RESULTADO FINAL" : "MEDIO TIEMPO";
  const detail = final ? "FINAL DEL PARTIDO" : "FINAL DEL PRIMER TIEMPO";
  const minute = final ? "FINAL" : "DESCANSO";
  const teamName = (team, fallback) => team?.shortName || team?.name || fallback;
  const Team = ({ team, fallback }) => (
    <div className="tv-match-showcase-team">
      <div className="tv-match-showcase-crest">
        {team?.crest?.secureUrl ? (
          <img src={team.crest.secureUrl} alt="" />
        ) : (
          <span>{team?.code || fallback}</span>
        )}
      </div>
      <b>{teamName(team, fallback)}</b>
    </div>
  );
  return (
    <section className={`tv-match-showcase-card ${final ? "tv-is-final" : "tv-is-halftime"}`}>
      <header className="tv-match-showcase-header">
        <span>{tournament?.name || "FÚTBOL EN VIVO"}</span>
        {tournament?.logo?.secureUrl && (
          <img src={tournament.logo.secureUrl} alt="" />
        )}
        <strong>{stage}</strong>
      </header>
      <div className="tv-match-showcase-body">
        <Team team={match.homeTeam} fallback="LOC" />
        <div className="tv-match-showcase-score">
          <strong>{match.score.home}</strong>
          <div className="tv-match-showcase-divider">
            <i>—</i>
            <b>{minute}</b>
          </div>
          <strong>{match.score.away}</strong>
          <span>{detail}</span>
        </div>
        <Team team={match.awayTeam} fallback="VIS" />
      </div>
      <footer className="tv-match-showcase-footer">
        <span>{match.round || "PARTIDO OFICIAL"}</span>
        <b>{match.stadium || "TRANSMISIÓN EN VIVO"}</b>
      </footer>
    </section>
  );
}

function Graphic({ graphic, match, tournament, kind }) {
  const label =
    {
      presentacion: "PRESENTACIÓN DEL PARTIDO",
      enfrentamiento: "ENFRENTAMIENTO",
      alineacion_local: "ALINEACIÓN LOCAL",
      alineacion_visitante: "ALINEACIÓN VISITANTE",
      formacion_local: "FORMACIÓN LOCAL",
      formacion_visitante: "FORMACIÓN VISITANTE",
      descanso: "MEDIO TIEMPO",
      resultado_final: "RESULTADO FINAL",
      gol: "GOL",
      yellow_card: "TARJETA AMARILLA",
      red_card: "TARJETA ROJA",
      substitution: "SUSTITUCIÓN",
      patrocinador: "PRESENTADO POR",
      aviso: "AVISO INFORMATIVO",
      rotulo_jugador: "JUGADOR",
      rotulo_entrenador: "ENTRENADOR",
      narradores: "NARRACIÓN",
      comentaristas: "COMENTARIOS",
    }[graphic.type] || "IMBABURA EN VIVO";
  const full = kind === "main";
  const lineup =
    graphic.type.includes("alineacion") || graphic.type.includes("formacion");
  const isHome = graphic.type.endsWith("local");
  const lineupItems = isHome ? match.lineups?.home : match.lineups?.away;
  return (
    <section
      className={`tv-graphic ${full ? "tv-graphic-full" : ""} ${kind === "lower" ? "tv-graphic-lower" : ""} ${lineup ? "tv-lineup" : ""}`}
      data-event={graphic.type}
    >
      <span className="tv-graphic-kicker">{label}</span>
      {full && !lineup && (
        <>
          <h1>
            {match.homeTeam?.name}{" "}
            <em>
              {graphic.type === "resultado_final"
                ? `${match.score.home} — ${match.score.away}`
                : "vs"}
            </em>{" "}
            {match.awayTeam?.name}
          </h1>
          <p>
            {graphic.type === "resultado_final"
              ? "Marcador final"
              : `${match.stadium || "Imbabura"} · ${match.round || "Partido oficial"}`}
          </p>
        </>
      )}
      {lineup && (
        <>
          <h1>{isHome ? match.homeTeam?.name : match.awayTeam?.name}</h1>
          <div className="tv-lineup-list">
            {(lineupItems || [])
              .filter((item) => item.starter)
              .map((item) => (
                <span key={item.player?._id}>
                  <b>{item.player?.number ?? "—"}</b>
                  <span>{item.player?.sportsName || item.player?.fullName}</span>
                </span>
              ))}
          </div>
        </>
      )}
      {!full && (
        <h1>
          {graphic.data?.playerName ||
            graphic.data?.name ||
            graphic.data?.message ||
            graphic.data?.teamName ||
            tournament?.name}
        </h1>
      )}
      <div className="tv-graphic-bar" />
    </section>
  );
}
