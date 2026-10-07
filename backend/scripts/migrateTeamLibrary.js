import 'dotenv/config';
import mongoose from 'mongoose';
import SportsTeam from '../models/SportsTeam.js';
// Removes the legacy uniqueness restriction on event + code. No records are changed.
// Different clubs may share an abbreviation; their IDs remain their identity.
try {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const indexes = await SportsTeam.collection.indexes();
  const legacy = indexes.find(index => index.unique && index.key.tournament === 1 && index.key.code === 1 && Object.keys(index.key).length === 2);
  await SportsTeam.collection.createIndex({ tournament: 1, code: 1 }, { name: 'team_event_code' });
  await SportsTeam.collection.createIndex({ tournaments: 1 });
  if (legacy) await SportsTeam.collection.dropIndex(legacy.name);
  console.log('Team library indexes ready. Existing teams, players and matches preserved.');
} finally { await mongoose.disconnect(); }
