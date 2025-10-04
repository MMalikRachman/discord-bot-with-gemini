import { SlashCommandBuilder } from 'discord.js';
import { completeMovie } from '../db/watchlist-movie-json.js';

export const data = new SlashCommandBuilder()
  .setName('completedwatchlist')
  .setDescription('Mark one of YOUR watchlist items as completed')
  .addIntegerOption(o => o.setName('id').setDescription('Item ID (see /watchlist)').setRequired(true))
  .setDMPermission(false);

export async function execute(interaction) {
  const id = interaction.options.getInteger('id', true);
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const ok = await completeMovie(userId, id);
  await interaction.editReply(ok ? `✅ Item \`${id}\` marked as done.` : `❌ Item \`${id}\` tidak ditemukan.`);
}
