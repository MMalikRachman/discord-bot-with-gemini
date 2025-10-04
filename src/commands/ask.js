import { SlashCommandBuilder } from 'discord.js';
import { askGemini } from '../ai/gemini.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Tanya Gemini; optionally pakai web grounding')
  .addStringOption(o => o.setName('prompt').setDescription('Pertanyaanmu').setRequired(true))
  .addStringOption(o => o.setName('system').setDescription('Instruksi sistem (opsional)'))
  .addBooleanOption(o => o.setName('web').setDescription('Gunakan Google Search grounding'))
  .addUserOption(o => o.setName('user').setDescription('User yang ingin di-mention (opsional)'));

const LIMIT = 2000;

export async function execute(interaction) {
  const prompt = interaction.options.getString('prompt');
  const system = interaction.options.getString('system') || undefined;
  const web = interaction.options.getBoolean('web') || false;
  const targetUser = interaction.options.getUser('user') || null;

  await interaction.deferReply();

  try {
    const { text, sources } = await askGemini({ prompt, system, web });
    let out = text || '_No content_';

    if (web && sources.length) {
      const cite = sources.slice(0, 3).map((s, i) => `[${i + 1}] ${s.title}`).join('\n');
      out += `\n\nSources:\n${cite}`;
    }

    // Normalisasi mention yang kehilangan '@' (contoh: "<123>" => "<@123>")
    out = out.replace(/<(\d{17,20})>/g, '<@$1>');

    // Kumpulkan ID user yang disebutkan, dari prompt maupun output akhir, plus user option
    const idsFromPrompt = Array.from(prompt.matchAll(/<@!?(\d{17,20})>/g)).map(m => m[1]);
    const idsFromOut = Array.from(out.matchAll(/<@!?(\d{17,20})>/g)).map(m => m[1]);
    const idsFromOption = targetUser ? [targetUser.id] : [];
    const userIds = Array.from(new Set([...idsFromPrompt, ...idsFromOut, ...idsFromOption]));
    const allowedMentions = { parse: [], users: userIds };

    // Jika user option dipilih dan belum muncul di output, prefiks mention di depan
    if (targetUser && !out.includes(`<@${targetUser.id}>`) && !out.includes(`<@!${targetUser.id}>`)) {
      out = `<@${targetUser.id}> ${out}`;
    }

    if (out.length <= LIMIT) return interaction.editReply({ content: out, allowedMentions });
    await interaction.editReply({ content: out.slice(0, LIMIT), allowedMentions });
    for (let i = LIMIT; i < out.length; i += LIMIT) {
      // eslint-disable-next-line no-await-in-loop
      await interaction.followUp({ content: out.slice(i, i + LIMIT), allowedMentions });
    }
  } catch (e) {
    console.error('[Ask Error]', e);
    await interaction.editReply(`❌ Gagal panggil AI: ${e.message || 'Unknown error'}`);
  }
}
