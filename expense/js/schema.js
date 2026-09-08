/* ── 資料模型、預設資料、版本遷移 ─────────────────────── */
var Schema = (function () {
  var VERSION = 1;

  var DEFAULT_CATEGORIES = [
    { name: '飲食', emoji: '🍚', color: '#FF8A65', type: 'expense' },
    { name: '咖啡', emoji: '☕', color: '#A1887F', type: 'expense' },
    { name: '購物', emoji: '🛍️', color: '#F48FB1', type: 'expense' },
    { name: '交通', emoji: '🚗', color: '#64B5F6', type: 'expense' },
    { name: '居住', emoji: '🏠', color: '#7986CB', type: 'expense' },
    { name: '醫療', emoji: '💊', color: '#4DD0A7', type: 'expense' },
    { name: '娛樂', emoji: '🎮', color: '#9B8CFF', type: 'expense' },
    { name: '旅遊', emoji: '✈️', color: '#4DD0E1', type: 'expense' },
    { name: '育兒', emoji: '👦🏻', color: '#FFB74D', type: 'expense' },
    { name: '菸彈', emoji: '🚬', color: '#90A4AE', type: 'expense' },
    { name: '訂閱', emoji: '📺', color: '#BA68C8', type: 'expense' },
    { name: '保險', emoji: '🛡️', color: '#4FC3F7', type: 'expense' },
    { name: '其他', emoji: '📦', color: '#BDBDBD', type: 'expense' },
    { name: '薪資', emoji: '💰', color: '#66BB6A', type: 'income' },
    { name: '獎金', emoji: '🎁', color: '#26A69A', type: 'income' },
    { name: '投資', emoji: '📈', color: '#42A5F5', type: 'income' },
    { name: '其他收入', emoji: '🧾', color: '#9CCC65', type: 'income' }
  ];

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
        usageCount: 0
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
    });

    data.schemaVersion = VERSION;
    if (v > VERSION) data.schemaVersion = v; /* 別把新版資料降級 */
    return data;
  }

  return {
    VERSION: VERSION, blank: blank, migrate: migrate,
    ACHIEVEMENTS: ACHIEVEMENTS,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES
  };
})();
