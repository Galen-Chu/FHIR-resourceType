// ISO 8601 時間格式校準層（v4 擴充藍圖第 4 項）
// 僅驗證/校準已結構化的日期輸入（如 Vue 表單送來的 YYYY-MM-DD、YYYY/MM/DD）；
// 原始異質格式（如民國年）的轉換屬 v5 清洗前置層範疇，見 docs/v4-design.md 第 4 節
const { ValidationError } = require('./common');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// 手動曆法檢查（月份天數、閏年 2/29），不依賴 Date 物件的寬鬆解析——
// new Date('2024-02-30') 會被瀏覽器/Node 靜默捲動成 2024-03-01 而非回傳 Invalid Date，
// 若只用 Number.isNaN(new Date(v).getTime()) 判斷，不存在的日期會悄悄通過驗證
function isValidCalendarDate(year, month, day) {
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function fail(fieldName, value, expect) {
  throw new ValidationError([fieldName], {
    code: 'value',
    message: `${fieldName} 格式錯誤（需為 ${expect}，實際：${value}）`
  });
}

function toIsoDate(value, fieldName) {
  const v = String(value ?? '').trim().replace(/\//g, '-');
  const m = DATE_RE.exec(v);
  if (!m) fail(fieldName, value, 'YYYY-MM-DD');
  const [, year, month, day] = m.map(Number);
  if (!isValidCalendarDate(year, month, day)) fail(fieldName, value, 'YYYY-MM-DD（有效日期）');
  return v;
}

function toIsoDateTime(value, fieldName) {
  const v = String(value ?? '').trim();
  const m = DATETIME_RE.exec(v);
  if (!m) fail(fieldName, value, 'ISO 8601 日期時間');
  const [, year, month, day, hour, minute, second] = m.map(Number);
  if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    fail(fieldName, value, 'ISO 8601 日期時間（有效日期時間）');
  }
  return v;
}

module.exports = { toIsoDate, toIsoDateTime };
