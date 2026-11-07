const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require("discord.js");

const fs = require("fs");

// ===============================
// DARK SYSTEM CONFIG
// ===============================

const TOKEN = "PUT_BOT_TOKEN_HERE";
const PREFIX = "!";

const OWNER_IDS = [];

const CONFIG = {
  TICKET_CATEGORY_ID: "PUT_CATEGORY_ID",
  LOG_CHANNEL_ID: "PUT_LOG_CHANNEL_ID",

  SUPPORT_ROLE_IDS: [
    "PUT_SUPPORT_ROLE_ID"
  ],

  STATS_ROLE_IDS: [
    "PUT_ADMIN_ROLE_ID"
  ],

  POINTS_ROLE_IDS: [
    "PUT_POINTS_ROLE_ID"
  ],

  PANEL_IMAGE_URL: ""
};

// ===============================
// DATABASE
// ===============================

const DB_FILE = "./dark-system-data.json";

let db = {
  ticketNumber: 0,
  tickets: {},
  points: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (error) {
    console.error("Database error:", error);
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===============================
// BOT
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const COLORS = {
  BLACK: 0x080808,
  WHITE: 0xffffff,
  BLUE: 0x237bff
};

function isOwner(interaction) {
  return OWNER_IDS.includes(interaction.user.id) ||
    interaction.guild.ownerId === interaction.user.id;
}

function hasRole(member, roles) {
  return roles.some(id => member.roles.cache.has(id));
}

function isStaff(member) {
  return isOwner({
    user: member.user,
    guild: member.guild
  }) || hasRole(member, CONFIG.SUPPORT_ROLE_IDS);
}

function makeEmbed(title, description) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.BLACK)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "DARK SYSTEM" })
    .setTimestamp();

  if (CONFIG.PANEL_IMAGE_URL) {
    embed.setImage(CONFIG.PANEL_IMAGE_URL);
  }

  return embed;
}

// ===============================
// TICKET PANEL
// ===============================

