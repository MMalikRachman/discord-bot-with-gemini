import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { searchTitle, getById } from '../api/omdb.js';
import { addMovie } from '../db/watchlist-movie-json.js';

// custom-id helpers
const btnPick = (userId, imdbID) => `wl_pick:${userId}:${imdbID}`;
const btnManual = (userId, q, type, year) =>
  `wl_manual:${userId}:${encodeURIComponent(q)}:${type || ''}:${year || ''}`;
export const MODAL_ID = 'wl_manual_modal';

export const data = new SlashCommandBuilder()
  .setName('addwatchlist')
  .setDescription('Search OMDb and add a movie/series to your watchlist')
  .addStringOption(o =>
    o.setName('query').setDescription('Movie/series title').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('type').setDescription('Type').addChoices(
      { name: 'movie', value: 'movie' },
      { name: 'series', value: 'series' },
      { name: 'episode', value: 'episode' },
    )
  )
  .addIntegerOption(o =>
    o.setName('year').setDescription('Year (e.g., 2023)')
  )
  .setDMPermission(false);

export async function execute(interaction) {
  const userId = interaction.user.id;
  const q = interaction.options.getString('query', true);
  const type = interaction.options.getString('type') || undefined;
  const year = interaction.options.getInteger('year') || undefined;

  await interaction.deferReply({ ephemeral: true });

  try {
    const results = await searchTitle(q, { type, year });
    if (results.length === 0) {
      // offer manual add straight away
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(btnManual(userId, q, type, year))
          .setLabel('Manual add')
          .setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        content: `📭 No results for “**${q}**”. Add manually?`,
        components: [row],
      });
    }

    // show top 3 with buttons
    const lines = results.map((r, i) =>
      `**${i + 1}. ${r.Title}** (${r.Year}) • ${r.Type} • [IMDb](https://www.imdb.com/title/${r.imdbID}/)`
    );

    const embed = new EmbedBuilder()
      .setColor(0x0aa2d4)
      .setTitle(`Results for “${q}”`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Pick 1/2/3 or Manual (4).' });

    const row = new ActionRowBuilder();
    results.forEach((r, i) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(btnPick(userId, r.imdbID))
          .setLabel(String(i + 1))
          .setStyle(ButtonStyle.Primary)
      );
    });
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(btnManual(userId, q, type, year))
        .setLabel('4 • Manual')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (e) {
    console.error('[addwatchlist search]', e);
    await interaction.editReply(`❌ OMDb search failed: ${e.message || 'Unknown error'}`);
  }
}

// Handle button clicks & modal submit in index.js (see below)
export async function handlePickButton(interaction) {
  // customId: wl_pick:<userId>:<imdbID>
  const [_, ownerId, imdbID] = interaction.customId.split(':');
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'This selection isn’t for you.', ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });

  try {
    const d = await getById(imdbID);
    const title = d.Title;
    const year = d.Year ? parseInt(d.Year, 10) : undefined;
    // optional: link to IMDb
    const link = `https://www.imdb.com/title/${imdbID}/`;
    const watchLink = `https://1flix.to/search/${title.replace(/\s+/g, '-').toLowerCase()}`;

    const id = await addMovie(interaction.user.id, {
      title,
      year,
      platform: d.Type,   // movie/series/episode
      link,
      watchLink,
      note: '',           // blank; you can add separate /note command later
    });

    await interaction.editReply(`✅ Added **${title}** (${year ?? '—'}) [ID \`${id}\`]`);
  } catch (e) {
    console.error('[addwatchlist pick]', e);
    await interaction.editReply(`❌ Failed to add: ${e.message || 'Unknown error'}`);
  }
}

export async function handleManualButton(interaction) {
  // customId: wl_manual:<userId>:<query>:<type>:<year>
  const [_, ownerId, encQ, type, year] = interaction.customId.split(':');
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'This form isn’t for you.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('Add to Watchlist (Manual)');

  const titleIn = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Title')
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(120)
    .setRequired(true);

  const yearIn = new TextInputBuilder()
    .setCustomId('year')
    .setLabel('Year (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const r1 = new ActionRowBuilder().addComponents(titleIn);
  const r2 = new ActionRowBuilder().addComponents(yearIn);
  modal.addComponents(r1, r2);

  // store context on the interaction for later (Discord doesn’t persist state between modal steps),
  // so we put it into the modal custom id? Too long. Instead, we’ll stash minimal context in fields:
  // We can put defaults in the inputs (prefill with previous query)
  titleIn.setValue(decodeURIComponent(encQ));
  year && yearIn.setValue(year);

  await interaction.showModal(modal);
}

export async function handleManualSubmit(interaction) {
  const title = interaction.fields.getTextInputValue('title');
  const yearRaw = interaction.fields.getTextInputValue('year');
  const year = yearRaw ? parseInt(yearRaw, 10) : undefined;

  await interaction.deferReply({ ephemeral: true });

  try {
    const id = await addMovie(interaction.user.id, {
      title,
      year,
      platform: null,
      link: null,
      note: '',
    });
    await interaction.editReply(`✅ Added **${title}** (${year ?? '—'}) [ID \`${id}\`]`);
  } catch (e) {
    console.error('[addwatchlist manual]', e);
    await interaction.editReply(`❌ Failed to add: ${e.message || 'Unknown error'}`);
  }
}
