import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import * as ping from './commands/ping.js';
import * as echo from './commands/echo.js';
import * as ask from './commands/ask.js';
import * as whois from './commands/whois.js';
import * as addwatchlist from './commands/addwatchlist.js';
import * as watchlist from './commands/watchlist.js';
import * as completedwatchlist from './commands/completedwatchlist.js';
import * as addreminder from './commands/addreminder.js';
import { listDue, markSent, markFailed, cleanupExpiredTokens } from './db/reminders-json.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // perlu untuk joinedAt & roles
  ],
});

// simple in-memory command registry
const cmds = [ping, echo, whois, ask, watchlist, completedwatchlist, addwatchlist, addreminder];
client.commands = new Collection();
for (const c of cmds) client.commands.set(c.data.name, c);

client.once(Events.ClientReady, (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const id = interaction.customId || '';
      if (id.startsWith('wl_pick:')) {
        return addwatchlist.handlePickButton(interaction);
      }
      if (id.startsWith('wl_manual:')) {
        return addwatchlist.handleManualButton(interaction);
      }
      if (id.startsWith(addreminder.CONFIRM_PREFIX)) {
        return addreminder.handleConfirm(interaction, id.slice(addreminder.CONFIRM_PREFIX.length));
      }
      if (id.startsWith(addreminder.CANCEL_PREFIX)) {
        return addreminder.handleCancel(interaction, id.slice(addreminder.CANCEL_PREFIX.length));
      }
    }

    // Modal submit
    if (interaction.isModalSubmit()) {
      if (interaction.customId === addwatchlist.MODAL_ID) {
        return addwatchlist.handleManualSubmit(interaction);
      }
    }
  } catch (err) {
    console.error('[Interaction error]', err);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ content: 'There was an error.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Simple in-process scheduler (checks every 15 seconds)
const TICK_MS = 15_000;
async function schedulerTick() {
  try {
    await cleanupExpiredTokens().catch(() => {});
    const due = await listDue(new Date());
    for (const r of due) {
      try {
        if (r.targetType === 'channel') {
          const channel = await client.channels.fetch(r.targetId);
          await channel.send({ content: r.message });
        } else if (r.targetType === 'user') {
          const user = await client.users.fetch(r.targetId);
          await user.send({ content: r.message });
        }
        await markSent(r.id);
      } catch (err) {
        console.error('[Reminder send error]', err);
        await markFailed(r.id, err?.message || String(err));
      }
    }
  } catch (err) {
    console.error('[Scheduler error]', err);
  } finally {
    setTimeout(schedulerTick, TICK_MS);
  }
}

client.once(Events.ClientReady, () => {
  setTimeout(schedulerTick, TICK_MS);
});
