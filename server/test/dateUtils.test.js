const { toIsoDate, toIsoDateTime } = require('../src/builders/dateUtils');

describe('toIsoDate', () => {
  test('接受 YYYY-MM-DD', () => {
    expect(toIsoDate('1990-01-02', 'birthDate')).toBe('1990-01-02');
  });

  test('接受 YYYY/MM/DD 並轉換分隔符', () => {
    expect(toIsoDate('1990/01/02', 'birthDate')).toBe('1990-01-02');
  });

  test('接受閏年 2/29', () => {
    expect(toIsoDate('2024-02-29', 'birthDate')).toBe('2024-02-29');
  });

  test('拒絕非閏年的 2/29（Date 物件會靜默捲動成 3/1，需手動曆法檢查攔截）', () => {
    expect(() => toIsoDate('2023-02-29', 'birthDate')).toThrow(/birthDate/);
  });

  test('拒絕不存在的日期 2/30', () => {
    expect(() => toIsoDate('2024-02-30', 'birthDate')).toThrow(/birthDate/);
  });

  test('拒絕月份超出範圍', () => {
    expect(() => toIsoDate('2024-13-01', 'birthDate')).toThrow(/birthDate/);
  });

  test('拒絕民國年格式（屬 v5 清洗層範疇，非本層職責）', () => {
    expect(() => toIsoDate('79/01/02', 'birthDate')).toThrow(/birthDate/);
  });

  test('拋出的錯誤帶有 FHIR IssueType code=value', () => {
    try {
      toIsoDate('not-a-date', 'birthDate');
      throw new Error('應該要拋出例外');
    } catch (err) {
      expect(err.code).toBe('value');
      expect(err.missing).toEqual(['birthDate']);
    }
  });
});

describe('toIsoDateTime', () => {
  test('接受帶 Z 時區的 ISO 8601', () => {
    expect(toIsoDateTime('2026-07-15T10:12:04Z', 'periodStart')).toBe('2026-07-15T10:12:04Z');
  });

  test('接受帶偏移時區的 ISO 8601', () => {
    expect(toIsoDateTime('2026-07-15T10:12:04+08:00', 'periodStart')).toBe('2026-07-15T10:12:04+08:00');
  });

  test('接受帶小數秒的 ISO 8601', () => {
    expect(toIsoDateTime('2026-07-15T10:12:04.123Z', 'periodStart')).toBe('2026-07-15T10:12:04.123Z');
  });

  test('拒絕超出範圍的時分秒', () => {
    expect(() => toIsoDateTime('2026-07-15T25:00:00Z', 'periodStart')).toThrow(/periodStart/);
  });

  test('拒絕僅有日期、缺時間部分', () => {
    expect(() => toIsoDateTime('2026-07-15', 'periodStart')).toThrow(/periodStart/);
  });
});
