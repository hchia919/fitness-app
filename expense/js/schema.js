/* ── 資料模型、預設資料、版本遷移 ─────────────────────── */
var Schema = (function () {
  var VERSION = 2;

  /* subs = 細項（第二層），記帳時可選可不選 */
  var DEFAULT_CATEGORIES = [
    { name: '飲食', emoji: '🍚', color: '#FF8A65', type: 'expense',
      subs: ['早餐', '午餐', '晚餐', '宵夜', '點心', '飲料', '外送', '食材'] },
    { name: '咖啡', emoji: '☕', color: '#A1887F', type: 'expense',
      subs: ['超商咖啡', '連鎖咖啡', '獨立咖啡廳', '手搖飲'] },
    { name: '購物', emoji: '🛍️', color: '#F48FB1', type: 'expense',
      subs: ['衣物', '鞋包', '美妝', '日用品', '3C', '家電', '網購'] },
    { name: '交通', emoji: '🚗', color: '#64B5F6', type: 'expense',
      subs: ['公車', '捷運', '計程車', '火車', '高鐵', '加油', '停車', '過路費'] },
    { name: '居住', emoji: '🏠', color: '#7986CB', type: 'expense',
      subs: ['房租', '房貸', '水費', '電費', '瓦斯', '網路', '管理費', '修繕'] },
    { name: '醫療', emoji: '💊', color: '#4DD0A7', type: 'expense',
      subs: ['看診', '藥品', '牙醫', '健檢', '保健食品', '眼鏡'] },
    { name: '娛樂', emoji: '🎮', color: '#9B8CFF', type: 'expense',
      subs: ['電影', '遊戲', 'KTV', '展覽', '運動', '書籍'] },
    { name: '旅遊', emoji: '✈️', color: '#4DD0E1', type: 'expense',
      subs: ['機票', '住宿', '當地交通', '門票', '伴手禮', '旅遊餐飲'] },
    { name: '育兒', emoji: '👦🏻', color: '#FFB74D', type: 'expense',
      subs: ['尿布', '奶粉', '副食品', '玩具', '童裝', '保母', '學費'] },
    { name: '菸彈', emoji: '🚬', color: '#90A4AE', type: 'expense',
      subs: ['菸彈', '主機', '配件'] },
    { name: '訂閱', emoji: '📺', color: '#BA68C8', type: 'expense',
      subs: ['影音', '音樂', '雲端', '軟體', '會員'] },
    { name: '保險', emoji: '🛡️', color: '#4FC3F7', type: 'expense',
      subs: ['壽險', '醫療險', '意外險', '車險', '旅平險'] },
    { name: '其他', emoji: '📦', color: '#BDBDBD', type: 'expense', subs: [] },
    { name: '薪資', emoji: '💰', color: '#66BB6A', type: 'income',
      subs: ['本薪', '加班費', '津貼', '兼職'] },
    { name: '獎金', emoji: '🎁', color: '#26A69A', type: 'income',
      subs: ['年終', '績效', '紅包'] },
    { name: '投資', emoji: '📈', color: '#42A5F5', type: 'income',
      subs: ['股利', '利息', '價差', '租金收入'] },
    { name: '其他收入', emoji: '🧾', color: '#9CCC65', type: 'income',
      subs: ['退款', '補助', '二手賣出', '中獎'] }
  ];

  function buildSubs(names, catId) {
    return (names || []).map(function (n, i) {
      return { id: catId + '_s' + i, name: n, order: i, isArchived: false, usageCount: 0 };
    });
  }

  var DEFAULT_PAYMENTS = [
    { name: '現金', emoji: '💵', kind: 'cash' },
    { name: '信用卡', emoji: '💳', kind: 'card' },
    { name: '行動支付', emoji: '📱', kind: 'ewallet' },
    { name: '銀行轉帳', emoji: '🏦', kind: 'transfer' },
    { name: '悠遊卡', emoji: '🚈', kind: 'ewallet' }
  ];

  var ACHIEVEMENTS = [
    { id: 'first',      emoji: '🌱', name: '第一筆帳' },
    { id: 'streak3',    emoji: '🔥', name: '連續 3 天' },
    { id: 'streak7',    emoji: '⭐',  name: '連續 7 天' },
    { id: 'streak30',   emoji: '👑', name: '連續 30 天' },
    { id: 'tx50',       emoji: '📚', name: '50 筆紀錄' },
    { id: 'tx200',      emoji: '🏅', name: '200 筆紀錄' },
    { id: 'budgetset',  emoji: '🎯', name: '設定預算' },
    { id: 'recurring',  emoji: '🔁', name: '管好固定支出' },
    { id: 'budgetkeep', emoji: '🛡️', name: '預算沒超支' },
    { id: 'saved',      emoji: '💚', name: '比上月更省' },
    { id: 'allcat',     emoji: '🎨', name: '用過 8 種類別' },
    { id: 'earlybird',  emoji: '🌅', name: '一早就記帳' }
  ];

  function blank() {
    var cats = DEFAULT_CATEGORIES.map(function (c, i) {
      return {
        id: 'cat_' + i, name: c.name, emoji: c.emoji, color: c.color,
        type: c.type, order: i, isArchived: false, isSystem: c.name === '其他',
        usageCount: 0, subs: buildSubs(c.subs, 'cat_' + i)
      };
    });
    var pays = DEFAULT_PAYMENTS.map(function (p, i) {
      return { id: 'pay_' + i, name: p.name, emoji: p.emoji, kind: p.kind, isArchived: false };
    });
    return {
      schemaVersion: VERSION,
      transactions: [],
      categories: cats,
      payments: pays,
      recurrings: [],
      budgets: {},           /* { 'YYYY-MM'|'default': { total, categories:{catId:amt} } } */
      settings: {
        currency: 'TWD',
        monthStartDay: 1,
        weekStartsOn: 1,
        theme: 'auto',
        lastPaymentId: pays[0].id,
        catSort: 'usage',        /* usage = 常用優先, custom = 自訂順序 */
        streak: { count: 0, best: 0, lastDate: null },
        achievements: [],
        lastReviewMonth: null,
        onboarded: false
      }
    };
  }

  /* 未來版本升級都寫在這裡 */
  function migrate(data) {
    if (!data || typeof data !== 'object') return blank();
    var base = blank();
    var v = data.schemaVersion || 0;

    /* 欄位補齊（往前相容） */
    data.transactions = Array.isArray(data.transactions) ? data.transactions : [];
    data.categories = Array.isArray(data.categories) && data.categories.length ? data.categories : base.categories;
    data.payments = Array.isArray(data.payments) && data.payments.length ? data.payments : base.payments;
    data.recurrings = Array.isArray(data.recurrings) ? data.recurrings : [];
    data.budgets = data.budgets && typeof data.budgets === 'object' ? data.budgets : {};
    data.settings = Object.assign({}, base.settings, data.settings || {});
    data.settings.streak = Object.assign({}, base.settings.streak, data.settings.streak || {});
    data.settings.achievements = Array.isArray(data.settings.achievements) ? data.settings.achievements : [];

    data.categories.forEach(function (c, i) {
      if (c.order == null) c.order = i;
      if (c.usageCount == null) c.usageCount = 0;
      if (!c.type) c.type = 'expense';
      if (c.isArchived == null) c.isArchived = false;

      /* v2：補上細項。預設類別第一次升級時帶入內建清單，自訂類別給空陣列 */
      if (!Array.isArray(c.subs)) {
        var m = /^cat_(\d+)$/.exec(c.id);
        var def = m && DEFAULT_CATEGORIES[Number(m[1])];
        c.subs = def ? buildSubs(def.subs, c.id) : [];
      }
      c.subs.forEach(function (sub, j) {
        if (!sub.id) sub.id = c.id + '_s' + j + '_' + j;
        if (sub.order == null) sub.order = j;
        if (sub.usageCount == null) sub.usageCount = 0;
        if (sub.isArchived == null) sub.isArchived = false;
      });
    });

    data.schemaVersion = VERSION;
    if (v > VERSION) data.schemaVersion = v; /* 別把新版資料降級 */
    return data;
  }

  return {
    VERSION: VERSION, blank: blank, migrate: migrate, buildSubs: buildSubs,
    ACHIEVEMENTS: ACHIEVEMENTS,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES
  };
})();
