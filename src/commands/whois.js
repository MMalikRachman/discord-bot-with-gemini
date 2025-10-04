import {
  SlashCommandBuilder,
  EmbedBuilder,
  time,
  userMention,
} from 'discord.js';
import { getContact } from '../db/contact-json.js';

export const data = new SlashCommandBuilder()
  .setName('whois')
  .setDescription('Show public info of a tagged user')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('User to inspect')
      .setRequired(true)
  )
  .setDMPermission(false);

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  await interaction.deferReply();

  const guild = interaction.guild;

  // Fetch lengkap (biar dapat banner)
  const fullUser = await target.fetch().catch(() => target);
  const member = guild ? await guild.members.fetch(target.id).catch(() => null) : null;

  // User-level info
  const userId        = target.id;
  const username      = target.username;               // handle global
  const globalName    = target.globalName || '—';      // display name
  const created       = new Date(target.createdTimestamp);
  const avatarURL     = target.displayAvatarURL({ extension: 'png', size: 256 });
  const bannerURL     = fullUser.banner ? fullUser.bannerURL({ extension: 'png', size: 1024 }) : null;

  // Guild-level info (jika dia member server ini)
  const nick        = member?.nickname ?? '—';
  const joined      = member?.joinedAt ? new Date(member.joinedAt) : null;
  const highestRole = member?.roles?.highest?.name ?? '—';

  // List roles (batasi agar tidak melebihi 1024 chars)
  let rolesText = '—';
  if (member) {
    const roles = member.roles.cache
      .filter(r => r.id !== guild.id) // exclude @everyone
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString());

    if (roles.length) {
      const joinedRoles = roles.join(', ');
      rolesText = joinedRoles.length > 1000
        ? roles.slice(0, 20).join(', ') + `, +${roles.length - 20} more`
        : joinedRoles;
    }
  }

  const contact = await getContact(userId);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `WHOIS • ${username}`, iconURL: avatarURL })
    .setThumbnail(avatarURL)
    .setDescription(`${userMention(userId)} • \`${userId}\``)
    .addFields(
      {
        name: 'User',
        value:
          `Username: **${username}**\n` +
          `Global Name: **${globalName}**\n` +
            `Phone: **${contact?.phone ?? '—'}**\n` +
          `Address: **${contact?.address ?? '—'}**\n` +
          `Real Name: **${contact?.realname ?? '—'}**\n` +
          `Created: ${time(created, 'F')} (${time(created, 'R')})`,
        inline: false
      },
      {
        name: 'Server',
        value: member
          ? (
            `Nickname: **${nick}**\n` +
            `Joined: ${joined ? `${time(joined, 'F')} (${time(joined, 'R')})` : '—'}\n` +
            `Highest Role: **${highestRole}**\n` +
            `Roles: ${rolesText}`
          )
          : '_User is not a member of this server._',
        inline: false
      }
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp();

  if (bannerURL) embed.setImage(bannerURL);

  await interaction.editReply({ embeds: [embed] });
}
