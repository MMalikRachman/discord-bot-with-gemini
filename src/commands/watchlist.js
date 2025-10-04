import { SlashCommandBuilder, userMention, EmbedBuilder } from 'discord.js';
import { listMovies } from '../db/watchlist-movie-json.js';

export const data = new SlashCommandBuilder()
  .setName('watchlist')
  .setDescription('Show movie/series watchlist')
  .addUserOption(o => o.setName('user').setDescription('See another user watchlist'))
  .addStringOption(o => o.setName('status').setDescription('Filter by status')
    .addChoices({ name: 'open', value: 'open' }, { name: 'done', value: 'done' }))
  .setDMPermission(false);

function short(x, n = 64) { return x && x.length > n ? x.slice(0, n - 1) + '…' : (x || ''); }

export async function execute(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const status = interaction.options.getString('status') || undefined;

  await interaction.deferReply();

  const rows = await listMovies(target.id, { status });
  if (!rows.length) {
    return interaction.editReply(`📭 Watchlist kosong untuk ${userMention(target.id)}${status ? ` (status: ${status})` : ''}.`);
  }

  const lines = rows.slice(0, 10).map(x => {
    const tag = x.status === 'done' ? '✅' : '🟢';
    const yr  = x.year ? ` (${x.year})` : '';
    const pf  = x.platform ? ` • ${x.platform}` : '';
    const note = x.note ? ` — ${short(x.note, 50)}` : '';
    const link = x.link ? ` — [IMDB](<${x.link}>)` : '';
    const watchLink = x.watchLink ? ` — [Watch](<${x.watchLink}>)` : '';
    return `\`${x.id}\` ${tag} **${x.title}**${yr}${pf}${note}${link}${watchLink}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x00A67E)
    .setTitle(`Watchlist • ${target.username}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: rows.length > 10 ? `Showing 10 of ${rows.length}` : `Total: ${rows.length}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
