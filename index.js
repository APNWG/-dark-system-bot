
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("fs");

// =================================
// DARK SYSTEM CONFIGURATION
// =================================

const TOKEN = (process.env.DISCORD_TOKEN || "").trim();

console.log("TOKEN CHECK:", TOKEN.length > 0 ? "FOUND" : "MISSING");
console.log("TOKEN LENGTH:", TOKEN.length);

const PREFIX = "!";

// ضع آيدي الأونر هنا
const OWNER_IDS = [
  "PUT_OWNER_ID"
];

const CONFIG = {
  TICKET_CATEGORY_ID: "1527671262611243088",
  LOG_CHANNEL_ID: "PUT_LOG_CHANNEL_ID",

  SUPPORT_ROLE_IDS: [],
  STATS_ROLE_IDS: [],
  POINTS_ROLE_IDS: [],

  PANEL_IMAGE_URL: ""
};
// =================================
// DATABASE
// =================================

const DB_FILE = "./dark-system-data.json";

let db = {
  ticketNumber: 0,
  tickets: {},
  points: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = {
      ...db,
      ...JSON.parse(fs.readFileSync(DB_FILE, "utf8"))
    };
  } catch (e) {
    console.log("Database could not be loaded.");
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// =================================
// CLIENT
// =================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// =================================
// PERMISSIONS
// =================================

function isOwner(interaction) {
  return (
    OWNER_IDS.includes(interaction.user.id) ||
    interaction.guild.ownerId === interaction.user.id
  );
}

function hasRole(member, roles) {
  return roles.some(id => member.roles.cache.has(id));
}

function isStaff(interaction) {
  return (
    isOwner(interaction) ||
    hasRole(interaction.member, CONFIG.SUPPORT_ROLE_IDS)
  );
}

// =================================
// EMBEDS
// =================================

function makeEmbed(title, description) {
  const embed = new EmbedBuilder()
    .setColor(0x080808)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "DARK SYSTEM" })
    .setTimestamp();

  if (CONFIG.PANEL_IMAGE_URL) {
    embed.setImage(CONFIG.PANEL_IMAGE_URL);
  }

  return embed;
}

// =================================
// TICKET PANEL
// =================================

async function sendTicketPanel(channel) {
  const embed = makeEmbed(
    "DARK SYSTEM — TICKET",
    "الرجاء الضغط على الخيار الذي في الأسفل لإظهار جميع أنواع التذكرة.\n\nقم باختيار القسم الصحيح."
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

// =================================
// CREATE TICKET
// =================================

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
      content: "إعداد قسم التذاكر غير صحيح.",
      ephemeral: true
    });
  }

  db.ticketNumber++;

  const number = String(db.ticketNumber).padStart(3, "0");

  const channel = await interaction.guild.channels.create({
    name: `ticket-${number}`,
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
    "**الحالة:** مفتوحة\n\n" +
    "يرجى كتابة تفاصيل طلبك وانتظار الإدارة."
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

  return interaction.reply({
    content: `تم فتح تذكرتك: ${channel}`,
    ephemeral: true
  });
}

// =================================
// ADMIN CONTROL PANEL
// =================================

async function sendAdminPanel(channel) {
  const embed = makeEmbed(
    "DARK SYSTEM",
    "**ADMIN CONTROL PANEL**\n\n" +
    "مرحباً بك في لوحة تحكم الإدارة.\n" +
    "اختر الخدمة المطلوبة من الأسفل."
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

// =================================
// INTERACTIONS
// =================================

client.on(Events.InteractionCreate, async interaction => {
  try {

    // TICKET SELECT

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {
      return await createTicket(
        interaction,
        interaction.values[0]
      );
    }

    // BUTTONS

    if (interaction.isButton()) {

      // CLAIM

      if (interaction.customId.startsWith("claim_")) {
        if (!isStaff(interaction)) {
          return interaction.reply({
            content: "ليس لديك صلاحية استلام التذاكر.",
            ephemeral: true
          });
        }

        const number = interaction.customId.split("_")[1];
        const ticket = db.tickets[number];

        if (!ticket || !ticket.open) {
          return interaction.reply({
            content: "التذكرة غير متاحة.",
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
          content: `تم استلام التذكرة بواسطة ${interaction.user}.`
        });
      }

      // CLOSE

      if (interaction.customId.startsWith("close_")) {
        if (!isStaff(interaction)) {
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

        const log = interaction.guild.channels.cache.get(
          CONFIG.LOG_CHANNEL_ID
        );

        if (log) {
          await log.send({
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

      // STATISTICS

      if (interaction.customId === "admin_stats") {
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

        return interaction.reply({
          embeds: [
            makeEmbed(
              "DARK SYSTEM — STATISTICS",
              `**إجمالي التذاكر:** ${tickets.length}\n` +
              `**المفتوحة:** ${tickets.filter(t => t.open).length}\n` +
              `**المغلقة:** ${tickets.filter(t => !t.open).length}\n` +
              `**الأعضاء المسجلون بالنقاط:** ${Object.keys(db.points).length}`
            )
          ],
          ephemeral: true
        });
      }

      // POINTS PERMISSIONS

      if (
        interaction.customId === "admin_add" ||
        interaction.customId === "admin_remove"
      ) {
        if (
          !isOwner(interaction) &&
          !hasRole(interaction.member, CONFIG.POINTS_ROLE_IDS)
        ) {
          return interaction.reply({
            content: "ليس لديك صلاحية إدارة النقاط.",
            ephemeral: true
          });
        }

        const action =
          interaction.customId === "admin_add" ? "add" : "remove";

        const modal = new ModalBuilder()
          .setCustomId(`points_${action}`)
          .setTitle(action === "add" ? "إضافة نقاط" : "خصم نقاط");

        const userInput = new TextInputBuilder()
          .setCustomId("user_id")
          .setLabel("ID العضو")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const amountInput = new TextInputBuilder()
          .setCustomId("amount")
          .setLabel("عدد النقاط")
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

      const userId = interaction.fields
        .getTextInputValue("user_id").trim();

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
          content: "رصيد العضو لا يكفي.",
          ephemeral: true
        });
      }

      db.points[userId] =
        action === "add" ? current + amount : current - amount;

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
    console.error("Interaction Error:", error);

    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content: "حدث خطأ أثناء تنفيذ العملية.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =================================
// SETUP COMMANDS
// =================================

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  if (message.content === `${PREFIX}setup-tickets`) {
    if (message.author.id !== message.guild.ownerId &&
        !OWNER_IDS.includes(message.author.id)) {
      return message.reply("هذا الأمر مخصص لمالك السيرفر.");
    }

    return sendTicketPanel(message.channel);
  }

  if (message.content === `${PREFIX}setup-admin`) {
    if (message.author.id !== message.guild.ownerId &&
        !OWNER_IDS.includes(message.author.id)) {
      return message.reply("هذا الأمر مخصص لمالك السيرفر.");
    }

    return sendAdminPanel(message.channel);
  }
});

// =================================
// BOT READY
// =================================

client.once(Events.ClientReady, () => {
  console.log(`DARK SYSTEM ONLINE: ${client.user.tag}`);
});

// =================================
// LOGIN
// =================================

if (!TOKEN) {
  console.error("ERROR: DISCORD_TOKEN is missing!");
  process.exit(1);
}

client.login(TOKEN).catch(error => {
  console.error("LOGIN ERROR:", error);
  process.exit(1);
});
