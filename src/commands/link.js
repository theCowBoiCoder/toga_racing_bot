const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const store = require('../store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your iRacing profile')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Your iRacing display name').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const api = interaction.client.iracingAPI;
      const name = interaction.options.getString('name');

      const results = await api.searchDrivers(name);
      const drivers = results?.results || results || [];

      if (!Array.isArray(drivers) || drivers.length === 0) {
        await interaction.editReply({
          content: `❌ No iRacing driver found matching **"${name}"**. Make sure you use your exact iRacing display name.`,
        });
        return;
      }

      const driver = drivers[0];
      const custId = driver.cust_id;
      const displayName = driver.display_name || name;

      // Save the link
      store.link(interaction.user.id, custId, displayName);

      const embed = new EmbedBuilder()
        .setTitle('✅ Account Linked!')
        .setColor(0x2ecc71)
        .setDescription(`Your Discord account is now linked to **${displayName}** (ID: ${custId}).`)
        .addFields(
          { name: 'You can now use', value: '`/mystats` `/myrecent` `/myirating` `/mystreak`', inline: false },
          { name: 'Wrong account?', value: 'Run `/link` again with the correct name, or `/unlink` to remove.', inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/link]', error);
      await interaction.editReply({ content: '❌ Failed to link account.' });
    }
  },
};