async function sendTicketPanel(channel) {
  const embed = makeEmbed(
    "DARK SYSTEM — TICKET PANEL",
    "الرجاء الضغط على الخيار الموجود بالأسفل لإظهار جميع أنواع التذاكر.\n\nيُرجى اختيار القسم الصحيح."
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("اختر نوع التذكرة")
    .addOptions(
      {
        label: "INQUIRY",
        description: "استفسار",
        value: "INQUIRY",
        emoji: "❓"
      },
      {
        label: "COMPLAINT",
        description: "شكوى",
        value: "COMPLAINT",
        emoji: "📝"
      },
      {
        label: "REPORT A MEMBER",
        description: "بلاغ على عضو",
        value: "REPORT",
        emoji: "🚨"
      },
      {
        label: "REQUEST HELP",
        description: "طلب مساعدة",
        value: "HELP",
        emoji: "🛠️"
      }
    );

  await channel.send({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  });
}

// ===============================
// CREATE TICKET
// ===============================

async function createTicket(interaction, type) {
  const userId = interaction.user.id;

  const existing = Object.values(db.tickets).find(
    t => t.userId === userId && t.open
  );

  if (existing) {
    return interaction.reply({
      content: `لديك تذكرة مفتوحة بالفعل: <#${existing.channelId}>`,
      ephemeral: true
    });
  }

  const category = interaction.guild.channels.cache.get(
    CONFIG.TICKET_CATEGORY_ID
  );

  if (!category || category.type !== ChannelType.GuildCategory) {
    return interaction.reply({
      content: "لم يتم إعداد قسم التذاكر بشكل صحيح.",
      ephemeral: true
    });
  }

  db.ticketNumber++;

  const number = String(db.ticketNumber).padStart(3, "0");
  const ticketName = `ticket-${number}`;

  const channel = await interaction.guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `TICKET-${number} | ${userId}`,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      ...CONFIG.SUPPORT_ROLE_IDS.map(roleId => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      })),
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels
        ]
      }
    ]
  });

  db.tickets[number] = {
    number,
    channelId: channel.id,
    userId,
    type,
    open: true,
    claimedBy: null,
    createdAt: Date.now()
  };

  saveDB();

  const embed = makeEmbed(
    `TICKET-${number}`,
    `**صاحب التذكرة:** <@${userId}>\n` +
    `**القسم:** ${type}\n` +
    `**الحالة:** مفتوحة\n\n` +
    "يرجى كتابة تفاصيل طلبك وانتظار أحد أفراد الإدارة."
  );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`claim_${number}`)
      .setLabel("استلام التذكرة")
      .setEmoji("📌")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`close_${number}`)
      .setLabel("إغلاق التذكرة")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${userId}>`,
    embeds: [embed],
    components: [buttons]
  });

  await interaction.reply({
    content: `تم فتح تذكرتك بنجاح: ${channel}`,
    ephemeral: true
  });
}

// ===============================
// ADMIN PANEL
// ===============================

async function sendAdminPanel(channel) {
  const embed = makeEmbed(
    "DARK SYSTEM",
    "**ADMIN CONTROL PANEL**\n\n" +
    "مرحباً بك في لوحة تحكم الإدارة.\n" +
    "اختر الخدمة المطلوبة من الأزرار بالأسفل."
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_stats")
      .setLabel("الإحصائيات")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_add")
      .setLabel("إضافة نقاط")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("admin_remove")
      .setLabel("خصم نقاط")
      .setEmoji("➖")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}

// ===============================
// INTERACTIONS
// ===============================

client.on(Events.InteractionCreate, async interaction => {
  try {

    // TICKET SELECT MENU

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {
      return createTicket(interaction, interaction.values[0]);
    }

    // BUTTONS

    if (interaction.isButton()) {

      // CLAIM TICKET

      if (interaction.customId.startsWith("claim_")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "ليس لديك صلاحية استلام التذاكر.",
            ephemeral: true
          });
        }

        const number = interaction.customId.split("_")[1];
        const ticket = db.tickets[number];

        if (!ticket || !ticket.open) {
          return interaction.reply({
            content: "هذه التذكرة غير متاحة.",
            ephemeral: true
          });
        }

        if (ticket.claimedBy) {
          return interaction.reply({
            content: `التذكرة مستلمة من <@${ticket.claimedBy}>`,
            ephemeral: true
          });
        }

        ticket.claimedBy = interaction.user.id;
        saveDB();

        return interaction.reply({
          content: `تم استلام التذكرة بواسطة ${interaction.user}`,
          allowedMentions: { users: [interaction.user.id] }
        });
      }

      // CLOSE TICKET

      if (interaction.customId.startsWith("close_")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "ليس لديك صلاحية إغلاق التذاكر.",
            ephemeral: true
          });
        }

        const number = interaction.customId.split("_")[1];
        const ticket = db.tickets[number];

        if (!ticket || !ticket.open) {
          return interaction.reply({
            content: "التذكرة مغلقة بالفعل.",
            ephemeral: true
          });
        }

        ticket.open = false;
        ticket.closedBy = interaction.user.id;
        ticket.closedAt = Date.now();
        saveDB();

        const logChannel = interaction.guild.channels.cache.get(
          CONFIG.LOG_CHANNEL_ID
        );

        if (logChannel) {
          await logChannel.send({
            embeds: [
              makeEmbed(
                `TICKET-${number} — CLOSED`,
                `**العضو:** <@${ticket.userId}>\n` +
                `**القسم:** ${ticket.type}\n` +
                `**استلمها:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "لم يتم استلامها"}\n` +
                `**أغلقها:** ${interaction.user}`
              )
            ]
          });
        }

        await interaction.reply({
          content: "تم إغلاق التذكرة. سيتم حذف القناة بعد 5 ثوانٍ."
        });

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 5000);

        return;
      }

      // ADMIN PERMISSION

      const isStats = interaction.customId === "admin_stats";
      const isPoints = [
        "admin_add",
        "admin_remove"
      ].includes(interaction.customId);

      if (isStats) {
        if (
          !isOwner(interaction) &&
          !hasRole(interaction.member, CONFIG.STATS_ROLE_IDS)
        ) {
          return interaction.reply({
            content: "ليس لديك صلاحية عرض الإحصائيات.",
            ephemeral: true
          });
        }

        const tickets = Object.values(db.tickets);
        const open = tickets.filter(t => t.open).length;
        const closed = tickets.filter(t => !t.open).length;

        const embed = makeEmbed(
          "DARK SYSTEM — STATISTICS",
          `**إجمالي التذاكر:** ${tickets.length}\n` +
          `**التذاكر المفتوحة:** ${open}\n` +
          `**التذاكر المغلقة:** ${closed}\n` +
          `**الأعضاء المسجلون بالنقاط:** ${Object.keys(db.points).length}`
        );

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (isPoints) {
        if (
          !isOwner(interaction) &&
          !hasRole(interaction.member, CONFIG.POINTS_ROLE_IDS)
        ) {
          return interaction.reply({
            content: "ليس لديك صلاحية إدارة النقاط.",
            ephemeral: true
          });
        }

        const action = interaction.customId === "admin_add"
          ? "add"
          : "remove";

        const modal = new ModalBuilder()
          .setCustomId(`points_${action}`)
          .setTitle(action === "add" ? "إضافة نقاط" : "خصم نقاط");

        const userInput = new TextInputBuilder()
          .setCustomId("user_id")
          .setLabel("ID العضو")
          .setPlaceholder("123456789012345678")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const amountInput = new TextInputBuilder()
          .setCustomId("amount")
          .setLabel("عدد النقاط")
          .setPlaceholder("مثال: 10")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(amountInput)
        );

        return interaction.showModal(modal);
      }
    }

    // POINTS MODAL

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("points_")
    ) {
      const action = interaction.customId.split("_")[1];

      const userId = interaction.fields.getTextInputValue("user_id").trim();
      const amount = Number(
        interaction.fields.getTextInputValue("amount")
      );

      if (
        !/^\d{17,20}$/.test(userId) ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > 100000
      ) {
        return interaction.reply({
          content: "تأكد من ID العضو وعدد النقاط.",
          ephemeral: true
        });
      }

      const current = db.points[userId] || 0;

      if (action === "remove" && current < amount) {
        return interaction.reply({
          content: "رصيد العضو لا يكفي لخصم هذه النقاط.",
          ephemeral: true
        });
      }

      db.points[userId] = action === "add"
        ? current + amount
        : current - amount;

      saveDB();

      return interaction.reply({
        content:
          `تم ${action === "add" ? "إضافة" : "خصم"} ${amount} نقطة.\n` +
          `العضو: <@${userId}>\n` +
          `الرصيد الحالي: **${db.points[userId]}**`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error(error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "حدث خطأ أثناء تنفيذ العملية.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ===============================
// SETUP COMMANDS
// ===============================

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  if (!message.content.startsWith(PREFIX)) return;

  if (
    message.content === `${PREFIX}setup-tickets` ||
    message.content === `${PREFIX}setup-admin`
  ) {
    if (
      message.author.id !== message.guild.ownerId &&
      !OWNER_IDS.includes(message.author.id)
    ) {
      return message.reply("هذا الأمر مخصص لمالك السيرفر.");
    }

    if (message.content === `${PREFIX}setup-tickets`) {
      return sendTicketPanel(message.channel);
    }

    if (message.content === `${PREFIX}setup-admin`) {
      return sendAdminPanel(message.channel);
    }
  }
});

// ===============================
// READY
// ===============================

client.once(Events.ClientReady, () => {
  console.log(`DARK SYSTEM ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);
