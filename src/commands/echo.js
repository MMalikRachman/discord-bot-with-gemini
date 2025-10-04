import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('echo')
  .setDescription('Echo back your message')
  .addStringOption(opt =>
    opt.setName('text').setDescription('What to echo').setRequired(true)
  );

export async function execute(interaction) {
  const text = interaction.options.getString('text');
  await interaction.reply(`🔊 ${text}`);
}

