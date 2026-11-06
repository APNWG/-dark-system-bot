
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ضع IDs رتب HEAD OF ADMIN إلى OWNER هنا
const ADMIN_ROLE_IDS = [
  // 'ROLE_ID',
  // 'ROLE_ID'
];

const DATA_FILE = path.join(__dirname, 'points.json');

function loadPoints() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

let points = loadPoints();

function savePoints() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(points, null, 2));
}

function isSenior(member) {
  if (!member) return false;

  return member.permissions.has(
    PermissionsBitField.Flags.Administrator
  ) || ADMIN_ROLE_IDS.some(id =>
    member.roles.cache.has(id)
  );
}

client.once('ready', () => {
  console.log(`DARK SYSTEM online as ${client.user.tag}`);
});

// إنشاء لوحة التحكم
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (message.content !== '!setup') return;

  if (!isSenior(message.member)) {
    return message.reply('❌ ليس لديك صلاحية.');
  }

  const embed = new EmbedBuilder()
    .setColor('#1877F2')
    .setTitle('DARK SYSTEM')
    .setDescription('ADMIN CONTROL PANEL')
    .setFooter({ text: 'DARK SYSTEM MANAGEMENT' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_menu')
      .setLabel('اختر الخدمة')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary)
  );

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });

  await message.reply('✅ تم إنشاء لوحة التحكم.');
});

client.on('interactionCreate', async interaction => {
  try {

    // فتح القائمة
    if (
      interaction.isButton() &&
      interaction.customId === 'open_menu'
    ) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('management_menu')
        .setPlaceholder('اختر الخدمة')
        .addOptions([
          {
            label: 'My Points',
            description: 'عرض نقاطك',
            value: 'my_points',
            emoji: '🎖️'
          },
          {
            label: 'Add Points',
            description: 'إضافة نقاط',
            value: 'add_points',
            emoji: '➕'
          },
          {
            label: 'Remove Points',
            description: 'خصم نقاط',
            value: 'remove_points',
            emoji: '➖'
          },
          {
            label: 'Admin Statistics',
            description: 'إحصائيات الإدارة',
            value: 'admin_stats',
            emoji: '📊'
          }
        ]);

      return interaction.reply({
        content: '📋 اختر الخدمة المطلوبة:',
        components: [
          new ActionRowBuilder().addComponents(menu)
        ],
        ephemeral: true
      });
    }

    // اختيار الخدمة
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'management_menu'
    ) {
      const choice = interaction.values[0];

      if (choice === 'my_points') {
        const balance = points[interaction.user.id] || 0;

        return interaction.reply({
          content: `🎖️ نقاطك: **${balance}**`,
          ephemeral: true
        });
      }

      if (!isSenior(interaction.member)) {
        return interaction.reply({
          content: '❌ هذه الخدمة خاصة برئيس الإدارة والرتب الأعلى.',
          ephemeral: true
        });
      }

      if (choice === 'admin_stats') {
        const entries = Object.entries(points)
          .sort((a, b) => b[1] - a[1]);

        const total = entries.reduce(
          (sum, entry) => sum + entry[1], 0
        );

        const list = entries.length
          ? entries.slice(0, 20).map(
              ([id, value], i) =>
                `**${i + 1}.** <@${id}> — ${value} نقطة`
            ).join('\n')
          : 'لا توجد نقاط مسجلة.';

        const embed = new EmbedBuilder()
          .setColor('#1877F2')
          .setTitle('📊 ADMIN STATISTICS')
          .setDescription(list)
          .addFields(
            {
              name: 'إجمالي النقاط',
              value: String(total),
              inline: true
            },
            {
              name: 'عدد الإداريين',
              value: String(entries.length),
              inline: true
            }
          );

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (
        choice === 'add_points' ||
        choice === 'remove_points'
      ) {
        const adding = choice === 'add_points';

        const modal = new ModalBuilder()
          .setCustomId(
            adding ? 'add_modal' : 'remove_modal'
          )
          .setTitle(
            adding ? 'إضافة نقاط' : 'خصم نقاط'
          );

        const memberInput = new TextInputBuilder()
          .setCustomId('member_id')
          .setLabel('آيدي العضو')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const amountInput = new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('عدد النقاط')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(memberInput),
          new ActionRowBuilder().addComponents(amountInput)
        );

        return interaction.showModal(modal);
      }
    }

    // تنفيذ إضافة أو خصم النقاط
    if (
      interaction.isModalSubmit() &&
      ['add_modal', 'remove_modal'].includes(interaction.customId)
    ) {
      if (!isSenior(interaction.member)) {
        return interaction.reply({
          content: '❌ ليس لديك صلاحية.',
          ephemeral: true
        });
      }

      const memberId = interaction.fields
        .getTextInputValue('member_id').trim();

      const amountText = interaction.fields
        .getTextInputValue('amount').trim();

      const amount = Number(amountText);

      if (!/^\d{17,20}$/.test(memberId)) {
        return interaction.reply({
          content: '❌ آيدي العضو غير صحيح.',
          ephemeral: true
        });
      }

      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
      ) {
        return interaction.reply({
          content: '❌ أدخل عدد نقاط صحيحاً.',
          ephemeral: true
        });
      }

      const current = points[memberId] || 0;
      const adding = interaction.customId === 'add_modal';

      if (!adding && amount > current) {
        return interaction.reply({
          content: '❌ لا يمكن خصم أكثر من رصيد العضو.',
          ephemeral: true
        });
      }

      points[memberId] = adding
        ? current + amount
        : current - amount;

      savePoints();

      return interaction.reply({
        content: adding
          ? `✅ تمت إضافة **${amount}** نقطة للعضو <@${memberId}>.\nرصيده الآن: **${points[memberId]}**`
          : `✅ تم خصم **${amount}** نقطة من العضو <@${memberId}>.\nرصيده الآن: **${points[memberId]}**`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'حدث خطأ أثناء تنفيذ الطلب.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
