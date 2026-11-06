
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ضع آيدي رتب الإدارة العليا هنا لاحقاً
const ADMIN_ROLE_IDS = [];

const points = new Map();

function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator)
    || ADMIN_ROLE_IDS.some(id => member.roles.cache.has(id));
}

client.once('clientReady', () => {
  console.log(`Dark System Bot is online as ${client.user.tag}`);
});

// إنشاء اللوحة بأمر !setup
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (message.content !== '!setup') return;

  if (!isAdmin(message.member)) {
    return message.reply('ليس لديك صلاحية إنشاء لوحة الإدارة.');
  }

  const embed = new EmbedBuilder()
    .setColor('#111827')
    .setTitle('DARK SYSTEM')
    .setDescription('لوحة تحكم الإدارة والنقاط')
    .setFooter({ text: 'Dark System Management' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('my_points')
      .setLabel('نقاطي')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('add_points')
      .setLabel('إضافة نقاط')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('remove_points')
      .setLabel('خصم نقاط')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('admin_stats')
      .setLabel('إحصائيات الإدارة')
      .setStyle(ButtonStyle.Secondary)
  );

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });

  await message.reply('تم إنشاء لوحة DARK SYSTEM بنجاح.');
});

// التعامل مع الأزرار والنماذج
client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {

    if (interaction.customId === 'my_points') {
      const score = points.get(interaction.user.id) || 0;

      return interaction.reply({
        content: `نقاطك الحالية: **${score}**`,
        ephemeral: true
      });
    }

    if (interaction.customId === 'add_points' ||
        interaction.customId === 'remove_points') {

      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'ليس لديك صلاحية استخدام هذا الزر.',
          ephemeral: true
        });
      }

      const adding = interaction.customId === 'add_points';

      const modal = new ModalBuilder()
        .setCustomId(adding ? 'add_modal' : 'remove_modal')
        .setTitle(adding ? 'إضافة نقاط' : 'خصم نقاط');

      const userInput = new TextInputBuilder()
        .setCustomId('target')
        .setLabel('آيدي العضو')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('عدد النقاط')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(amountInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === 'admin_stats') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'هذا القسم للإدارة العليا فقط.',
          ephemeral: true
        });
      }

      const ranking = [...points.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const description = ranking.length
        ? ranking.map(([id, score], i) =>
            `**${i + 1}.** <@${id}> — ${score} نقطة`
          ).join('\n')
        : 'لا توجد نقاط مسجلة حالياً.';

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#111827')
            .setTitle('إحصائيات الإدارة')
            .setDescription(description)
        ],
        ephemeral: true
      });
    }
  }

  if (interaction.isModalSubmit()) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'ليس لديك صلاحية.',
        ephemeral: true
      });
    }

    const target = interaction.fields.getTextInputValue('target')
      .replace(/[<@!>]/g, '').trim();

    const amount = Number(
      interaction.fields.getTextInputValue('amount')
    );

    if (!/^\d{17,20}$/.test(target) ||
        !Number.isSafeInteger(amount) ||
        amount <= 0) {
      return interaction.reply({
        content: 'تأكد من آيدي العضو وعدد النقاط.',
        ephemeral: true
      });
    }

    const adding = interaction.customId === 'add_modal';

    if (!adding && interaction.customId !== 'remove_modal') return;

    const current = points.get(target) || 0;

    if (!adding && amount > current) {
      return interaction.reply({
        content: 'لا يمكن خصم أكثر من رصيد العضو.',
        ephemeral: true
      });
    }

    const updated = adding ? current + amount : current - amount;
    points.set(target, updated);

    return interaction.reply({
      content: adding
        ? `تمت إضافة ${amount} نقطة للعضو <@${target}>. رصيده: ${updated}`
        : `تم خصم ${amount} نقطة من العضو <@${target}>. رصيده: ${updated}`,
      allowedMentions: { parse: [] },
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
