function groupDailyTotals(factRows) {
  const dailyMap = new Map();

  for (const row of factRows) {
    const key = row.fact_date;

    if (!dailyMap.has(key)) {
      const weekdayNum = new Date(row.fact_date).getDay();

      dailyMap.set(key, {
        fact_date: row.fact_date,
        weekday_num: weekdayNum,
        total_too: 0,
        total_gc: 0
      });
    }

    const current = dailyMap.get(key);
    current.total_too += Number(row.too) || 0;
    current.total_gc += Number(row.gc) || 0;
  }

  return Array.from(dailyMap.values()).sort((a, b) =>
    a.fact_date.localeCompare(b.fact_date)
  );
}

function buildWeekdayAverages(dailyTotals) {
  const weekdayMap = new Map();

  for (const day of dailyTotals) {
    if (!weekdayMap.has(day.weekday_num)) {
      weekdayMap.set(day.weekday_num, {
        sumToo: 0,
        count: 0
      });
    }

    const bucket = weekdayMap.get(day.weekday_num);
    bucket.sumToo += day.total_too;
    bucket.count += 1;
  }

  const result = new Map();

  for (const [weekdayNum, value] of weekdayMap.entries()) {
    result.set(weekdayNum, value.count > 0 ? value.sumToo / value.count : 0);
  }

  return result;
}

function buildHourlyWeekdayShares(factRows) {
  const weekdayHourMap = new Map();
  const weekdayDayTotals = new Map();

  for (const row of factRows) {
    const weekdayNum = new Date(row.fact_date).getDay();
    const hour = Number(row.fact_hour);
    const too = Number(row.too) || 0;

    if (!weekdayHourMap.has(weekdayNum)) {
      weekdayHourMap.set(weekdayNum, new Map());
    }

    if (!weekdayDayTotals.has(weekdayNum)) {
      weekdayDayTotals.set(weekdayNum, 0);
    }

    const hourMap = weekdayHourMap.get(weekdayNum);
    hourMap.set(hour, (hourMap.get(hour) || 0) + too);
    weekdayDayTotals.set(weekdayNum, weekdayDayTotals.get(weekdayNum) + too);
  }

  const sharesMap = new Map();

  for (const [weekdayNum, hourMap] of weekdayHourMap.entries()) {
    const total = weekdayDayTotals.get(weekdayNum) || 1;
    const normalized = new Map();

    for (let hour = 0; hour < 24; hour++) {
      const hourValue = hourMap.get(hour) || 0;
      normalized.set(hour, hourValue / total);
    }

    sharesMap.set(weekdayNum, normalized);
  }

  return sharesMap;
}

function buildHourlyWeekdayAvgChecks(factRows) {
  const weekdayHourMap = new Map();

  for (const row of factRows) {
    const weekdayNum = new Date(row.fact_date).getDay();
    const hour = Number(row.fact_hour);
    const too = Number(row.too) || 0;
    const gc = Number(row.gc) || 0;

    if (!weekdayHourMap.has(weekdayNum)) {
      weekdayHourMap.set(weekdayNum, new Map());
    }

    const hourMap = weekdayHourMap.get(weekdayNum);

    if (!hourMap.has(hour)) {
      hourMap.set(hour, {
        totalToo: 0,
        totalGc: 0
      });
    }

    const bucket = hourMap.get(hour);
    bucket.totalToo += too;
    bucket.totalGc += gc;
  }

  const result = new Map();

  for (const [weekdayNum, hourMap] of weekdayHourMap.entries()) {
    const avgCheckMap = new Map();

    for (let hour = 0; hour < 24; hour++) {
      const bucket = hourMap.get(hour) || { totalToo: 0, totalGc: 0 };
      const avgCheck = bucket.totalGc > 0 ? bucket.totalToo / bucket.totalGc : 0;
      avgCheckMap.set(hour, avgCheck);
    }

    result.set(weekdayNum, avgCheckMap);
  }

  return result;
}