import { SlashCommandBuilder, ChannelType, userMention, channelMention, ActionRowBuilder, ButtonBuilder, ButtonStyle, time, TimestampStyles } from 'discord.js';
import 'dotenv/config';
import { createReminderToken, addReminder } from '../db/reminders-json.js';

export const CONFIRM_PREFIX = 'rem:confirm:';
export const CANCEL_PREFIX  = 'rem:cancel:';

export const data = new SlashCommandBuilder()
  .setName('addreminder')
  .setDescription('Set a reminder to a channel or DM a user')
  .addStringOption(o => o.setName('target').setDescription('#channel atau @user').setRequired(true))
  .addStringOption(o => o.setName('date').setDescription('Tanggal (YYYY-MM-DD)').setRequired(true))
  .addStringOption(o => o.setName('time').setDescription('Jam (HH:mm, 24h)').setRequired(true))
  .addStringOption(o => o.setName('message').setDescription('Isi reminder').setRequired(true))
  .setDMPermission(false);

function parseTarget(interaction, raw) {
  const mUser = raw.match(/^<@!?(\d{17,20})>$/);
  if (mUser) return { type: 'user', id: mUser[1] };
  const mChan = raw.match(/^<#(\d{17,20})>$/);
  if (mChan) return { type: 'channel', id: mChan[1] };
  return null;
}

// Force timezone to WIB (UTC+7): offset minutes from UTC
const TZ_OFFSET_MIN = 420; // UTC+7

function buildIso(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  // If user means 21:00 at UTC+X, the UTC time is 21:00 - X hours
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - (TZ_OFFSET_MIN * 60 * 1000);
  return new Date(utcMs).toISOString();
}

function isTomorrow(iso) {
  // Compare in the configured timezone by shifting both datetimes by TZ offset
  const now = new Date();
  const tgt = new Date(iso);
  const shift = TZ_OFFSET_MIN * 60 * 1000;
  const localNow = new Date(+now + shift);
  const localTgt = new Date(+tgt + shift);
  localNow.setHours(0,0,0,0);
  localTgt.setHours(0,0,0,0);
  const diffDays = Math.floor((+localTgt - +localNow) / (24*60*60*1000));
  return diffDays === 1;
}

function formatWIB(iso) {
  const dt = new Date(iso);
  try {
    return dt.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' WIB';
  } catch {
    const local = new Date(+dt + TZ_OFFSET_MIN * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())} WIB`;
  }
}

function wibDateYYYYMMDDFromISO(iso) {
  const dt = new Date(iso);
  const shifted = new Date(+dt + TZ_OFFSET_MIN * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayWIBYYYYMMDD() {
  const now = new Date();
  const shifted = new Date(+now + TZ_OFFSET_MIN * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function tomorrowWIBYYYYMMDD() {
  const now = new Date();
  const shifted = new Date(+now + TZ_OFFSET_MIN * 60 * 1000);
  shifted.setDate(shifted.getDate() + 1);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function execute(interaction) {
  const rawTarget = interaction.options.getString('target', true);
  const dateStr   = interaction.options.getString('date', true);
  const timeStr   = interaction.options.getString('time', true);
  const message   = interaction.options.getString('message', true);

  await interaction.deferReply({ ephemeral: true });

  const target = parseTarget(interaction, rawTarget);
  if (!target) {
    return interaction.editReply('❌ Target harus berupa mention channel `<#id>` atau user `<@id>`.');
  }

  const iso = buildIso(dateStr, timeStr);
  if (!iso || Number.isNaN(Date.parse(iso))) {
    return interaction.editReply('❌ Format tanggal/jam tidak valid. Gunakan `YYYY-MM-DD` dan `HH:mm` (24 jam).');
  }
  if (Date.parse(iso) <= Date.now()) {
    return interaction.editReply('❌ Waktu reminder harus di masa depan.');
  }

  const payload = {
    createdBy: interaction.user.id,
    guildId: interaction.guildId,
    targetType: target.type,
    targetId: target.id,
    message,
    remindAt: iso,
    dateStr,
    timeStr,
  };
  const token = await createReminderToken(payload);

  const whenText = dateStr === todayWIBYYYYMMDD()
    ? `Hari ini, ${formatWIB(iso)}`
    : (dateStr === tomorrowWIBYYYYMMDD() ? `besok, ${formatWIB(iso)}` : formatWIB(iso));
  const targetText = target.type === 'channel' ? channelMention(target.id) : userMention(target.id);
  const confirm = new ButtonBuilder().setCustomId(CONFIRM_PREFIX + token).setLabel('Confirm').setStyle(ButtonStyle.Success);
  const cancel  = new ButtonBuilder().setCustomId(CANCEL_PREFIX + token).setLabel('Cancel').setStyle(ButtonStyle.Secondary);

  await interaction.editReply({
    content: `Konfirmasi reminder:
Target: ${targetText}
Waktu: ${whenText}
Pesan: ${message}`,
    components: [new ActionRowBuilder().addComponents(confirm, cancel)],
    allowedMentions: {
      parse: [],
      users: Array.from(new Set([interaction.user.id, target.type === 'user' ? target.id : undefined].filter(Boolean)))
    }
  });
}

export async function handleConfirm(interaction, token) {
  const payload = await import('../db/reminders-json.js').then(m => m.consumeReminderToken(token));
  if (!payload) return interaction.reply({ content: '❌ Token invalid/expired.', ephemeral: true });

  const id = await addReminder(payload);
  const when = new Date(payload.remindAt);
  const dStr = payload.dateStr || wibDateYYYYMMDDFromISO(payload.remindAt);
  const whenText = dStr === todayWIBYYYYMMDD()
    ? `hari ini, ${formatWIB(payload.remindAt)}`
    : (dStr === tomorrowWIBYYYYMMDD() ? `Besok, ${formatWIB(payload.remindAt)}` : formatWIB(payload.remindAt));
  const targetText = payload.targetType === 'channel' ? channelMention(payload.targetId) : userMention(payload.targetId);

  await interaction.reply({
    content: `✅ Reminder tersimpan (#${id}). Aku akan mengingatkan "${payload.message}" pada ${whenText} di ${targetText}.`,
    ephemeral: false,
    allowedMentions: {
      parse: [],
      users: Array.from(new Set([payload.createdBy, payload.targetType === 'user' ? payload.targetId : undefined].filter(Boolean)))
    }
  });
}

export async function handleCancel(interaction, token) {
  // just consume token so it can't be used later
  await import('../db/reminders-json.js').then(m => m.consumeReminderToken(token));
  await interaction.reply({ content: '❎ Dibatalkan.', ephemeral: true });
}


