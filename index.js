const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

const commands = [
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Publicar o painel de atendimento")
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`Online como ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" })
      .setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Comando /painel registrado!");
  } catch (error) {
    console.error(error);
  }
});

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== "painel") return;

    if (!interaction.memberPermissions.has(
      PermissionFlagsBits.ManageGuild
    )) {
      return interaction.reply({
        content: "Você não tem permissão para isso.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor("#17365D")
      .setTitle("🎖️ CENTRAL DE ATENDIMENTO")
      .setDescription(
        "Bem-vindo à Central de Atendimento!\n\n" +
        "Precisa de ajuda? Clique no botão abaixo " +
        "para abrir seu atendimento.\n\n" +
        "📌 Respeite as orientações da equipe."
      )
      .setFooter({
        text: "Sistema Oficial de Atendimento"
      });

    const button = new ButtonBuilder()
      .setCustomId("abrir_ticket")
      .setLabel("Abrir atendimento")
      .setEmoji("📩")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder()
      .addComponents(button);

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  if (interaction.isButton()) {

    const guild = interaction.guild;
    const member = interaction.member;

    if (interaction.customId === "abrir_ticket") {

      const existing = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic === `ticket-${member.id}`
      );

      if (existing) {
        return interaction.reply({
          content: `Você já possui um ticket: ${existing}`,
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const channel = await guild.channels.create({
          name: `ticket-${interaction.user.username}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, ""),
          type: ChannelType.GuildText,
          parent: CATEGORY_ID,
          topic: `ticket-${member.id}`,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: SUPPORT_ROLE_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });

        const embed = new EmbedBuilder()
          .setColor("#17365D")
          .setTitle("📩 ATENDIMENTO ABERTO")
          .setDescription(
            `Olá, ${member}!\n\n` +
            "Seu atendimento foi criado.\n" +
            "Descreva sua solicitação e aguarde a equipe."
          );

        const close = new ButtonBuilder()
          .setCustomId("fechar_ticket")
          .setLabel("Encerrar atendimento")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
          .addComponents(close);

        await channel.send({
          content: `${member} <@&${SUPPORT_ROLE_ID}>`,
          embeds: [embed],
          components: [row]
        });

        await interaction.editReply({
          content: `Atendimento criado: ${channel}`
        });

      } catch (error) {
        console.error(error);

        await interaction.editReply({
          content: "Erro ao criar o ticket. Verifique as permissões."
        });
      }
    }

    if (interaction.customId === "fechar_ticket") {

      const channel = interaction.channel;
      const ownerId = channel.topic?.replace("ticket-", "");

      const isOwner = interaction.user.id === ownerId;
      const isStaff = interaction.member.roles.cache.has(
        SUPPORT_ROLE_ID
      );

      if (!isOwner && !isStaff) {
        return interaction.reply({
          content: "Você não pode encerrar este ticket.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔒 Atendimento encerrado. Canal será excluído em 5 segundos."
      });

      setTimeout(() => {
        channel.delete().catch(console.error);
      }, 5000);
    }
  }
});

if (!TOKEN || !CLIENT_ID || !GUILD_ID ||
    !CATEGORY_ID || !SUPPORT_ROLE_ID) {
  throw new Error("Faltam configurações nos Secrets!");
}

client.login(TOKEN);
