import React, { useCallback, useEffect, useMemo, useState } from "react";
import Pusher from "pusher-js";
import "./App.css";

const API = String(
  process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:5000"),
).replace(/\/$/, "");
const api = async (path, options = {}) => {
  const response = await fetch(`${API}/api/sports${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || "No se pudo completar la acción.");
  return data;
};
const remoteApi = async (slug, token, suffix = "", options = {}) => {
  const joiner = suffix.includes("?") ? "&" : "?";
  const response = await fetch(
    `${API}/api/sports/remote/tournaments/${encodeURIComponent(slug)}${suffix}${joiner}token=${encodeURIComponent(token)}`,
    {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || "No se pudo completar la acción remota.");
  return data;
};
const isInput = (element) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
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

function OverlayComposition({ snapshot, preview = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const match = snapshot?.match;
  const graphics = snapshot?.graphics || {};
  const colors = snapshot?.tournament?.colors || {};
  if (!match)
    return (
      <div className={`overlay-root ${preview ? "overlay-preview" : ""}`}>
        <div className="overlay-empty">Esperando partido activo</div>
      </div>
    );
  return (
    <div
      className={`overlay-root ${preview ? "overlay-preview" : ""}`}
      style={{
        "--primary": colors.primary,
        "--secondary": colors.secondary,
        "--accent": colors.accent,
        "--text": colors.text,
        "--background": colors.background,
      }}
    >
      {graphics.scoreboardVisible && (
        <div className="scorebug">
          {snapshot.tournament?.logo?.secureUrl && (
            <img
              className="scorebug-brand"
              src={snapshot.tournament.logo.secureUrl}
              alt=""
            />
          )}
          <div className="team-side">
            {match.homeTeam?.crest?.secureUrl && (
              <img src={match.homeTeam.crest.secureUrl} alt="" />
            )}
            <b>{match.homeTeam?.code}</b>
          </div>
          <strong>
            {match.score.home} — {match.score.away}
          </strong>
          <div className="team-side right">
            <b>{match.awayTeam?.code}</b>
            {match.awayTeam?.crest?.secureUrl && (
              <img src={match.awayTeam.crest.secureUrl} alt="" />
            )}
          </div>
          {graphics.clockVisible && (
            <span className="clock">
              {clockText(match.clock, now)} · {match.clock.period}
              {match.clock.addedTime ? ` +${match.clock.addedTime}` : ""}
            </span>
          )}
        </div>
      )}
      {graphics.clockVisible && !graphics.scoreboardVisible && (
        <div className="standalone-clock">
          {clockText(match.clock, now)} · {match.clock.period}
        </div>
      )}
      {graphics.channelBugVisible && (
        <div className="channel-bug">
          IMBABURA
          <br />
          <b>EN VIVO</b>
        </div>
      )}
      {graphics.sponsorBugVisible && (
        <SponsorRibbon sponsors={snapshot?.sponsors || []} now={now} />
      )}
      {graphics.main && (
        <RenderGraphic
          key={graphics.main.id}
          graphic={graphics.main}
          match={match}
          tournament={snapshot.tournament}
          kind="main"
        />
      )}
      {graphics.temporary && (
        <Graphic
          key={graphics.temporary.id}
          graphic={graphics.temporary}
          match={match}
          tournament={snapshot.tournament}
          kind="temporary"
        />
      )}
      {graphics.lowerThird && (
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

function SponsorRibbon({ sponsors, now }) {
  const active = sponsors.filter((sponsor) => sponsor.active !== false);
  if (!active.length)
    return (
      <section className="sponsor-ribbon sponsor-ribbon-empty">
        Configura auspiciantes en el panel
      </section>
    );
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
      className="sponsor-ribbon"
      style={{
        "--sponsor-bg": sponsor.backgroundColor || "#101720",
        "--sponsor-text": sponsor.textColor || "#ffffff",
        "--sponsor-accent": sponsor.accentColor || "#e0b84d",
      }}
    >
      <div className="sponsor-logo">
        {sponsor.logo?.secureUrl ? (
          <img src={sponsor.logo.secureUrl} alt="" />
        ) : (
          <b>{sponsor.name.slice(0, 2).toUpperCase()}</b>
        )}
      </div>
      <div className="sponsor-copy">
        <span>{sponsor.category || "AUSPICIANTE OFICIAL"}</span>
        <strong>{sponsor.name}</strong>
        {sponsor.headline && <b>{sponsor.headline}</b>}
        {sponsor.description && <p>{sponsor.description}</p>}
      </div>
      <div className="sponsor-details">
        {[
          ["DIRECCIÓN", sponsor.location],
          ["TELÉFONO", sponsor.phone],
          ["WEB / EMAIL", sponsor.url?.replace(/^https?:\/\//, "")],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div className="sponsor-detail" key={label}>
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
      ["Posesion", "possession", "%"],
      ["Remates", "shots", ""],
      ["Al arco", "onTarget", ""],
      ["Corners", "corners", ""],
      ["Faltas", "fouls", ""],
    ];
    return (
      <section className="graphic graphic-full">
        <span className="graphic-kicker">ESTADISTICAS DEL PARTIDO</span>
        <h1>
          {match.homeTeam?.shortName} <em>vs</em> {match.awayTeam?.shortName}
        </h1>
        <div className="stat-board">
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
        <div className="graphic-bar" />
      </section>
    );
  }
  if (graphic.type === "tabla_vivo")
    return (
      <section className="graphic graphic-full">
        <span className="graphic-kicker">TABLA EN VIVO</span>
        <h1>
          {match.homeTeam?.name}{" "}
          <em>
            {match.score.home} - {match.score.away}
          </em>{" "}
          {match.awayTeam?.name}
        </h1>
        <p>Resultado provisional de la jornada</p>
        <div className="graphic-bar" />
      </section>
    );
  if (graphic.type === "arbitros")
    return (
      <section className="graphic graphic-full">
        <span className="graphic-kicker">CUERPO ARBITRAL</span>
        <h1>{match.officials?.referee || "Árbitro por confirmar"}</h1>
        <p>
          {(match.officials?.assistants || []).join(" · ") ||
            "Asistentes por confirmar"}
        </p>
        <div className="graphic-bar" />
      </section>
    );
  if (["presentacion", "enfrentamiento"].includes(graphic.type))
    return (
      <section className="opening-card">
        <span className="opening-kicker">PROXIMAMENTE</span>
        <p>{props.tournament?.name || "FUTBOL EN VIVO"}</p>
        <div className="opening-matchup">
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
  const minute = final ? "90'" : "45'";
  const teamName = (team, fallback) => team?.shortName || team?.name || fallback;
  const Team = ({ team, fallback }) => (
    <div className="match-showcase-team">
      <div className="match-showcase-crest">
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
    <section className={`match-showcase-card ${final ? "is-final" : "is-halftime"}`}>
      <header className="match-showcase-header">
        <span>{tournament?.name || "FÚTBOL EN VIVO"}</span>
        {tournament?.logo?.secureUrl && (
          <img src={tournament.logo.secureUrl} alt="" />
        )}
        <strong>{stage}</strong>
      </header>
      <div className="match-showcase-body">
        <Team team={match.homeTeam} fallback="LOC" />
        <div className="match-showcase-score">
          <strong>{match.score.home}</strong>
          <div className="match-showcase-divider">
            <i>—</i>
            <b>{minute}</b>
          </div>
          <strong>{match.score.away}</strong>
          <span>{detail}</span>
        </div>
        <Team team={match.awayTeam} fallback="VIS" />
      </div>
      <footer className="match-showcase-footer">
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
      gol: "¡GOOOL!",
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
      className={`graphic ${full ? "graphic-full" : ""} ${kind === "lower" ? "graphic-lower" : ""}`}
    >
      <span className="graphic-kicker">{label}</span>
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
          <div className="lineup-list">
            {(lineupItems || [])
              .filter((item) => item.starter)
              .map((item) => (
                <span key={item.player?._id}>
                  {item.player?.number || "—"} ·{" "}
                  {item.player?.sportsName || item.player?.fullName}
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
            tournament.name}
        </h1>
      )}
      <div className="graphic-bar" />
    </section>
  );
}

function Overlay() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const slug = window.location.pathname.split("/").filter(Boolean).pop();
  const refresh = useCallback(async () => {
    try {
      const data = await api(
        `/overlay/tournaments/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`,
      );
      setSnapshot((previous) =>
        !previous || data.revision >= previous.revision ? data : previous,
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [slug, token]);
  // Pusher entrega el cambio inmediato; este sondeo corto es la recuperación cuando
  // Pusher no está configurado o se pierde una notificación.
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    if (!slug || !token) return undefined;
    const heartbeat = () =>
      api(
        `/overlay/tournaments/${encodeURIComponent(slug)}/heartbeat?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      ).catch(() => undefined);
    heartbeat();
    const id = window.setInterval(heartbeat, 12000);
    return () => window.clearInterval(id);
  }, [slug, token]);
  useEffect(() => {
    const key = process.env.REACT_APP_PUSHER_KEY || window.__VITE_PUSHER_KEY__;
    const cluster =
      process.env.REACT_APP_PUSHER_CLUSTER || window.__VITE_PUSHER_CLUSTER__;
    if (!key || !cluster || !snapshot?.tournamentId) return undefined;
    const pusher = new Pusher(key, {
      cluster,
      channelAuthorization: {
        endpoint: `${API}/api/sports/overlay/auth?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
        transport: "ajax",
      },
    });
    const channel = pusher.subscribe(
      `private-overlay-${snapshot.tournamentId}`,
    );
    channel.bind("overlay-state", (next) =>
      setSnapshot((old) => (!old || next.revision > old.revision ? next : old)),
    );
    return () => pusher.disconnect();
  }, [snapshot?.tournamentId, slug, token]);
  return error && !snapshot ? (
    <div className="overlay-error">Enlace del overlay no válido.</div>
  ) : (
    <OverlayComposition snapshot={snapshot} />
  );
}

function RemoteControl() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [activePanel, setActivePanel] = useState("score");
  const [pendingGoal, setPendingGoal] = useState(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const slug = window.location.pathname.split("/").filter(Boolean).pop();
  const refresh = useCallback(async () => {
    try {
      const data = await remoteApi(slug, token);
      setSnapshot(data);
      setError("");
    } catch (remoteError) {
      setError(remoteError.message);
    }
  }, [slug, token]);
  useEffect(() => {
    refresh();
    const refreshTimer = window.setInterval(refresh, 3000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!pendingGoal) return undefined;
    const timeout = window.setTimeout(() => setPendingGoal(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [pendingGoal]);
  const send = async (action, extra = {}) => {
    setBusy(true);
    try {
      const data = await remoteApi(slug, token, "/control", {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      setSnapshot(data.snapshot);
      setError("");
    } catch (remoteError) {
      setError(remoteError.message);
    } finally {
      setBusy(false);
    }
  };
  const match = snapshot?.match;
  const score = match?.score || { home: 0, away: 0 };
  const changeScore = (side, delta) =>
    send("score_manual", {
      home: Math.max(0, Number(score.home || 0) + (side === "home" ? delta : 0)),
      away: Math.max(0, Number(score.away || 0) + (side === "away" ? delta : 0)),
    });
  const goal = (side, team) => {
    if (pendingGoal !== side) {
      setPendingGoal(side);
      return;
    }
    setPendingGoal(null);
    send(side === "home" ? "goal_home" : "goal_away", {
      teamName: team?.shortName || team?.name,
    });
  };
  if (error && !snapshot)
    return <main className="remote-shell remote-error"><h1>Control remoto no disponible</h1><p>{error}</p></main>;
  return (
    <main className="remote-shell">
      <header className="remote-header">
        <div><span>CONTROL REMOTO SEGURO</span><h1>{snapshot?.tournament?.name || "Cargando"}</h1></div>
        <b>{busy ? "ENVIANDO" : "● CONECTADO"}</b>
      </header>
      <section className="remote-match-card">
        <span>{match?.clock?.period || "Sin partido activo"}</span>
        <strong>{match ? clockText(match.clock, now) : "--:--"}</strong>
        <p>{match ? `${match.homeTeam?.shortName || match.homeTeam?.name} vs ${match.awayTeam?.shortName || match.awayTeam?.name}` : "Activa un partido desde la consola principal"}</p>
      </section>
      {match && <>
        {activePanel === "score" && <>
        <section className="remote-score-grid">
          {[["home", match.homeTeam], ["away", match.awayTeam]].map(([side, team]) => (
            <article key={side}>
              <span>{team?.shortName || team?.name}</span>
              <b>{score[side] || 0}</b>
              <div><button disabled={busy} onClick={() => changeScore(side, -1)}>−</button><button disabled={busy} onClick={() => changeScore(side, 1)}>+</button></div>
              <button className={`remote-goal ${pendingGoal === side ? "remote-goal-confirm" : ""}`} disabled={busy} onClick={() => goal(side, team)}>{pendingGoal === side ? "CONFIRMAR GOL" : "GOL"}</button>
            </article>
          ))}
        </section>
        <section className="remote-actions">
          <button className={match.clock?.running ? "remote-pause" : "remote-start"} disabled={busy} onClick={() => send(match.clock?.running ? "clock_pause" : "clock_start")}>{match.clock?.running ? "Pausar reloj" : "Iniciar reloj"}</button>
          <button disabled={busy} onClick={() => send("scoreboard", { visible: !snapshot.graphics?.scoreboardVisible })}>{snapshot.graphics?.scoreboardVisible ? "Ocultar marcador" : "Mostrar marcador"}</button>
          <button disabled={busy} onClick={() => send("clear_graphics")}>Limpiar gráficos</button>
        </section>
        </>}
        {activePanel === "scenes" && <>
        <section className="remote-scenes">
          <span>ESCENAS</span>
          {[['juego', 'Juego'], ['descanso', 'Descanso'], ['segundo_tiempo', '2T'], ['final', 'Final']].map(([preset, label]) => <button key={preset} disabled={busy} onClick={() => send('preset', { preset })}>{label}</button>)}
        </section>
        <section className="remote-graphics">
          <span>GRÁFICOS Y EMERGENCIA</span>
          <button disabled={busy} onClick={() => send("scoreboard", { visible: !snapshot.graphics?.scoreboardVisible })}>{snapshot.graphics?.scoreboardVisible ? "Ocultar marcador" : "Mostrar marcador"}</button>
          <button disabled={busy} onClick={() => send("clear_graphics")}>Limpiar gráficos</button>
          <button className="remote-danger" disabled={busy} onClick={() => send("hide_all")}>Apagar salida</button>
        </section>
        </>}
        {activePanel === "stats" && <>
        <section className="remote-stats">
          <span>ESTADÍSTICAS RÁPIDAS</span>
          {[["corners", "Corner"], ["shots", "Remate"]].map(([field, label]) => <div key={field}><b>{label}</b><button disabled={busy} onClick={() => send("stats", { side: "home", field, value: (match.stats?.home?.[field] || 0) + 1 })}>+ Local</button><button disabled={busy} onClick={() => send("stats", { side: "away", field, value: (match.stats?.away?.[field] || 0) + 1 })}>+ Visita</button></div>)}
        </section>
        </>}
      </>}
      {error && <p className="remote-message">{error}</p>}
      {match && <nav className="remote-bottom-nav" aria-label="Secciones de control">
        {[['score', 'Marcador'], ['scenes', 'Escenas'], ['stats', 'Datos']].map(([panel, label]) => <button key={panel} className={activePanel === panel ? "remote-nav-active" : ""} onClick={() => setActivePanel(panel)}>{label}</button>)}
      </nav>}
    </main>
  );
}

function Login({ setAdmin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAdmin(data.admin);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">CODEBRIQ MEDIA</span>
        <h1>
          Imbabura
          <br />
          <i>en Vivo</i>
        </h1>
        <p>Centro de control de gráficos.</p>
        <label>
          Correo
          <input
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button>Iniciar sesión</button>
      </form>
    </main>
  );
}

// Primer nivel: únicamente decisiones que se toman durante la emisión.
// Las escenas superiores resuelven el resto de la narrativa del partido.
const deck = [
  ["scoreboard", "▣  Marcador", "permanent"],
  ["gol", "⚽  Gol / goleador", "event"],
  ["yellow_card", "▰  Tarjeta amarilla", "event"],
  ["red_card", "▰  Tarjeta roja", "event"],
  ["var", "◉  Revisión VAR", "event"],
  ["alineacion_local", "◫  Once local", "main"],
  ["alineacion_visitante", "◫  Once visita", "main"],
  ["estadisticas", "▥  Estadísticas", "main"],
  ["tabla_vivo", "≡  Resultado en vivo", "main"],
  ["arbitros", "✦  Cuerpo arbitral", "main"],
  ["rotulo_jugador", "▱  Rótulo jugador", "lower"],
  ["sponsors", "◇  Rotar auspiciantes", "sponsors"],
  ["aviso", "!  Aviso al aire", "event"],
];
const graphicGroups = [
  {
    id: "events",
    label: "Eventos",
    hint: "Acciones puntuales: se preparan en cola y salen con TAKE.",
    types: ["gol", "yellow_card", "red_card", "var", "aviso"],
  },
  {
    id: "screens",
    label: "Pantallas",
    hint: "Gráficos principales que permanecen al aire hasta cambiarlos.",
    types: [
      "alineacion_local",
      "alineacion_visitante",
      "estadisticas",
      "tabla_vivo",
      "arbitros",
    ],
  },
  {
    id: "layers",
    label: "Capas",
    hint: "Elementos superpuestos, como rótulos y auspiciantes.",
    types: ["rotulo_jugador", "sponsors"],
  },
];
const playerEventTypes = new Set([
  "gol",
  "yellow_card",
  "red_card",
]);
const cueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const cueLabel = (label) => label.replace(/^.+?\s{2}/, "");

function ClockControl({ snapshot, control, disabled }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const clock = snapshot?.match?.clock;
  const running = Boolean(clock?.running);
  const value = clockText(clock, now);
  const adjust = (amount) => control("clock_add", { seconds: amount });
  const correct = () => {
    const raw = window.prompt(
      "Tiempo total en segundos:",
      String(seconds(clock, now)),
    );
    if (raw !== null && /^\d+$/.test(raw))
      control("clock_correct", { seconds: Number(raw) });
  };
  return (
    <section className="clock-console">
      <div>
        <span>TIEMPO DE PARTIDO</span>
        <strong>{value}</strong>
        <small>{clock?.period || "Primer tiempo"}</small>
      </div>
      <div className="clock-actions">
        <button disabled={disabled} onClick={() => adjust(-60)}>
          −1 min
        </button>
        <button disabled={disabled} onClick={() => adjust(-10)}>
          −10 s
        </button>
        <button
          disabled={disabled}
          className={running ? "clock-running" : "clock-start"}
          onClick={() => control(running ? "clock_pause" : "clock_start")}
        >
          {running ? "Ⅱ Pausar" : "▶ Iniciar"}
        </button>
        <button disabled={disabled} onClick={() => adjust(10)}>
          +10 s
        </button>
        <button disabled={disabled} onClick={() => adjust(60)}>
          +1 min
        </button>
        <button disabled={disabled} onClick={correct}>
          Corregir
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            if (window.confirm("¿Reiniciar el cronómetro?"))
              control("clock_reset");
          }}
        >
          Reiniciar
        </button>
      </div>
      <div className="period-actions">
        {[
          ["Primer tiempo", "1T"],
          ["Segundo tiempo", "2T"],
          ["Prórroga", "Extra"],
          ["Penales", "Penales"],
        ].map(([period, label]) => (
          <button
            key={period}
            disabled={disabled}
            className={clock?.period === period ? "period-active" : ""}
            onClick={() =>
              control("period", {
                period,
                status: period === "Penales" ? "en_vivo" : "en_vivo",
              })
            }
          >
            {label}
          </button>
        ))}
        <button
          disabled={disabled}
          className={clock?.addedTime ? "period-active" : ""}
          onClick={() =>
            control("added_time", { minutes: clock?.addedTime ? 0 : 1 })
          }
        >
          +{clock?.addedTime || 0}' añadido
        </button>
      </div>
    </section>
  );
}

function ScoreControl({ snapshot, control, disabled }) {
  const match = snapshot?.match;
  const score = match?.score || {};
  const discipline = match?.discipline || {};
  const changeScore = (side, delta) =>
    {
      const home = Math.max(
        0,
        (Number(score.home) || 0) + (side === "home" ? delta : 0),
      );
      const away = Math.max(
        0,
        (Number(score.away) || 0) + (side === "away" ? delta : 0),
      );
      const team = side === "home" ? match?.homeTeam : match?.awayTeam;
      if (!window.confirm(`¿Cambiar el marcador de ${team?.shortName || "este equipo"} a ${side === "home" ? home : away}?`)) return;
      control("score_manual", { home, away });
    };
  const changeCard = (side, delta) =>
    control("discipline", { side, field: "redCards", delta });
  return (
    <section className="score-console">
      <div className="overlay-toggle">
        <span>OVERLAY</span>
        <button
          disabled={disabled}
          className={snapshot?.graphics?.scoreboardVisible ? "toggle-on" : ""}
          onClick={() =>
            control("scoreboard", {
              visible: !snapshot?.graphics?.scoreboardVisible,
            })
          }
        >
          {snapshot?.graphics?.scoreboardVisible ? "ON" : "OFF"}
        </button>
      </div>
      <div className="score-columns">
        {[
          ["home", match?.homeTeam],
          ["away", match?.awayTeam],
        ].map(([side, team]) => (
          <div key={side} className="score-team">
            <span>
              {team?.shortName || (side === "home" ? "Local" : "Visita")}
            </span>
            <div>
              <button disabled={disabled} onClick={() => changeScore(side, -1)}>
                −
              </button>
              <strong>{score?.[side] || 0}</strong>
              <button disabled={disabled} onClick={() => changeScore(side, 1)}>
                +
              </button>
            </div>
            <small>Rojas</small>
            <div>
              <button disabled={disabled} onClick={() => changeCard(side, -1)}>
                −
              </button>
              <b>{discipline?.[side]?.redCards || 0}</b>
              <button disabled={disabled} onClick={() => changeCard(side, 1)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsControl({ snapshot, control, disabled }) {
  const match = snapshot?.match;
  const stats = match?.stats || {};
  const rows = [
    ["Posesión", "possession", "%", 5],
    ["Remates", "shots", "", 1],
    ["Al arco", "onTarget", "", 1],
    ["Corners", "corners", "", 1],
    ["Faltas", "fouls", "", 1],
  ];
  const update = (side, field, delta) =>
    control("stats", {
      side,
      field,
      value:
        field === "possession"
          ? Math.max(0, Math.min(100, (Number(stats?.[side]?.[field]) || 0) + delta))
          : Math.max(0, (Number(stats?.[side]?.[field]) || 0) + delta),
    });
  return (
    <section className="stats-console">
      <div className="stats-console-heading">
        <div>
          <span>DATOS DE PARTIDO</span>
          <strong>Estadísticas rápidas</strong>
        </div>
        <small>Se reflejan en el gráfico Estadísticas</small>
      </div>
      <div className="stats-grid">
        {rows.map(([label, field, suffix, increment]) => (
          <div key={field} className="stat-control-row">
            <span>{label}</span>
            <div>
              <button disabled={disabled} onClick={() => update("home", field, -increment)}>
                −
              </button>
              <b>{stats?.home?.[field] ?? 0}{suffix}</b>
              <button disabled={disabled} onClick={() => update("home", field, increment)}>
                +
              </button>
            </div>
            <div>
              <button disabled={disabled} onClick={() => update("away", field, -increment)}>
                −
              </button>
              <b>{stats?.away?.[field] ?? 0}{suffix}</b>
              <button disabled={disabled} onClick={() => update("away", field, increment)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ admin, setAdmin }) {
  const [tab, setTab] = useState("live");
  const [tournaments, setTournaments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [events, setEvents] = useState([]);
  const [notice, setNotice] = useState("");
  const [picker, setPicker] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cueList, setCueList] = useState([]);
  const [selectedCueId, setSelectedCueId] = useState("");
  const [libraryGroup, setLibraryGroup] = useState("events");
  const [lastTakenCue, setLastTakenCue] = useState(null);
  const [cueNow, setCueNow] = useState(Date.now());
  const [apiOnline, setApiOnline] = useState(null);
  const [statusNow, setStatusNow] = useState(Date.now());
  const selected =
    tournaments.find((t) => t._id === selectedId) || tournaments[0];
  const activeMatch = matches.find((m) => m._id === selected?.activeMatch?._id);
  const graphics = useMemo(() => snapshot?.graphics || {}, [snapshot]);
  const onAirLayers = [
    graphics.scoreboardVisible && { type: "Marcador" },
    graphics.main,
    graphics.temporary,
    graphics.lowerThird,
    graphics.sponsorBugVisible && { type: "Auspiciantes" },
  ].filter(Boolean);
  const onAirLabel = onAirLayers[0]?.type?.replace(/_/g, " ") || "Sin grafico";
  const overlaySeenAt = snapshot?.overlayLastSeenAt
    ? new Date(snapshot.overlayLastSeenAt).getTime()
    : 0;
  const overlayOnline = Boolean(overlaySeenAt && statusNow - overlaySeenAt < 30000);
  const selectedCue =
    cueList.find((cue) => cue.id === selectedCueId) || cueList[0] || null;
  const activeGraphicGroup =
    graphicGroups.find((group) => group.id === libraryGroup) || graphicGroups[0];
  const lastTakenRemaining = lastTakenCue?.duration
    ? Math.max(
        0,
        lastTakenCue.duration - Math.floor((cueNow - lastTakenCue.takenAt) / 1000),
      )
    : null;
  const cuePreviewSnapshot = useMemo(() => {
    if (!snapshot) return snapshot;
    const nextGraphics = {
      scoreboardVisible: false,
      clockVisible: false,
      channelBugVisible: false,
      sponsorBugVisible: false,
      main: null,
      temporary: null,
      lowerThird: null,
    };
    if (!selectedCue) return { ...snapshot, graphics: nextGraphics };
    const previewGraphic = {
      id: `cue-${selectedCue.id}`,
      type: selectedCue.type,
      data:
        selectedCue.data ||
        (selectedCue.layer === "event"
          ? { message: selectedCue.label.replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/, "") }
          : {}),
    };
    if (selectedCue.type === "scoreboard") {
      nextGraphics.scoreboardVisible = true;
      nextGraphics.clockVisible = true;
    }
    else if (selectedCue.type === "sponsors") nextGraphics.sponsorBugVisible = true;
    else if (selectedCue.layer === "main") nextGraphics.main = previewGraphic;
    else if (selectedCue.layer === "lower") nextGraphics.lowerThird = previewGraphic;
    else nextGraphics.temporary = previewGraphic;
    return { ...snapshot, graphics: nextGraphics };
  }, [selectedCue, snapshot]);
  const say = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  };
  const load = useCallback(async () => {
    try {
      const ts = await api("/tournaments");
      setTournaments(ts);
      const id = selectedId || ts[0]?._id;
      if (!id) return;
      const [teamData, matchData, state, playerData, sponsorData] =
        await Promise.all([
          api(`/teams?tournament=${id}`),
          api(`/matches?tournament=${id}`),
          api(`/tournaments/${id}/overlay-state`),
          api(`/players/by-tournament/${id}`),
          api(`/sponsors?tournament=${id}`),
        ]);
      setTeams(teamData);
      setMatches(matchData);
      setSnapshot(state);
      setPlayers(playerData);
      setSponsors(sponsorData);
      const active = ts.find((t) => t._id === id)?.activeMatch?._id;
      setEvents(active ? await api(`/matches/${active}/events`) : []);
    } catch (e) {
      say(e.message);
    }
  }, [selectedId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API}/health`);
        if (mounted) setApiOnline(response.ok);
      } catch {
        if (mounted) setApiOnline(false);
      }
    };
    checkHealth();
    const healthTimer = window.setInterval(checkHealth, 10000);
    const clockTimer = window.setInterval(() => setStatusNow(Date.now()), 5000);
    return () => {
      mounted = false;
      window.clearInterval(healthTimer);
      window.clearInterval(clockTimer);
    };
  }, []);
  const control = async (action, extra = {}) => {
    const id = selected?.activeMatch?._id;
    if (!id) return say("Selecciona primero el partido activo.");
    try {
      const data = await api(`/matches/${id}/control`, {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      setSnapshot(data.snapshot);
      setEvents(await api(`/matches/${id}/events`));
    } catch (e) {
      say(e.message);
    }
  };
  useEffect(() => {
    if (!lastTakenCue?.duration) return undefined;
    const timer = window.setInterval(() => setCueNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lastTakenCue]);
  useEffect(() => {
    if (lastTakenCue?.duration && lastTakenRemaining === 0)
      setLastTakenCue(null);
  }, [lastTakenCue, lastTakenRemaining]);
  const addToCue = (item, data) => {
    const [type, label, layer] = item;
    const nextCue = {
      id: cueId(),
      type,
      label,
      layer,
      data,
      duration: layer === "event" ? 8 : 0,
    };
    setCueList((list) => [...list, nextCue]);
    setSelectedCueId(nextCue.id);
    say(`${cueLabel(label)} preparado en la cola.`);
  };
  const cueGraphic = (item) => {
    if (!activeMatch) return say("Falta seleccionar un partido activo.");
    const [type, label, layer] = item;
    if (type === "scoreboard" && graphics.scoreboardVisible)
      return control("scoreboard", { visible: false });
    if (type === "sponsors" && graphics.sponsorBugVisible)
      return control("layer", { field: "sponsorBugVisible", visible: false });
    const current =
      layer === "main"
        ? graphics.main
        : layer === "lower"
          ? graphics.lowerThird
          : graphics.temporary;
    if (current?.type === type)
      return control("hide_graphic", {
        layer: layer === "lower" ? "lower" : layer,
      });
    if (playerEventTypes.has(type))
      return setPicker({ type, label, queueItem: item });
    addToCue(item);
  };
  const removeCue = (id) => {
    setCueList((list) => {
      const next = list.filter((cue) => cue.id !== id);
      if (selectedCueId === id) setSelectedCueId(next[0]?.id || "");
      return next;
    });
  };
  const playCue = async (cue) => {
    if (cue.type === "scoreboard")
      return control("scoreboard", { visible: true });
    if (cue.type === "sponsors")
      return control("layer", { field: "sponsorBugVisible", visible: true });
    return control("graphic", {
      type: cue.type,
      duration: cue.layer === "event" ? cue.duration * 1000 : 0,
      data: cue.data,
    });
  };
  const dispatchEvent = async (data, type, duration = 8000) => {
    const side = data.team === activeMatch?.homeTeam?._id ? "home" : "away";
    if (type === "gol")
      return control(side === "home" ? "goal_home" : "goal_away", {
        team: data.team,
        player: data.player,
        teamName:
          side === "home"
            ? activeMatch.homeTeam?.shortName
            : activeMatch.awayTeam?.shortName,
        duration,
        data,
      });
    if (type === "penal")
      return control(side === "home" ? "penalty_home" : "penalty_away", {
        team: data.team,
        player: data.player,
        teamName:
          side === "home"
            ? activeMatch.homeTeam?.shortName
            : activeMatch.awayTeam?.shortName,
        duration,
        data,
      });
    return control("graphic", {
      type,
      duration,
      team: data.team,
      player: data.player,
      playerIn: data.playerIn,
      playerOut: data.playerOut,
      data,
    });
  };
  const sendEvent = async (data) => {
    const pendingPicker = picker;
    setPicker(null);
    if (pendingPicker?.queueItem) return addToCue(pendingPicker.queueItem, data);
    return dispatchEvent(data, pendingPicker?.type);
  };
  const takeCue = async () => {
    if (!selectedCue) return;
    const cue = selectedCue;
    try {
      if (playerEventTypes.has(cue.type))
        await dispatchEvent(cue.data, cue.type, cue.duration * 1000);
      else await playCue(cue);
      const nextCue = cueList.find((item) => item.id !== cue.id);
      setCueList((list) => list.filter((item) => item.id !== cue.id));
      setSelectedCueId(nextCue?.id || "");
      setCueNow(Date.now());
      setLastTakenCue({ ...cue, takenAt: Date.now() });
      say(`${cueLabel(cue.label)} enviado al aire.`);
    } catch (error) {
      say(error.message);
    }
  };
  const createTournament = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await api("/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          season: form.get("season"),
          slug: form.get("slug"),
        }),
      });
      e.target.reset();
      await load();
      say("Torneo creado. Guarda el token entregado al crear la URL de OBS.");
    } catch (err) {
      say(err.message);
    }
  };
  const create = async (e, type) => {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.target);
    const body =
      type === "teams"
        ? {
            tournament: selected._id,
            name: f.get("name"),
            shortName: f.get("shortName"),
            code: f.get("code"),
          }
        : type === "players"
          ? {
              team: f.get("team"),
              fullName: f.get("name"),
              sportsName: f.get("sportsName"),
              number: Number(f.get("number")),
              position: f.get("position"),
            }
          : {
              tournament: selected._id,
              homeTeam: f.get("home"),
              awayTeam: f.get("away"),
              stadium: f.get("stadium"),
              round: f.get("round"),
            };
    try {
      await api(`/${type}`, { method: "POST", body: JSON.stringify(body) });
      e.target.reset();
      await load();
    } catch (err) {
      say(err.message);
    }
  };
  const activate = async (id) => {
    await api(`/tournaments/${selected._id}/active-match`, {
      method: "POST",
      body: JSON.stringify({ matchId: id }),
    });
    await load();
    say("Partido activo actualizado; OBS mantiene la misma URL.");
  };
  const copyUrl = async () => {
    if (!window.confirm("Esto invalida la URL anterior de OBS. ¿Continuar?"))
      return;
    try {
      const data = await api(`/tournaments/${selected._id}/overlay-token`, {
        method: "POST",
      });
      await navigator.clipboard.writeText(
        `${window.location.origin}${data.overlayUrl}`,
      );
      say("Nueva URL de OBS copiada.");
    } catch (e) {
      say(e.message);
    }
  };
  const copyRemoteUrl = async () => {
    if (!window.confirm("Esto invalida el enlace remoto anterior. ¿Continuar?")) return;
    try {
      const data = await api(`/tournaments/${selected._id}/remote-token`, {
        method: "POST",
      });
      await navigator.clipboard.writeText(
        `${window.location.origin}${data.remoteUrl}`,
      );
      say("Enlace seguro de control remoto copiado.");
    } catch (error) {
      say(error.message);
    }
  };
  const undoLastAction = async () => {
    const id = selected?.activeMatch?._id;
    if (!id) return say("Selecciona primero el partido activo.");
    try {
      const data = await api(`/matches/${id}/undo`, { method: "POST" });
      setSnapshot(data.snapshot);
      setEvents(await api(`/matches/${id}/events`));
      say("Última acción reversible deshecha.");
    } catch (error) {
      say(error.message);
    }
  };
  useEffect(() => {
    const handler = (e) => {
      if (isInput(e.target)) return;
      const map = {
        " ": () =>
          control(activeMatch?.clock?.running ? "clock_pause" : "clock_start"),
        h: () => setPicker({ type: "gol", label: "Gol local" }),
        v: () => setPicker({ type: "gol", label: "Gol visitante" }),
        t: () => takeCue(),
        m: () => control("scoreboard", { visible: !graphics.scoreboardVisible }),
        Escape: () => control("hide_graphic"),
        z: () => undoLastAction(),
      };
      if (map[e.key]) {
        e.preventDefault();
        map[e.key]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  if (!selected)
    return (
      <main className="app-shell">
        <aside>
          <div className="brand">
            IMBABURA <i>EN VIVO</i>
          </div>
        </aside>
        <section className="workspace">
          <Config title="Crear primer torneo" onSubmit={createTournament}>
            <input name="name" placeholder="Nombre del torneo" required />
            <input name="season" placeholder="Temporada" />
            <input name="slug" placeholder="slug-del-torneo" />
          </Config>
        </section>
      </main>
    );
  return (
    <main className="app-shell">
      <aside>
        <div className="brand">
          IMBABURA <i>EN VIVO</i>
        </div>
        <small>{admin.name}</small>
        <button
          className={`sidebar-nav ${tab === "live" ? "nav-active" : "outline"}`}
          onClick={() => setTab("live")}
        >
          ◉ Control en vivo
        </button>
        <button
          className={`sidebar-nav ${tab === "setup" ? "nav-active" : "outline"}`}
          onClick={() => setTab("setup")}
        >
          ⚙ Configuración previa
        </button>
        <button
          className={`sidebar-nav ${tab === "sponsors" ? "nav-active" : "outline"}`}
          onClick={() => setTab("sponsors")}
        >
          Auspiciantes
        </button>
        <button
          className={`sidebar-nav ${tab === "theme" ? "nav-active" : "outline"}`}
          onClick={() => setTab("theme")}
        >
          Marca y tema
        </button>
        <button className="outline sidebar-action" onClick={copyUrl}>
          Copiar URL OBS
        </button>
        <button className="outline sidebar-action" onClick={copyRemoteUrl}>
          Copiar control remoto
        </button>
        <button
          className="outline sidebar-exit"
          onClick={async () => {
            await api("/auth/logout", { method: "POST" });
            setAdmin(null);
          }}
        >
          Cerrar sesión
        </button>
        <div className="tournament-list">
          {tournaments.map((t) => (
            <button
              key={t._id}
              className={t._id === selected?._id ? "selected" : ""}
              onClick={() => setSelectedId(t._id)}
            >
              {t.name}
              <small>{t.season}</small>
            </button>
          ))}
        </div>
      </aside>
      <section className="workspace">
        {notice && <div className="toast">{notice}</div>}
        <header>
          <div>
            <span className="eyebrow">
              {tab === "live"
                ? "STREAM DECK · TRANSMISIÓN"
                : "PREPARACIÓN DEL PARTIDO"}
            </span>
            <h1>{selected.name}</h1>
          </div>
          <span className="status">
            ● Sincronizado · rev. {snapshot?.revision ?? 0}
          </span>
        </header>
        {tab === "live" ? (
          <>
            <section className="live-operator-bar">
              <div>
                <span className="eyebrow">CONSOLA DE PRODUCCION</span>
                <strong>
                  {activeMatch
                    ? `${activeMatch.homeTeam?.shortName || activeMatch.homeTeam?.name} vs ${activeMatch.awayTeam?.shortName || activeMatch.awayTeam?.name}`
                    : "Selecciona un partido activo"}
                </strong>
              </div>
              <div className="operator-signals">
                <span className={activeMatch ? "signal-ready" : "signal-idle"}>
                  <i /> {activeMatch ? "PARTIDO LISTO" : "SIN PARTIDO"}
                </span>
                <span className={onAirLayers.length ? "signal-air" : "signal-idle"}>
                  <i /> {onAirLayers.length ? `${onAirLayers.length} CAPA${onAirLayers.length > 1 ? "S" : ""} EN AIRE` : "LIMPIO"}
                </span>
                <span className={apiOnline === false ? "signal-air" : apiOnline ? "signal-ready" : "signal-idle"}>
                  <i /> {apiOnline === null ? "VERIFICANDO API" : apiOnline ? "API CONECTADA" : "API SIN RESPUESTA"}
                </span>
                <span className={overlayOnline ? "signal-ready" : "signal-air"}>
                  <i /> {overlayOnline ? "OVERLAY ACTIVO" : "OVERLAY SIN SEÑAL"}
                </span>
              </div>
            </section>
            <section className="live-layout">
              <div className="deck">
                <h2>Control en vivo</h2>
                <div className="scene-row">
                  {[
                    ["inicio", "Inicio"],
                    ["juego", "Partido en juego"],
                    ["descanso", "Medio tiempo"],
                    ["segundo_tiempo", "Segundo tiempo"],
                    ["final", "Final del partido"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className="scene"
                      onClick={() => control("preset", { preset: key })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ClockControl
                  snapshot={snapshot}
                  control={control}
                  disabled={!activeMatch}
                />
                <ScoreControl
                  snapshot={snapshot}
                  control={control}
                  disabled={!activeMatch}
                />
                <StatsControl
                  snapshot={snapshot}
                  control={control}
                  disabled={!activeMatch}
                />
                <section className="cue-console" aria-label="Cola de gráficos">
                  <div className="cue-console-heading">
                    <div>
                      <span>VISTA PREVIA · SIGUIENTE GRAFICO</span>
                      <h3>{selectedCue ? selectedCue.label : "Cola vacía"}</h3>
                    </div>
                    <b>{cueList.length} EN COLA</b>
                  </div>
                  {cueList.length ? (
                    <div className="cue-list">
                      {cueList.map((cue, index) => (
                        <div
                          key={cue.id}
                          className={`cue-item ${selectedCue?.id === cue.id ? "cue-selected" : ""}`}
                        >
                          <button
                            className="cue-select"
                            onClick={() => setSelectedCueId(cue.id)}
                          >
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <strong>{cue.label}</strong>
                            {cue.duration ? <small>{cue.duration}s</small> : <small>MANUAL</small>}
                          </button>
                          <button
                            className="cue-remove"
                            aria-label={`Quitar ${cue.label} de la cola`}
                            onClick={() => removeCue(cue.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="cue-empty">
                      Elige una tarjeta de la biblioteca para prepararla antes de emitir.
                    </p>
                  )}
                  <div className="cue-actions">
                    <button
                      className="take-button"
                      disabled={!selectedCue || !activeMatch}
                      onClick={takeCue}
                    >
                      <span>TAKE</span>
                      <b>{selectedCue?.duration ? `${selectedCue.duration}s` : "AL AIRE"}</b>
                    </button>
                    <button
                      className="outline"
                      disabled={!cueList.length}
                      onClick={() => {
                        setCueList([]);
                        setSelectedCueId("");
                      }}
                    >
                      Vaciar cola
                    </button>
                  </div>
                </section>
                <section className="graphic-library" aria-label="Biblioteca de gráficos">
                  <div className="library-heading">
                    <div>
                      <span>BIBLIOTECA DE GRAFICOS</span>
                      <p>Elige una categoría, prepara el gráfico y envíalo con TAKE.</p>
                    </div>
                  </div>
                  <div className="library-tabs" role="tablist" aria-label="Categorías de gráficos">
                    {graphicGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        role="tab"
                        aria-selected={libraryGroup === group.id}
                        className={`library-tab ${libraryGroup === group.id ? "active" : ""}`}
                        onClick={() => setLibraryGroup(group.id)}
                      >
                        {group.label}
                        <small>{group.types.length}</small>
                      </button>
                    ))}
                  </div>
                  <p className="library-context">{activeGraphicGroup.hint}</p>
                  <div className="deck-grid graphics-grid">
                  {deck.filter(([type]) => activeGraphicGroup.types.includes(type)).map((item) => {
                    const [type, label, layer] = item;
                    const current =
                      layer === "main"
                        ? graphics.main
                        : layer === "lower"
                          ? graphics.lowerThird
                          : layer === "event"
                            ? graphics.temporary
                            : layer === "sponsors"
                              ? graphics.sponsorBugVisible
                                ? { type: "sponsors" }
                                : null
                              : graphics.scoreboardVisible
                                ? { type: "scoreboard" }
                                : null;
                    const active = current?.type === type;
                    return (
                      <button
                        key={type}
                        disabled={!activeMatch}
                        className={`deck-key ${active ? "on-air" : ""} ${selectedCue?.type === type ? "queued" : ""}`}
                        onClick={() => cueGraphic(item)}
                      >
                        <span>{active ? "● EN AIRE" : selectedCue?.type === type ? "EN COLA" : "PREPARAR"}</span>
                        {label}
                      </button>
                    );
                  })}
                  </div>
                </section>
                <section className="operator-actions" aria-label="Acciones de operación">
                  <div className="operator-actions-heading">
                    <span>OPERACIÓN Y SEGURIDAD</span>
                    <p>Controles de recuperación; no preparan un gráfico.</p>
                  </div>
                  <div className="deck-grid operator-actions-grid">
                  <button
                    className="deck-key danger-key"
                    disabled={!activeMatch}
                    onClick={() => control("hide_graphic")}
                  >
                    Ocultar gráfico actual
                  </button>
                  <button
                    className="deck-key"
                    disabled={!activeMatch}
                    onClick={() => control("clear_graphics")}
                  >
                    Limpiar gráficos
                    <span>CONSERVA MARCADOR</span>
                  </button>
                  <button
                    className="deck-key undo-key"
                    disabled={!activeMatch || !events.length}
                    onClick={undoLastAction}
                  >
                    Deshacer última acción
                    <span>Z · RESTAURA DATOS</span>
                  </button>
                  <button
                    className="deck-key danger-key"
                    disabled={!activeMatch}
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Ocultar todas las capas sin borrar datos?",
                        )
                      )
                        control("hide_all");
                    }}
                  >
                    OCULTAR TODO
                  </button>
                  <button
                    className="deck-key"
                    disabled={!activeMatch}
                    onClick={() => control("clock_start")}
                  >
                    Iniciar cronómetro
                  </button>
                  <button
                    className="deck-key"
                    disabled={!activeMatch}
                    onClick={() => control("clock_pause")}
                  >
                    Pausar cronómetro
                  </button>
                  </div>
                </section>
              </div>
              <div className="preview-panel">
                <h2>Vista previa · misma composición OBS</h2>
                <div className="cue-preview-header">
                  <span>PREVISUALIZACION · SIGUIENTE</span>
                  <b>{selectedCue ? selectedCue.label : "SELECCIONA UN GRAFICO"}</b>
                </div>
                <div className="preview-frame cue-preview-frame">
                  <div className="preview-scaler">
                    <OverlayComposition snapshot={cuePreviewSnapshot} preview />
                  </div>
                </div>
                <div className="program-preview-header">
                  <span>PROGRAMA · SALIDA OBS</span>
                  <b>{onAirLabel}</b>
                </div>
                <div className="preview-frame">
                  <div className="preview-scaler">
                    <OverlayComposition snapshot={snapshot} preview />
                  </div>
                </div>
                <div className="program-strip">
                  <span>EN AIRE</span>
                  <strong>{onAirLabel}</strong>
                  <b>
                    {lastTakenRemaining !== null
                      ? `00:${String(lastTakenRemaining).padStart(2, "0")}`
                      : onAirLayers.length
                        ? "ACTIVO"
                        : "LIMPIO"}
                  </b>
                </div>
                <div className="preview-tools">
                  <span>
                    EN AIRE:{" "}
                    <b>
                      {snapshot?.graphics?.main?.type ||
                        snapshot?.graphics?.temporary?.type ||
                        snapshot?.graphics?.lowerThird?.type ||
                        (snapshot?.graphics?.scoreboardVisible
                          ? "marcador"
                          : "sin gráfico")}
                    </b>
                  </span>
                  <button
                    className="outline preview-expand"
                    onClick={() => setPreviewOpen(true)}
                  >
                    Ampliar preview
                  </button>
                </div>
                <p>
                  {activeMatch
                    ? `${activeMatch.homeTeam?.name} vs ${activeMatch.awayTeam?.name}`
                    : "Sin partido activo"}{" "}
                  · Última sincronización: ahora
                </p>
              </div>
            </section>
            <section className="history">
              <div className="history-heading">
                <h2>Acciones recientes</h2>
                <button className="outline" disabled={!events.length} onClick={undoLastAction}>
                  Deshacer
                </button>
              </div>
              {events.slice(0, 7).map((event) => (
                <p key={event._id}>
                  <b>{event.type.replace(/_/g, " ")}</b>
                  <span>{event.minute ?? 0}'</span>
                </p>
                ))}
            </section>
            <section className="shortcut-guide">
              <div>
                <span>TECLADO / STREAM DECK</span>
                <p>Asigna estas teclas a botones de Stream Deck o usa el enlace remoto desde un teléfono.</p>
              </div>
              <div className="shortcut-list">
                {[["ESPACIO", "Reloj"], ["H / V", "Gol"], ["M", "Marcador"], ["T", "TAKE"], ["Z", "Deshacer"], ["ESC", "Ocultar"]].map(([key, label]) => <span key={key}><kbd>{key}</kbd>{label}</span>)}
              </div>
            </section>
          </>
        ) : tab === "sponsors" ? (
          <SponsorManager
            tournament={selected}
            sponsors={sponsors}
            onSaved={load}
            say={say}
          />
        ) : tab === "theme" ? (
          <ThemeManager key={selected._id} tournament={selected} onSaved={load} say={say} />
        ) : (
          <section className="setup-grid">
            <Config title="Nuevo torneo" onSubmit={createTournament}>
              <input name="name" placeholder="Nombre" required />
              <input name="season" placeholder="Temporada" />
              <input name="slug" placeholder="Slug" />
            </Config>
            <Config title="Equipos" onSubmit={(e) => create(e, "teams")}>
              <input name="name" placeholder="Nombre" required />
              <input name="shortName" placeholder="Nombre corto" required />
              <input name="code" placeholder="SIG" maxLength="3" required />
            </Config>
            <Records
              title="Equipos registrados"
              items={teams}
              text={(item) => `${item.name} · ${item.code}`}
            />
            <Config title="Jugadores" onSubmit={(e) => create(e, "players")}>
              <select name="team" required>
                <option value="">Equipo</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input name="name" placeholder="Nombre completo" required />
              <input name="sportsName" placeholder="Nombre deportivo" />
              <input name="number" type="number" placeholder="Número" />
              <input name="position" placeholder="Posición" />
            </Config>
            <Records
              title="Jugadores registrados"
              items={players}
              text={(item) =>
                `${item.sportsName || item.fullName} · #${item.number ?? "—"}`
              }
            />
            <Config title="Partido" onSubmit={(e) => create(e, "matches")}>
              <select name="home" required>
                <option value="">Local</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select name="away" required>
                <option value="">Visitante</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input name="stadium" placeholder="Estadio" />
              <input name="round" placeholder="Jornada / fase" />
            </Config>
            <Records
              title="Agenda"
              items={matches}
              text={(item) =>
                `${item.homeTeam?.shortName} vs ${item.awayTeam?.shortName}`
              }
              action={(item) => (
                <button className="link" onClick={() => activate(item._id)}>
                  {selected.activeMatch?._id === item._id
                    ? "Activo"
                    : "Activar"}
                </button>
              )}
            />
          </section>
        )}
      </section>
      {previewOpen && (
        <div className="preview-modal" onClick={() => setPreviewOpen(false)}>
          <section onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">PREVISUALIZACION DE OPERADOR</span>
                <h2>Salida 1920 × 1080</h2>
              </div>
              <button className="outline" onClick={() => setPreviewOpen(false)}>
                Cerrar
              </button>
            </header>
            <div className="preview-modal-frame">
              <div className="preview-modal-scaler">
                <OverlayComposition snapshot={snapshot} preview />
              </div>
            </div>
            <p>
              La misma composición de OBS, ampliada para verificar gráficos y
              posición.
            </p>
          </section>
        </div>
      )}
      {picker && (
        <EventPicker
          title={picker.label}
          teams={teams}
          players={players}
          onCancel={() => setPicker(null)}
          onSubmit={sendEvent}
          submitLabel={picker.queueItem ? "Agregar a cola" : "Poner al aire"}
        />
      )}
    </main>
  );
}

function Config({ title, children, onSubmit }) {
  return (
    <section className="resource">
      <h2>{title}</h2>
      <form onSubmit={onSubmit}>
        {children}
        <button>Guardar</button>
      </form>
    </section>
  );
}
function Records({ title, items, text, action }) {
  return (
    <section className="record-list">
      <h2>{title}</h2>
      {items.length ? (
        items.map((item) => (
          <article key={item._id}>
            <span>{text(item)}</span>
            {action?.(item)}
          </article>
        ))
      ) : (
        <p>Sin registros todavía.</p>
      )}
    </section>
  );
}

function ThemeManager({ tournament, onSaved, say }) {
  const defaults = {
    primary: "#0B2E59",
    secondary: "#FFFFFF",
    accent: "#F2B705",
    text: "#FFFFFF",
    background: "#071727",
  };
  const [colors, setColors] = useState({ ...defaults, ...(tournament.colors || {}) });
  const [logo, setLogo] = useState(tournament.logo || null);
  const [logoFile, setLogoFile] = useState(null);
  const presets = [
    ["Nocturno", { primary: "#0B2E59", secondary: "#FFFFFF", accent: "#F2B705", text: "#FFFFFF", background: "#071727" }],
    ["Cancha", { primary: "#123D2A", secondary: "#FFFFFF", accent: "#E7C14A", text: "#FFFFFF", background: "#081C14" }],
    ["Clásico", { primary: "#24164E", secondary: "#FFFFFF", accent: "#E93E52", text: "#FFFFFF", background: "#130D29" }],
  ];
  const uploadLogo = async () => {
    if (!logoFile) return logo;
    const form = new FormData();
    form.append("file", logoFile);
    form.append("folder", `torneos-${tournament.slug}`);
    const response = await fetch(`${API}/api/sports/upload`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudo subir el logo.");
    return data;
  };
  const save = async (event) => {
    event.preventDefault();
    try {
      const nextLogo = await uploadLogo();
      await api(`/tournaments/${tournament._id}`, {
        method: "PUT",
        body: JSON.stringify({ colors, logo: nextLogo }),
      });
      setLogo(nextLogo);
      setLogoFile(null);
      await onSaved();
      say("Tema y marca del torneo sincronizados con OBS.");
    } catch (error) {
      say(error.message);
    }
  };
  return (
    <section className="theme-manager">
      <div className="theme-intro">
        <span>IDENTIDAD DE TRANSMISIÓN</span>
        <h2>Marca y tema del torneo</h2>
        <p>Los colores y el logo se aplican a la fuente de OBS, a las pantallas y a todos los gráficos del torneo seleccionado.</p>
      </div>
      <div className="theme-presets" aria-label="Temas rápidos">
        {presets.map(([name, value]) => (
          <button key={name} className="outline" type="button" onClick={() => setColors(value)}>
            <i style={{ background: value.primary, borderColor: value.accent }} /> {name}
          </button>
        ))}
      </div>
      <form className="theme-grid" onSubmit={save}>
        <section className="theme-form resource">
          <h2>Paleta de emisión</h2>
          <div className="color-fields">
            {[
              ["primary", "Color principal"],
              ["secondary", "Color secundario"],
              ["accent", "Acento"],
              ["text", "Texto"],
              ["background", "Fondo de placas"],
            ].map(([field, label]) => (
              <label key={field}>
                {label}
                <span className="color-input">
                  <input
                    type="color"
                    value={colors[field]}
                    onChange={(event) => setColors({ ...colors, [field]: event.target.value })}
                  />
                  <b>{colors[field]}</b>
                </span>
              </label>
            ))}
          </div>
          <label className="file-field">
            Logo del torneo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
            />
          </label>
          <button>Guardar identidad</button>
        </section>
        <section className="theme-preview-card" style={{ "--preview-primary": colors.primary, "--preview-accent": colors.accent, "--preview-text": colors.text, "--preview-background": colors.background }}>
          <span>ZONA SEGURA · 16:9</span>
          <div className="theme-preview-scorebug">
            <b>{tournament.name}</b>
            <strong>LOCAL <em>0 - 0</em> VISITA</strong>
          </div>
          <div className="theme-preview-lower">
            {logo?.secureUrl ? <img src={logo.secureUrl} alt="Logo del torneo" /> : <i>{tournament.name.slice(0, 2).toUpperCase()}</i>}
            <div><span>TRANSMISIÓN OFICIAL</span><b>{tournament.name}</b></div>
          </div>
          <p>Previsualización de contraste y márgenes seguros para la fuente de navegador de OBS.</p>
        </section>
      </form>
    </section>
  );
}

function SponsorManager({ tournament, sponsors, onSaved, say }) {
  const [editing, setEditing] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      let logo = editing?.logo;
      const file = form.get("logo");
      if (file instanceof File && file.size) {
        const upload = new FormData();
        upload.append("file", file);
        upload.append("folder", `auspiciantes-${tournament.slug}`);
        const response = await fetch(`${API}/api/sports/upload`, {
          method: "POST",
          credentials: "include",
          body: upload,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.message || "No se pudo subir el logo.");
        logo = result;
      }
      const body = {
        tournament: tournament._id,
        name: form.get("name"),
        category: form.get("category"),
        headline: form.get("headline"),
        description: form.get("description"),
        location: form.get("location"),
        phone: form.get("phone"),
        url: form.get("url"),
        backgroundColor: form.get("backgroundColor"),
        textColor: form.get("textColor"),
        accentColor: form.get("accentColor"),
        durationSeconds: Number(form.get("durationSeconds")) || 10,
        order: Number(form.get("order")) || 0,
        active: form.get("active") === "on",
        logo,
      };
      await api(editing ? `/sponsors/${editing._id}` : "/sponsors", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setEditing(null);
      await onSaved();
      say("Auspiciante guardado y sincronizado con OBS.");
    } catch (error) {
      say(error.message);
    }
  };
  const remove = async (sponsor) => {
    if (!window.confirm(`Eliminar a ${sponsor.name}?`)) return;
    try {
      await api(`/sponsors/${sponsor._id}`, { method: "DELETE" });
      if (editing?._id === sponsor._id) setEditing(null);
      await onSaved();
      say("Auspiciante eliminado.");
    } catch (error) {
      say(error.message);
    }
  };
  return (
    <section className="sponsor-manager">
      <div className="sponsor-intro">
        <span>PAUTA COMERCIAL</span>
        <h2>Rotador de auspiciantes</h2>
        <p>
          Cada pieza se muestra en la misma fuente de OBS y cambia al siguiente
          auspiciante según sus segundos configurados.
        </p>
      </div>
      <div className="sponsor-admin-grid">
        <Config
          key={editing?._id || "new-sponsor"}
          title={editing ? `Editar: ${editing.name}` : "Nuevo auspiciante"}
          onSubmit={save}
        >
          <input
            name="name"
            placeholder="Nombre comercial"
            defaultValue={editing?.name}
            required
          />
          <input
            name="category"
            placeholder="Etiqueta (ej. Tienda oficial)"
            defaultValue={editing?.category}
          />
          <input
            name="headline"
            placeholder="Titular / propuesta de valor"
            defaultValue={editing?.headline}
          />
          <textarea
            name="description"
            placeholder="Mensaje comercial"
            defaultValue={editing?.description}
          />
          <input
            name="location"
            placeholder="Dirección / locales"
            defaultValue={editing?.location}
          />
          <input
            name="phone"
            placeholder="Teléfono o WhatsApp"
            defaultValue={editing?.phone}
          />
          <input
            name="url"
            placeholder="Web o red social"
            defaultValue={editing?.url}
          />
          <label className="file-field">
            Logo (PNG, JPG, WebP o SVG)
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
            />
          </label>
          {editing?.logo?.secureUrl && (
            <img
              className="sponsor-form-logo"
              src={editing.logo.secureUrl}
              alt="Logo actual"
            />
          )}
          <div className="sponsor-options">
            <label>
              Fondo
              <input
                name="backgroundColor"
                type="color"
                defaultValue={editing?.backgroundColor || "#101720"}
              />
            </label>
            <label>
              Texto
              <input
                name="textColor"
                type="color"
                defaultValue={editing?.textColor || "#ffffff"}
              />
            </label>
            <label>
              Acento
              <input
                name="accentColor"
                type="color"
                defaultValue={editing?.accentColor || "#e0b84d"}
              />
            </label>
          </div>
          <div className="sponsor-options sponsor-numbers">
            <label>
              Duración (seg)
              <input
                name="durationSeconds"
                type="number"
                min="3"
                max="120"
                defaultValue={editing?.durationSeconds || 10}
                required
              />
            </label>
            <label>
              Orden
              <input
                name="order"
                type="number"
                min="0"
                defaultValue={editing?.order || 0}
              />
            </label>
            <label className="check-field">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />{" "}
              Activo en rotación
            </label>
          </div>
          <div className="modal-actions">
            {editing && (
              <button
                type="button"
                className="outline"
                onClick={() => setEditing(null)}
              >
                Cancelar edición
              </button>
            )}
            <button>
              {editing ? "Guardar cambios" : "Agregar a rotación"}
            </button>
          </div>
        </Config>
        <section className="sponsor-list">
          <h2>Rotación actual</h2>
          <p className="sponsor-list-hint">
            El orden menor aparece primero. Solo los activos llegan a OBS.
          </p>
          {sponsors.length ? (
            sponsors.map((sponsor) => (
              <article
                key={sponsor._id}
                style={{ "--card-accent": sponsor.accentColor || "#e0b84d" }}
              >
                <div className="sponsor-list-logo">
                  {sponsor.logo?.secureUrl ? (
                    <img src={sponsor.logo.secureUrl} alt="" />
                  ) : (
                    <b>{sponsor.name.slice(0, 2).toUpperCase()}</b>
                  )}
                </div>
                <div>
                  <strong>{sponsor.name}</strong>
                  <span>
                    {sponsor.active
                      ? `${sponsor.durationSeconds || 10}s · orden ${sponsor.order || 0}`
                      : "Inactivo"}
                  </span>
                </div>
                <div className="sponsor-row-actions">
                  <button className="link" onClick={() => setEditing(sponsor)}>
                    Editar
                  </button>
                  <button
                    className="link danger-link"
                    onClick={() => remove(sponsor)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-sponsors">
              Aún no hay auspiciantes. Crea el primero para empezar la rotación.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function EventPicker({ title, teams, players, onCancel, onSubmit, submitLabel }) {
  const [team, setTeam] = useState(teams[0]?._id || "");
  const [player, setPlayer] = useState("");
  const teamPlayers = players.filter(
    (p) => p.team === team || p.team?._id === team,
  );
  const submit = (e) => {
    e.preventDefault();
    const selected = players.find((p) => p._id === player);
    onSubmit({
      team,
      player: player || undefined,
      playerName: selected?.sportsName || selected?.fullName || "",
      name: selected?.sportsName || selected?.fullName || "",
    });
  };
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <h2>{title}</h2>
        <p>
          Selecciona el equipo y, si ya está registrado, el jugador. El nombre
          nunca se escribe durante la transmisión.
        </p>
        <select
          value={team}
          onChange={(e) => {
            setTeam(e.target.value);
            setPlayer("");
          }}
          required
        >
          {teams.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={player} onChange={(e) => setPlayer(e.target.value)}>
          <option value="">Sin jugador / mostrar equipo</option>
          {teamPlayers.map((p) => (
            <option key={p._id} value={p._id}>
              #{p.number || "—"} · {p.sportsName || p.fullName}
            </option>
          ))}
        </select>
        <div className="modal-actions">
          <button type="button" className="outline" onClick={onCancel}>
            Cancelar
          </button>
          <button>{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const overlay = window.location.pathname.startsWith("/overlay/torneo/");
  const remote = window.location.pathname.startsWith("/control-remoto/");
  const [admin, setAdmin] = useState(undefined);
  useEffect(() => {
    if (!overlay && !remote)
      api("/auth/me")
        .then((data) => setAdmin(data.admin))
        .catch(() => setAdmin(null));
  }, [overlay, remote]);
  if (overlay) return <Overlay />;
  if (remote) return <RemoteControl />;
  if (admin === undefined) return <div className="loading">Cargando…</div>;
  return admin ? (
    <Dashboard admin={admin} setAdmin={setAdmin} />
  ) : (
    <Login setAdmin={setAdmin} />
  );
}
