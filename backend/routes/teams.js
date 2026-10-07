import express from 'express';
import SportsTeam from '../models/SportsTeam.js';
import SportsPlayer from '../models/SportsPlayer.js';
import SportsMatch from '../models/SportsMatch.js';
import Tournament from '../models/Tournament.js';
import { requireSportsAdmin } from '../middleware/sportsAuth.js';
import { teamFilter, teamIdentity } from '../services/teamLibrary.js';
import { updateOverlayState } from '../services/overlayStateService.js';
const router = express.Router();
const id = value => /^[a-f\d]{24}$/i.test(String(value || ''));
const route = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.get('/teams', requireSportsAdmin, route(async (req, res) => {
  if (req.query.tournament && !id(req.query.tournament)) return res.status(400).json({ message: 'Evento no válido.' });
  res.json(await SportsTeam.find(req.query.tournament ? teamFilter(req.query.tournament) : {}).sort({ name: 1 }));
}));
const save = async (req, res) => {
  if (req.params.id && !id(req.params.id)) return res.status(400).json({ message: 'Equipo no válido.' });
  if (req.body.tournament || req.body.tournaments) return res.status(400).json({ message: 'Asigna los equipos desde la configuración del evento.' });
  const team = req.params.id ? await SportsTeam.findById(req.params.id) : new SportsTeam();
  if (!team) return res.status(404).json({ message: 'Equipo no encontrado.' });
  Object.assign(team, teamIdentity({ ...team.toObject(), ...req.body }));
  for (const key of ['crest', 'city', 'coach', 'primaryColor', 'secondaryColor', 'active']) if (req.body[key] !== undefined) team[key] = req.body[key];
  if (!/^[A-Z0-9]{3}$/.test(team.code) || ![team.primaryColor, team.secondaryColor].every(color => /^#[a-f\d]{6}$/i.test(color))) return res.status(400).json({ message: 'Usa tres letras o números para la sigla y colores válidos.' });
  if (team.crest?.secureUrl && !/^https:\/\/res\.cloudinary\.com\//.test(team.crest.secureUrl)) return res.status(400).json({ message: 'Sube el logo desde la biblioteca de equipos.' });
  await team.save();
  for (const event of new Set([team.tournament, ...team.tournaments].filter(Boolean).map(String))) if (await Tournament.exists({ _id: event })) await updateOverlayState(event, {}, req.sportsAdmin._id);
  res.status(req.params.id ? 200 : 201).json(team);
};
router.post('/teams', requireSportsAdmin, route(save));
router.put('/teams/:id', requireSportsAdmin, route(save));
router.delete('/teams/:id', requireSportsAdmin, route(async (req, res) => {
  if (!id(req.params.id)) return res.status(400).json({ message: 'Equipo no válido.' });
  const team = await SportsTeam.findById(req.params.id);
  if (!team) return res.status(404).json({ message: 'Equipo no encontrado.' });
  if (team.tournament || team.tournaments.length || await SportsMatch.exists({ $or: [{ homeTeam: team._id }, { awayTeam: team._id }] }) || await SportsPlayer.exists({ team: team._id })) return res.status(409).json({ message: 'Este equipo tiene eventos, jugadores o partidos. Consérvalo en la biblioteca.' });
  await team.deleteOne(); res.status(204).end();
}));
router.post('/tournaments/:id/teams', requireSportsAdmin, route(async (req, res) => {
  const ids = req.body?.teamIds;
  if (!id(req.params.id) || !Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(value => !id(value))) return res.status(400).json({ message: 'Selecciona entre 1 y 100 equipos válidos.' });
  if (!await Tournament.exists({ _id: req.params.id })) return res.status(404).json({ message: 'Evento no encontrado.' });
  const unique = [...new Set(ids)];
  if (await SportsTeam.countDocuments({ _id: { $in: unique }, active: true }) !== unique.length) return res.status(400).json({ message: 'Uno de los equipos no está disponible.' });
  await SportsTeam.updateMany({ _id: { $in: unique } }, { $addToSet: { tournaments: req.params.id } });
  res.json(await SportsTeam.find(teamFilter(req.params.id)).sort({ name: 1 }));
}));
router.delete('/tournaments/:id/teams/:teamId', requireSportsAdmin, route(async (req, res) => {
  if (!id(req.params.id) || !id(req.params.teamId)) return res.status(400).json({ message: 'Equipo o evento no válido.' });
  if (await SportsMatch.exists({ tournament: req.params.id, $or: [{ homeTeam: req.params.teamId }, { awayTeam: req.params.teamId }] })) return res.status(409).json({ message: 'No puedes retirar un equipo con partidos registrados en este evento.' });
  await SportsTeam.updateOne({ _id: req.params.teamId }, { $pull: { tournaments: req.params.id } });
  await SportsTeam.updateOne({ _id: req.params.teamId, tournament: req.params.id }, { $unset: { tournament: 1 } });
  res.status(204).end();
}));
export default router;
