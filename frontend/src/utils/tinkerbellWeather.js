const MAX_WEATHER_AGE_MS = 20 * 60 * 1000;

const MESSAGES = {
  ko: {
    rain: (temp, name) =>
      `기상청 관측 기준 현재 ${temp}°C이고 비가 내리고 있어요. 메뉴 중 ${name} 어떠세요?`,
    snow: (temp, name) =>
      `기상청 관측 기준 현재 ${temp}°C이고 눈이 내리고 있어요. 메뉴 중 ${name} 어떠세요?`,
    cold: (temp, name) => `기상청 최신 관측 기준 현재 ${temp}°C예요. 오늘은 ${name} 어떠세요?`,
    hot: (temp, name) => `기상청 최신 관측 기준 현재 ${temp}°C예요. 오늘은 ${name} 어떠세요?`,
    mild: (temp, name) =>
      `기상청 최신 관측 기준 현재 ${temp}°C이고 강수는 관측되지 않았어요. ${name}을(를) 추천해요.`,
  },
  en: {
    rain: (temp, name) =>
      `The latest Korea Meteorological Administration observation is ${temp}°C with rain. How about ${name} from the menu?`,
    snow: (temp, name) =>
      `The latest Korea Meteorological Administration observation is ${temp}°C with snow. How about ${name} from the menu?`,
    cold: (temp, name) =>
      `The latest Korea Meteorological Administration observation is ${temp}°C. How about ${name} today?`,
    hot: (temp, name) =>
      `The latest Korea Meteorological Administration observation is ${temp}°C. How about ${name} today?`,
    mild: (temp, name) =>
      `The latest Korea Meteorological Administration observation is ${temp}°C, with no precipitation observed. We recommend ${name}.`,
  },
  ja: {
    rain: (temp, name) =>
      `気象庁の最新観測では現在${temp}°Cで、雨が降っています。メニューから${name}はいかがですか？`,
    snow: (temp, name) =>
      `気象庁の最新観測では現在${temp}°Cで、雪が降っています。メニューから${name}はいかがですか？`,
    cold: (temp, name) => `気象庁の最新観測では現在${temp}°Cです。今日は${name}はいかがですか？`,
    hot: (temp, name) => `気象庁の最新観測では現在${temp}°Cです。今日は${name}はいかがですか？`,
    mild: (temp, name) =>
      `気象庁の最新観測では現在${temp}°Cで、降水は観測されていません。${name}がおすすめです。`,
  },
  zh: {
    rain: (temp, name) => `韩国气象厅最新观测显示现在${temp}°C，正在下雨。菜单中的${name}怎么样？`,
    snow: (temp, name) => `韩国气象厅最新观测显示现在${temp}°C，正在下雪。菜单中的${name}怎么样？`,
    cold: (temp, name) => `韩国气象厅最新观测显示现在${temp}°C。今天试试${name}吧。`,
    hot: (temp, name) => `韩国气象厅最新观测显示现在${temp}°C。今天试试${name}吧。`,
    mild: (temp, name) => `韩国气象厅最新观测显示现在${temp}°C，目前未观测到降水。推荐${name}。`,
  },
  vi: {
    rain: (temp, name) =>
      `Quan trắc mới nhất của Cục Khí tượng Hàn Quốc là ${temp}°C và đang mưa. Bạn chọn ${name} trong thực đơn nhé?`,
    snow: (temp, name) =>
      `Quan trắc mới nhất của Cục Khí tượng Hàn Quốc là ${temp}°C và đang có tuyết. Bạn chọn ${name} nhé?`,
    cold: (temp, name) =>
      `Quan trắc mới nhất của Cục Khí tượng Hàn Quốc là ${temp}°C. Hôm nay bạn dùng ${name} nhé?`,
    hot: (temp, name) =>
      `Quan trắc mới nhất của Cục Khí tượng Hàn Quốc là ${temp}°C. Hôm nay bạn dùng ${name} nhé?`,
    mild: (temp, name) =>
      `Quan trắc mới nhất của Cục Khí tượng Hàn Quốc là ${temp}°C, chưa ghi nhận mưa. Gợi ý ${name}.`,
  },
  id: {
    rain: (temp, name) =>
      `Pengamatan terbaru KMA menunjukkan ${temp}°C dan sedang hujan. Bagaimana dengan ${name} dari menu?`,
    snow: (temp, name) =>
      `Pengamatan terbaru KMA menunjukkan ${temp}°C dan sedang turun salju. Bagaimana dengan ${name}?`,
    cold: (temp, name) =>
      `Pengamatan terbaru KMA menunjukkan ${temp}°C. Bagaimana dengan ${name} hari ini?`,
    hot: (temp, name) =>
      `Pengamatan terbaru KMA menunjukkan ${temp}°C. Bagaimana dengan ${name} hari ini?`,
    mild: (temp, name) =>
      `Pengamatan terbaru KMA menunjukkan ${temp}°C tanpa hujan. Kami merekomendasikan ${name}.`,
  },
  th: {
    rain: (temp, name) =>
      `ข้อมูลล่าสุดจากกรมอุตุนิยมวิทยาเกาหลีอยู่ที่ ${temp}°C และมีฝนตก รับ ${name} ไหมคะ?`,
    snow: (temp, name) =>
      `ข้อมูลล่าสุดจากกรมอุตุนิยมวิทยาเกาหลีอยู่ที่ ${temp}°C และมีหิมะตก รับ ${name} ไหมคะ?`,
    cold: (temp, name) =>
      `ข้อมูลล่าสุดจากกรมอุตุนิยมวิทยาเกาหลีอยู่ที่ ${temp}°C วันนี้รับ ${name} ไหมคะ?`,
    hot: (temp, name) =>
      `ข้อมูลล่าสุดจากกรมอุตุนิยมวิทยาเกาหลีอยู่ที่ ${temp}°C วันนี้รับ ${name} ไหมคะ?`,
    mild: (temp, name) =>
      `ข้อมูลล่าสุดจากกรมอุตุนิยมวิทยาเกาหลีอยู่ที่ ${temp}°C และไม่พบฝน ขอแนะนำ ${name}`,
  },
  ms: {
    rain: (temp, name) =>
      `Pemerhatian terkini KMA ialah ${temp}°C dan hujan sedang turun. Bagaimana dengan ${name} dalam menu?`,
    snow: (temp, name) =>
      `Pemerhatian terkini KMA ialah ${temp}°C dan salji sedang turun. Bagaimana dengan ${name}?`,
    cold: (temp, name) =>
      `Pemerhatian terkini KMA ialah ${temp}°C. Bagaimana dengan ${name} hari ini?`,
    hot: (temp, name) =>
      `Pemerhatian terkini KMA ialah ${temp}°C. Bagaimana dengan ${name} hari ini?`,
    mild: (temp, name) =>
      `Pemerhatian terkini KMA ialah ${temp}°C dan tiada hujan direkodkan. Kami syorkan ${name}.`,
  },
  tl: {
    rain: (temp, name) =>
      `Ayon sa pinakabagong obserbasyon ng KMA, ${temp}°C at umuulan. Gusto mo ba ng ${name} mula sa menu?`,
    snow: (temp, name) =>
      `Ayon sa pinakabagong obserbasyon ng KMA, ${temp}°C at umuulan ng niyebe. Gusto mo ba ng ${name}?`,
    cold: (temp, name) =>
      `Ayon sa pinakabagong obserbasyon ng KMA, ${temp}°C. Gusto mo ba ng ${name} ngayon?`,
    hot: (temp, name) =>
      `Ayon sa pinakabagong obserbasyon ng KMA, ${temp}°C. Gusto mo ba ng ${name} ngayon?`,
    mild: (temp, name) =>
      `Ayon sa pinakabagong obserbasyon ng KMA, ${temp}°C at walang naitalang ulan. Inirerekomenda namin ang ${name}.`,
  },
};

