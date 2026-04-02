const chromium = require('@sparticuz/chromium-min');
const { chromium: playwrightChromium } = require('playwright-core');
const { getTeam, TEAM_META, formatKboDotDate } = require('./_lib/kbo');

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
  for (let step = 0; step < 14; step += 1) {
    const heading = normalize(await page.locator('text=/\d{4}\.\d{2}\.\d{2}\([^)]+\)/').first().textContent().catch(() => ''));
    if (heading.includes(targetLabel)) return;
    const current = heading.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    const target = targetLabel.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!current || !target) break;
    const currentKey = `${current[1]}${current[2]}${current[3]}`;
    const targetKey = `${target[1]}${target[2]}${target[3]}`;
    const buttonIndex = currentKey > targetKey ? 0 : 1;
    await page.locator('button, a').filter({ hasText: /./ }).nth(buttonIndex).click({ force: true }).catch(() => null);
    await page.waitForTimeout(600);
  }
}

async function clickGameCard(page, awayKo, homeKo) {
  const cardCandidates = page.locator('div, li, a, button').filter({ hasText: awayKo }).filter({ hasText: homeKo });
  const count = await cardCandidates.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const card = cardCandidates.nth(i);
    const text = normalize(await card.textContent().catch(() => ''));
    if (text.includes(awayKo) && text.includes(homeKo)) {
      await card.click({ force: true }).catch(() => null);
      await page.waitForTimeout(700);
      return true;
    }
  }
  return false;
}

async function clickReviewTab(page) {
  await page.locator('text=리뷰').first().click({ force: true }).catch(() => null);
  await page.waitForTimeout(700);
}

async function extractWinningHit(page) {
  const row = page.locator('tr').filter({ hasText: '결승타' }).first();
  const text = normalize(await row.textContent().catch(() => ''));
  if (!text) return null;
  return text.replace(/^결승타\s*/, '').trim() || null;
}

async function extractPitchersFromTable(table) {
  const rows = await table.locator('tr').all();
  const detail = { win: [], loss: [], save: [], hold: [] };
  for (const row of rows) {
    const text = normalize(await row.textContent().catch(() => ''));
    if (!text || text.includes('선수명') || text.includes('TOTAL')) continue;
    const cols = text.split(' ');
    const name = cols[0] || '';
    if (/\b승\b/.test(text) || text.includes(' 승 ')) detail.win.push(name);
    if (/\b패\b/.test(text) || text.includes(' 패 ')) detail.loss.push(name);
    if (text.includes('세이브')) detail.save.push(name);
    if (text.includes('홀드')) detail.hold.push(name);
  }
  return detail;
}

module.exports = async (req, res) => {
  const date = String(req.query.date || '').trim();
  const away = getTeam(req.query.away || 'LOTTE');
  const home = getTeam(req.query.home || 'NC');

  const payload = {
    source: 'kbo-gamecenter-review',
    date,
    away: away.code,
    home: home.code,
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
    await page.waitForTimeout(1500);

    const targetLabel = formatKboDotDate(new Date(date));
    await setTargetDate(page, targetLabel);
    const clicked = await clickGameCard(page, away.koShort, home.koShort);
    if (!clicked) throw new Error('경기 카드를 찾지 못했어요.');

    await clickReviewTab(page);

    payload.winningHit = await extractWinningHit(page);

    const awayTable = page.locator(`text=${away.koFull} 투수 기록`).locator('..').locator('xpath=following-sibling::*[1]').first();
    const homeTable = page.locator(`text=${home.koFull} 투수 기록`).locator('..').locator('xpath=following-sibling::*[1]').first();

    const awayDetail = await extractPitchersFromTable(awayTable).catch(() => ({ win: [], loss: [], save: [], hold: [] }));
    const homeDetail = await extractPitchersFromTable(homeTable).catch(() => ({ win: [], loss: [], save: [], hold: [] }));
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
    payload.note = '리뷰 탭과 양팀 투수 기록 표 기준으로 읽어요.';
  } catch (error) {
    payload.error = error.message;
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  res.status(200).json(payload);
};
