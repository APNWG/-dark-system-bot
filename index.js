const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// ===== SETTINGS =====

const TOKEN = process.env.DISCORD_TOKEN;

const SERVER_IMAGE =
  "https://drive.google.com/uc?export=view&id=1AMEx75lF514kzetubUzbfdCVn9j2NGPz";

const TICKET_PANEL_CHANNEL = "1527435580970111076";
const TICKET_CATEGORY = "1527671262611243088";
const ADMIN_PANEL_CHANNEL = "1568363505222942890";

const ADMIN_ROLE_IDS = [
  "1527328350648140007",
  "1526287746170355782",
  "1568280573493903523",
  "1568281775422312589",
  "1568282755144359966",
  "1568283406226432182",
  "1568283523339653181",
  "1568283586631565312",
  "1568283708048408666",
  "1568283799169663158",
  "1568283862549921982",
  "1568283970662309978",
  "1568285495719362580"
];

// ===== TEMPORARY DATA =====

const points = new Map();
const openTickets = new Map();
const transactions = [];

let ticketNumber = 0;
let totalAdded = 0;
let totalRemoved = 0;

// ===== BOT =====

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

function isAdmin(member) {
  return member.permissions.has(
    PermissionFlagsBits.Administrator
  ) || ADMIN_ROLE_IDS.some(id => member.roles.cache.has(id));
}

function getPoints(id) {
  return points.get(id) || 0;
}

function makeEmbed(title, description) {
  return new EmbedBuilder()
    .setColor("#101010")
    .setTitle(title)
    .setDescription(description)
    .setImage(SERVER_IMAGE)
    .setFooter({ text: "DARK SYSTEM" })
    .setTimestamp();
}

// ===== PANELS =====

function ticketPanel() {
  const embed = makeEmbed(
    "DARK SYSTEM — TICKET PANEL",
    "الرجاء الضغط على الخيار الموجود بالأسفل لإظهار جميع أنواع التذاكر.\n\nيُرجى اختيار القسم الصحيح."
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_open_menu")
      .setLabel("فتح قائمة التذاكر")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function adminPanel() {
  const embed = makeEmbed(
    "DARK SYSTEM",
    "ADMIN CONTROL PANEL"
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_open_menu")
      .setLabel("اختر الخدمة")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// ===== READY =====

client.once("ready", () => {
  console.log(`DARK SYSTEM ONLINE: ${client.user.tag}`);
});

// ===== SETUP COMMAND =====

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content !== "!setup") return;

  if (!isAdmin(message.member)) {
    return message.reply("ليس لديك صلاحية استخدام هذا الأمر.");
  }

  try {
    const ticketChannel = await client.channels.fetch(
      TICKET_PANEL_CHANNEL
    );

    const adminChannel = await client.channels.fetch(
      ADMIN_PANEL_CHANNEL
    );

    await ticketChannel.send(ticketPanel());
    await adminChannel.send(adminPanel());

    await message.reply("تم إرسال لوحة التذاكر ولوحة الإدارة.");
  } catch (error) {
    console.error(error);
    await message.reply("حدث خطأ. تأكد من صلاحيات البوت والرومات.");
  }
});

// ===== TICKET MENU =====

function ticketMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
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
      )
  );
}

// ===== ADMIN MENU =====

function adminMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("admin_select")
      .setPlaceholder("اختر الخدمة")
      .addOptions(
        {
          label: "My Points",
          description: "عرض نقاطك",
          value: "my_points",
          emoji: "🎖️"
        },
        {
          label: "Add Points",
          description: "إضافة نقاط لإداري",
          value: "add_points",
          emoji: "➕"
        },
        {
          label: "Remove Points",
          description: "خصم نقاط من إداري",
          value: "remove_points",
          emoji: "➖"
        },
        {
          label: "Admin Statistics",
          description: "إحصائيات الإدارة",
          value: "admin_stats",
          emoji: "📊"
        }
      )
  );
}

// ===== POINTS MODALS =====

function pointsModal(action) {
  const modal = new ModalBuilder()
    .setCustomId(`points_${action}`)
    .setTitle(
      action === "add" ? "إضافة نقاط" : "خصم نقاط"
    );

  const userInput = new TextInputBuilder()
    .setCustomId("target_id")
    .setLabel("ايدي الإداري")
    .setPlaceholder("ضع ايدي الإداري هنا")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel("عدد النقاط")
    .setPlaceholder("مثال: 5")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(amountInput)
  );

  return modal;
}

// ===== TICKET BUTTONS =====

function ticketControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("استلام التذكرة")
      .setEmoji("📌")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("إغلاق التذكرة")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

        return interaction.reply({
          content: "الإدارة فقط تستطيع إغلاق التذاكر.",
          ephemeral: true
        });
      }

      const ownerMatch = interaction.channel.topic?.match(/ticket-owner:(\d+)/);

      if (ownerMatch) {
        openTickets.delete(ownerMatch[1]);
      }

      await interaction.reply("🔒 سيتم إغلاق التذكرة وحذف الروم.");

      await interaction.channel.delete();
      return;
    }

  } catch (error) {
    console.error("Interaction Error:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "حدث خطأ أثناء تنفيذ الطلب.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ===== START BOT =====

if (!TOKEN) {
  throw new Error("DISCORD_TOKEN غير موجود في GitHub Secrets");
}

client.login(TOKEN);
