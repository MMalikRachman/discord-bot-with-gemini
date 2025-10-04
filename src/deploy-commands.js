import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import * as ping from './commands/ping.js';
import * as echo from './commands/echo.js';
import * as ask from './commands/ask.js';     // kalau kamu pakai
import * as whois from './commands/whois.js';
import * as watchlist from './commands/watchlist.js';
import * as completedwatchlist from './commands/completedwatchlist.js';
import * as addwatchlist from './commands/addwatchlist.js';
import * as addreminder from './commands/addreminder.js';

['DISCORD_TOKEN','CLIENT_ID'].forEach(k=>{
  if (!process.env[k]) throw new Error(`Missing ${k} in .env`);
});

const commands = [ping.data, echo.data, whois.data,ask.data, watchlist.data, completedwatchlist.data, addwatchlist.data, addreminder.data].map(c => c.toJSON());
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

console.log('⏫ Deploying GLOBAL slash commands...');
await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
console.log('✅ Global commands deployed.');

