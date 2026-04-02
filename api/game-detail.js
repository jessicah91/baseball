const chromium = require('@sparticuz/chromium-min');
const { chromium: playwrightChromium } = require('playwright-core');
const { getTeam, formatKboDotDate } = require('./_lib/kbo');

async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  return playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true
  });
}

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function setTargetDate(page, targetLabel) {
  const heading = page.locator('text=/\d{4}\.\d{2}\.\d{2}\([^)]+\)/').first();
  for (let step = 0; step < 14; step += 1) {
    const current = normalize(await heading.textContent().catch(() => ''));
    if (current.includes(targetLabel)) return true;
    const currentKey = current.replace(/[^0-9]/g, '').slice(0, 8);
    const targetKey = targetLabel.replace(/[^0-9]/g, '').slice(0, 8);
    const arrows = await page.locator('button, a').evaluateAll((els) => els.map((el, idx) => ({
      idx,
      txt: (el.textContent || '').trim(),
      aria: el.getAttribute('aria-label') || '',
      cls: el.className || ''
    })));
    const arrowCandidates = arrows.filter((x) => /prev|next|이전|다음|arrow|btn/i.test(`${x.txt} ${x.aria} ${x.cls}`));
    const usePrev = currentKey > targetKey;
    if (arrowCandidates.length) {
      const pick = arrowCandidates[usePrev ? 0 : arrowCandidates.length - 1];
      await page.locator('button, a').nth(pick.idx).click({ force: true }).catch(() => null);
    } else {
      await page.keyboard.press(usePrev ? 'ArrowLeft' : 'ArrowRight').catch(() => null);
    }
    await page.waitForTimeout(700);
  }
  return false;
}

async function clickGameCard(page, venue, awayScore, homeScore) {
  const cards = await page.locator('div, li, a, button').all();
  for (const card of cards) {
    const text = normalize(await card.textContent().catch(() => ''));
    if (!text) continue;
    const venueOk = venue ? text.includes(venue) : true;
    const scoreOk = awayScore !== '' && homeScore !== '' ? (text.includes(String(awayScore)) && text.includes(String(homeScore))) : true;
    if (venueOk && scoreOk && /(경기종료|VS|vs|18:30|19:00)/.test(text)) {
      await card.click({ force: true }).catch(() => null);
      await page.waitForTimeout(900);
      return true;
    }
  }
  return false;
}

async function clickReviewTab(page) {
  await page.locator('text=리뷰').first().click({ force: true }).catch(() => null);
  await page.waitForTimeout(900);
}

async function extractWinningHit(page) {
  const row = page.locator('tr').filter({ hasText: '결승타' }).first();
  const cells = await row.locator('th,td').allTextContents().catch(() => []);
  if (cells.length >= 2) return normalize(cells.slice(1).join(' ')) || null;
  const text = normalize(await row.textContent().catch(() => ''));
  return text ? text.replace(/^결승타\s*/, '').trim() : null;
}

async function extractPitchersFromNamedSection(page, teamFullName) {
  const heading = page.locator(`text=${teamFullName} 투수 기록`).first();
  const table = heading.locator('xpath=following::table[1]').first();
  const rows = await table.locator('tr').all();
  const out = { win: [], loss: [], save: [], hold: [] };
  for (const row of rows) {
    const cols = (await row.locator('th,td').allTextContents().catch(() => [])).map(normalize).filter(Boolean);
    if (cols.length < 3) continue;
    if (cols[0] === '선수명' || cols.includes('TOTAL')) continue;
    const name = cols[0];
    const result = cols[2] || '';
    if (result.includes('승')) out.win.push(name);
    if (result.includes('패')) out.loss.push(name);
    if (result.includes('세')) out.save.push(name);
    if (result.includes('홀드')) out.hold.push(name);
  }
  return out;
}

module.exports = async (req, res) => {
  const date = String(req.query.date || '').trim();
  const venue = String(req.query.venue || '').trim().toUpperCase();
  const awayScore = String(req.query.awayScore || '').trim();
  const homeScore = String(req.query.homeScore || '').trim();
  const away = getTeam(req.query.away || 'LOTTE');
  const home = getTeam(req.query.home || 'NC');

  const payload = {
    source: 'kbo-gamecenter-review',
    date,
    away: away.code,
    home: home.code,
    venue,
    winningHit: null,
    winningPitcher: null,
    losingPitcher: null,
    savePitcher: null,
    holdPitchers: [],
    note: null,
    error: null
  };

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ locale: 'ko-KR' });
    await page.goto('https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1800);

    const targetLabel = formatKboDotDate(new Date(date));
    await setTargetDate(page, targetLabel);
    const clicked = await clickGameCard(page, venue, awayScore, homeScore);
    if (!clicked) throw new Error('게임센터에서 경기 카드를 찾지 못했어요.');

    await clickReviewTab(page);

    payload.winningHit = await extractWinningHit(page);
    const awayDetail = await extractPitchersFromNamedSection(page, away.koFull).catch(() => ({ win: [], loss: [], save: [], hold: [] }));
    const homeDetail = await extractPitchersFromNamedSection(page, home.koFull).catch(() => ({ win: [], loss: [], save: [], hold: [] }));
    const merged = {
      win: [...awayDetail.win, ...homeDetail.win],
      loss: [...awayDetail.loss, ...homeDetail.loss],
      save: [...awayDetail.save, ...homeDetail.save],
      hold: [...awayDetail.hold, ...homeDetail.hold]
    };

    payload.winningPitcher = merged.win[0] || null;
    payload.losingPitcher = merged.loss[0] || null;
    payload.savePitcher = merged.save[0] || null;
    payload.holdPitchers = merged.hold;
    payload.note = 'KBO 게임센터 리뷰 탭과 양팀 투수 기록 표 기준으로 읽어요.';
  } catch (error) {
    payload.error = error.message;
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  res.status(200).json(payload);
};
