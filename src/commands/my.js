const { SlashCommandBuilder } = require('discord.js');
const store = require('../store');

// These commands reuse the logic from existing commands but auto-fill the driver name
// from the linked account.

function notLinkedReply() {
  return {
    content: '❌ You haven\'t linked your iRacing account yet.\nUse `/link <your iRacing name>` first!',
    ephemeral: true,
  };
}

/**
 * Build all "my" commands that use the linked account.
 */
function buildMyCommands() {
  return [
    // /mystats
    {
      data: new SlashCommandBuilder()
        .setName('mystats')
        .setDescription('Show your iRacing stats (requires /link first)'),

      async execute(interaction) {
        const linked = store.getLink(interaction.user.id);
        if (!linked) { await interaction.reply(notLinkedReply()); return; }

        // Delegate to /driver logic with the linked name
        const driverCmd = interaction.client.commands.get('driver');
        // Override the option getter
        const original = interaction.options.getString;
        interaction.options.getString = (name) => {
          if (name === 'name') return linked.display_name;
          return original.call(interaction.options, name);
        };
        await driverCmd.execute(interaction);
      },
    },

    // /myrecent
    {
      data: new SlashCommandBuilder()
        .setName('myrecent')
        .setDescription('Show your recent races (requires /link first)'),

      async execute(interaction) {
        const linked = store.getLink(interaction.user.id);
        if (!linked) { await interaction.reply(notLinkedReply()); return; }

        const cmd = interaction.client.commands.get('recentraces');
        const original = interaction.options.getString;
        interaction.options.getString = (name) => {
          if (name === 'name') return linked.display_name;
          return original.call(interaction.options, name);
        };
        await cmd.execute(interaction);
      },
    },

    // /myirating
    {
      data: new SlashCommandBuilder()
        .setName('myirating')
        .setDescription('Show your iRating history (requires /link first)')
        .addStringOption((opt) =>
          opt
            .setName('category')
            .setDescription('Racing category')
            .setRequired(false)
            .addChoices(
              { name: 'Road', value: 'road' },
              { name: 'Oval', value: 'oval' },
              { name: 'Dirt Road', value: 'dirt_road' },
              { name: 'Dirt Oval', value: 'dirt_oval' },
              { name: 'Sports Car', value: 'sports_car' },
              { name: 'Formula Car', value: 'formula_car' }
            )
        ),

      async execute(interaction) {
        const linked = store.getLink(interaction.user.id);
        if (!linked) { await interaction.reply(notLinkedReply()); return; }

        const cmd = interaction.client.commands.get('irating');
        const original = interaction.options.getString;
        interaction.options.getString = (name) => {
          if (name === 'name') return linked.display_name;
          return original.call(interaction.options, name);
        };
        await cmd.execute(interaction);
      },
    },

    // /mystreak
    {
      data: new SlashCommandBuilder()
        .setName('mystreak')
        .setDescription('Show your win and podium streaks (requires /link first)'),

      async execute(interaction) {
        const linked = store.getLink(interaction.user.id);
        if (!linked) { await interaction.reply(notLinkedReply()); return; }

        const cmd = interaction.client.commands.get('streak');
        const original = interaction.options.getString;
        interaction.options.getString = (name) => {
          if (name === 'name') return linked.display_name;
          return original.call(interaction.options, name);
        };
        await cmd.execute(interaction);
      },
    },
  ];
}

module.exports = buildMyCommands;