function isFreshObservation(weather, now = Date.now()) {
  if (!weather || weather.is_fallback === true || weather.source !== 'kma') return false;
  if (weather.temp === null || weather.temp === undefined || weather.temp === '') return false;
  if (!Number.isFinite(Number(weather.temp))) return false;
  const fetchedAt = Date.parse(weather.fetched_at);
  return (
    Number.isFinite(fetchedAt) && now - fetchedAt >= 0 && now - fetchedAt <= MAX_WEATHER_AGE_MS
  );
}

export function getLiveWeatherKind(weather, now = Date.now()) {
  if (!isFreshObservation(weather, now)) return null;
  const condition = String(weather.condition || '').toLowerCase();
  if (condition.includes('눈') || condition.includes('snow')) return 'snow';
  if (
    weather.isRaining === true ||
    Number(weather.rain) > 0 ||
    condition.includes('비') ||
    condition.includes('rain')
  )
    return 'rain';
  const temp = Number(weather.temp);
  if (temp <= 10) return 'cold';
  if (temp >= 28) return 'hot';
  return 'mild';
}

function getName(item, lang) {
  if (item?.name && typeof item.name === 'object') return item.name[lang] || item.name.ko || '';
  return typeof item?.name === 'string' ? item.name : '';
}

function isAvailable(item) {
  return (
    item &&
    item.isSoldOut !== true &&
    item.is_sold_out !== true &&
    item.available !== false &&
    item.is_available !== false
  );
}

function chooseMenu(kind, menuItems, lang) {
  const available = (Array.isArray(menuItems) ? menuItems : []).filter(isAvailable);
  if (!available.length) return null;
  const byWeather = available.filter((item) => {
    const searchable =
      `${getName(item, lang)} ${String(item.category_id || '')} ${String(item.category_name || '')}`.toLowerCase();
    if (kind === 'rain' || kind === 'snow' || kind === 'cold')
      return item.isHot === true || /따뜻|온차|국물|hot|warm/.test(searchable);
    if (kind === 'hot')
      return item.isCold === true || /ade|아이스|에이드|cold|ice/.test(searchable);
    return item.isPopular === true || item.is_popular === true;
  });
  return byWeather[0] || available[0];
}

export function buildWeatherAnnouncement(weather, menuItems, lang = 'ko', now = Date.now()) {
  const kind = getLiveWeatherKind(weather, now);
  if (!kind) return null;
  const recommendation = chooseMenu(kind, menuItems, lang);
  if (!recommendation) return null;
  const name = getName(recommendation, lang);
  if (!name) return null;
  const locale = MESSAGES[lang] || MESSAGES.ko;
  return {
    kind,
    temperature: Number(weather.temp),
    condition: String(weather.condition || ''),
    recommendation,
    text: locale[kind](Number(weather.temp), name),
  };
}

export { MAX_WEATHER_AGE_MS };
