const { SlashCommandBuilder } = require('discord.js');
const store = require('../store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Discord account from iRacing'),

  async execute(interaction) {
    const existing = store.getLink(interaction.user.id);

    if (!existing) {
      await interaction.reply({
        content: '❌ Your account is not linked. Use `/link <name>` to link it.',
        ephemeral: true,
      });
      return;
    }

    store.unlink(interaction.user.id);

    await interaction.reply({
      content: `✅ Unlinked from **${existing.display_name}**. Use \`/link\` to link a different account.`,
      ephemeral: true,
    });
  },
};
