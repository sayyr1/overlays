import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import SportsTeam from '../models/SportsTeam.js';
import SportsPlayer from '../models/SportsPlayer.js';
import SportsMatch from '../models/SportsMatch.js';
import Sponsor from '../models/Sponsor.js';
import OverlayState from '../models/OverlayState.js';
import { hashOverlayToken, issueOverlayToken } from '../services/overlayStateService.js';

dotenv.config(); const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error('Configura MONGODB_URI antes de sembrar datos.');
await mongoose.connect(uri);
const slug = 'copa-imbabura-demo'; let tournament = await Tournament.findOne({ slug }); let token;
if (!tournament) { token = issueOverlayToken(); tournament = await Tournament.create({ name: 'Copa Imbabura Demo', slug, season: '2026', overlayTokenHash: hashOverlayToken(token), overlayTokenPrefix: token.slice(0, 8) }); await OverlayState.create({ tournament: tournament._id }); }
const teamsData = [['Imbabura Norte', 'IMN', '#1261A0'], ['Otavalo Unido', 'OTA', '#B5232D'], ['Valle del Chota', 'VCH', '#136A47'], ['Lagos FC', 'LAG', '#6B438C']]; const teams = [];
for (const [name, code, primaryColor] of teamsData) { teams.push(await SportsTeam.findOneAndUpdate({ tournament: tournament._id, code }, { $setOnInsert: { tournament: tournament._id, name, shortName: name, code, primaryColor, secondaryColor: '#FFFFFF', city: 'Imbabura' } }, { upsert: true, new: true })); }
for (const team of teams) for (let number = 1; number <= 4; number += 1) await SportsPlayer.findOneAndUpdate({ team: team._id, number }, { $setOnInsert: { team: team._id, fullName: `Jugador ${number} ${team.code}`, sportsName: `${team.code} ${number}`, number, position: number === 1 ? 'Portero' : 'Mediocampista', starter: true, goalkeeper: number === 1 } }, { upsert: true, new: true });
const first = await SportsMatch.findOneAndUpdate({ tournament: tournament._id, homeTeam: teams[0]._id, awayTeam: teams[1]._id }, { $setOnInsert: { tournament: tournament._id, homeTeam: teams[0]._id, awayTeam: teams[1]._id, stadium: 'Estadio Olímpico de Ibarra', round: 'Jornada 1', scheduledAt: new Date() } }, { upsert: true, new: true });
await SportsMatch.findOneAndUpdate({ tournament: tournament._id, homeTeam: teams[2]._id, awayTeam: teams[3]._id }, { $setOnInsert: { tournament: tournament._id, homeTeam: teams[2]._id, awayTeam: teams[3]._id, stadium: 'Estadio Municipal', round: 'Jornada 1' } }, { upsert: true, new: true });
await Tournament.updateOne({ _id: tournament._id }, { activeMatch: first._id });
await Sponsor.findOneAndUpdate({ tournament: tournament._id, name: 'Patrocinador ficticio' }, { $setOnInsert: { tournament: tournament._id, name: 'Patrocinador ficticio', category: 'Principal', primary: true } }, { upsert: true, new: true });
console.log(`Datos ficticios creados. ${token ? `URL: ${process.env.APP_BASE_URL || 'http://localhost:3000'}/overlay/torneo/${slug}?token=${token}` : 'El torneo demo ya existía; regenera su token desde el panel.'}`);
await mongoose.disconnect();
