const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('track')
    .setDescription('Look up track information')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Track name to search for').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const query = interaction.options.getString('name');

      const tracks = await api.getTracks();
      if (!Array.isArray(tracks)) {
        await interaction.editReply({ content: '❌ Failed to fetch track data.' });
        return;
      }

      const q = query.toLowerCase();
      const matched = tracks.filter(
        (t) =>
          t.track_name?.toLowerCase().includes(q) ||
          t.config_name?.toLowerCase().includes(q)
      );

      if (matched.length === 0) {
        await interaction.editReply({ content: `❌ No tracks found matching **"${query}"**.` });
        return;
      }

      // Show first match in detail, list others
      const track = matched[0];

      const embed = new EmbedBuilder()
        .setTitle(`🏟️ ${track.track_name}${track.config_name ? ` — ${track.config_name}` : ''}`)
        .setColor(0x1abc9c)
        .setTimestamp();

      const fields = [];

      if (track.track_config_length != null) {
        const miles = track.track_config_length;
        const km = (miles * 1.60934).toFixed(2);
        fields.push({ name: 'Length', value: `${miles} mi (${km} km)`, inline: true });
      }

      if (track.corners_per_lap != null) {
        fields.push({ name: 'Corners', value: `${track.corners_per_lap}`, inline: true });
      }

      if (track.category) {
        fields.push({ name: 'Category', value: track.category, inline: true });
      }

      if (track.location) {
        fields.push({ name: 'Location', value: track.location, inline: true });
      }

      if (track.track_types && track.track_types.length > 0) {
        fields.push({
          name: 'Type',
          value: track.track_types.map((t) => t.track_type).join(', '),
          inline: true,
        });
      }

      if (track.pit_road_speed_limit != null) {
        fields.push({ name: 'Pit Speed Limit', value: `${track.pit_road_speed_limit} mph`, inline: true });
      }

      if (track.free_with_subscription !== undefined) {
        fields.push({
          name: 'Free Content',
          value: track.free_with_subscription ? '✅ Yes' : '💰 Paid',
          inline: true,
        });
      }

      if (track.sku != null) {
        fields.push({ name: 'SKU', value: `${track.sku}`, inline: true });
      }

      embed.addFields(fields);

      // If there are other config matches, list them
      if (matched.length > 1) {
        const others = matched.slice(1, 8).map(
          (t) => `• ${t.track_name}${t.config_name ? ` — ${t.config_name}` : ''}`
        );
        embed.addFields({
          name: `Other Configurations (${matched.length - 1} more)`,
          value: others.join('\n'),
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/track]', error);
      await interaction.editReply({ content: '❌ Failed to look up track.' });
    }
  },
};
