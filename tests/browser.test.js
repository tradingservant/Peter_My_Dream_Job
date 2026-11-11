"use strict";

const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");
const puppeteer = require("puppeteer-core");
const pack = require("../data/online-exercises.json");

const root = path.join(__dirname, "..");
const prefix = "/Peter_My_Dream_Job";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    let rel = pathname === prefix ? "/" : pathname.slice(prefix.length);
    if (rel === "/" || rel.endsWith("/")) rel += "index.html";
    const filePath = path.resolve(root, `.${rel}`);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function questions() {
  return pack.stations.flatMap((station) => station.questions);
}

async function readText(page, selector) {
  const node = await page.$(selector);
  assert.ok(node, `missing ${selector}`);
  return page.$eval(selector, (element) => element.textContent);
}

async function openStation(page, stationId) {
  if (await page.$("#back-to-menu")) {
    await page.click("#back-to-menu");
  }
  await page.waitForSelector(`#open-${stationId}`);
  await page.click(`#open-${stationId}`);
  await page.waitForSelector(`[data-qid="${stationId}-Q01"]`);
}

async function gotoQuestion(page, qid) {
  await page.waitForSelector(`#goto-${qid}`);
  await page.click(`#goto-${qid}`);
  await page.waitForSelector(`[data-qid="${qid}"]`);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.textContent);
}

async function assertLayout(page, label, selectors) {
  const measurement = await page.evaluate((wanted) => {
    const fonts = {};
    for (const selector of wanted) {
      const element = document.querySelector(selector);
      if (!element) continue;
      fonts[selector] = Number.parseFloat(getComputedStyle(element).fontSize);
    }
    const viewWidth = document.documentElement.clientWidth;
    const offenders = [];
    for (const element of document.querySelectorAll("body *")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right > viewWidth + 1 || rect.left < -1) {
        offenders.push({
          tag: element.tagName,
          id: element.id,
          className: String(element.className),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        });
      }
    }
    return {
      fonts,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      offenders: offenders.slice(0, 8),
    };
  }, selectors);
  for (const [selector, size] of Object.entries(measurement.fonts)) {
    assert.ok(size >= 18, `${label} ${selector} font ${size}`);
  }
  assert.ok(
    measurement.scrollWidth <= measurement.clientWidth + 1,
    `${label} horizontal overflow ${measurement.scrollWidth} > ${measurement.clientWidth} ${JSON.stringify(measurement.offenders)}`,
  );
  assert.equal(measurement.offenders.length, 0, `${label} ${JSON.stringify(measurement.offenders)}`);
  return measurement;
}

async function main() {
  const requests = [];
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}${prefix}/`;
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const layout = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    page.on("request", (request) => requests.push(request.url()));
    await page.setViewport({ width: 414, height: 900, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: "networkidle0" });
    await page.waitForSelector("#station-menu");

    assert.equal(await page.$eval("html", (element) => element.lang), "zh-Hant");
    assert.match(await readText(page, "#persistence-notice"), /重新整理/);
    assert.match(await readText(page, "#persistence-notice"), /重新開始/);
    assert.match(await readText(page, "#persistence-notice"), /不會要求學生姓名或電郵/);
    const attributes = await page.$$eval("script, link[rel=stylesheet]", (elements) =>
      elements.map((element) => element.getAttribute("src") || element.getAttribute("href")),
    );
    for (const attribute of attributes) {
      assert.equal(attribute.startsWith("/"), false, attribute);
      assert.equal(/^https?:\/\//.test(attribute), false, attribute);
    }

    for (const station of pack.stations) {
      const label = `${station.title_zh}（0/${station.questions.length}）`;
      assert.equal(await readText(page, `#open-${station.id}`), label);
    }

    const seen = [];
    for (const station of pack.stations) {
      await openStation(page, station.id);
      assert.equal(await readText(page, "#station-intro"), station.intro_zh);
      for (let index = 0; index < station.questions.length; index += 1) {
        const question = station.questions[index];
        await page.waitForSelector(`[data-qid="${question.id}"]`);
        assert.equal(await readText(page, "#item-id"), question.id);
        assert.equal(await readText(page, "#item-position"), `${index + 1}/${station.questions.length}`);
        assert.equal(await readText(page, "#direction"), question.prompt_zh);
        assert.equal(await readText(page, "#stem"), question.prompt);
        assert.equal(await page.$eval("#stem", (element) => element.lang), "en");
        if (question.stimulus) {
          assert.equal(await readText(page, "#stimulus"), question.stimulus);
        } else {
          assert.equal(await page.$("#stimulus"), null);
        }
        if (question.type === "mcq") {
          const options = await page.$$eval("#options .option span", (nodes) => nodes.map((node) => node.textContent));
          assert.deepEqual(options, question.options.map((option) => option.text));
          assert.equal(await page.$("#hint-text"), null);
        } else if (question.type === "gap") {
          assert.ok(await page.$("#gap-answer"));
        } else {
          assert.ok(await page.$("#writing-answer"));
          assert.equal(await page.$("#hint-text"), null);
        }
        assert.equal((await bodyText(page)).includes(question.feedback.explanatory), false);
        seen.push(question.id);
        if (index < station.questions.length - 1) {
          await page.click("#next-item");
        }
      }
    }
    assert.deepEqual(seen, questions().map((question) => question.id));
    assert.equal(await readText(page, "#count-unassisted"), "0");
    assert.equal(await readText(page, "#count-hinted"), "0");
    assert.equal(await readText(page, "#count-auto-total"), "36");

    await page.reload({ waitUntil: "networkidle0" });
    await openStation(page, "S1");
    await page.click("#submit");
    assert.equal(await readText(page, "#form-message"), "請先選擇一個答案。");
    assert.equal(await page.$("#hint-text"), null);
    assert.equal(await readText(page, "#count-unassisted"), "0");

    const radios = await page.$$("#options input");
    assert.ok(radios.length >= 2);
    await radios[0].focus();
    await page.keyboard.press("Space");
    assert.equal(await page.$eval("#options input:checked", (element) => element.value), "A");
    await page.keyboard.press("Tab");
    const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assert.equal(focusedId, "submit");
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
    assert.notEqual(outline, "0px");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#hint-text");
    const first = pack.stations[0].questions[0];
    assert.equal(await readText(page, "#hint-text"), first.hints.first_error);
    assert.equal(await page.$("#explanation"), null);
    assert.equal((await bodyText(page)).includes("veterinary"), false);
    assert.match(await bodyText(page), /正確答案尚未公布/);
    assert.equal(await readText(page, "#count-unassisted"), "0");
    assert.equal(await readText(page, "#count-hinted"), "0");
    assert.equal(await page.$eval("#options input:checked", (element) => element.value), "A");
    const activeAfterHint = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assert.equal(activeAfterHint, "result-region");
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    const retryFocus = await page.evaluate(() => ({
      id: document.activeElement && document.activeElement.id,
      value: document.activeElement && document.activeElement.value,
      type: document.activeElement && document.activeElement.type,
    }));
    assert.equal(retryFocus.type, "radio", JSON.stringify(retryFocus));
    for (let step = 0; step < 4; step += 1) {
      const selected = await page.$eval("#options input:checked", (element) => element.value);
      if (selected === "B") break;
      await page.keyboard.press("ArrowDown");
    }
    assert.equal(await page.$eval("#options input:checked", (element) => element.value), "B");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#explanation");
    assert.equal(await readText(page, "#outcome"), "提示後答對");
    assert.notEqual(await readText(page, "#outcome"), "首次答對");
    assert.equal(await readText(page, "#correct-line"), first.feedback.correct);
    assert.equal(await readText(page, "#explanation"), first.feedback.explanatory);
    assert.equal((await bodyText(page)).includes("正確答案尚未公布"), false);
    assert.equal(await readText(page, "#count-unassisted"), "0");
    assert.equal(await readText(page, "#count-hinted"), "1");
    assert.equal(await page.$eval("#submit", (element) => element.disabled), true);

    await gotoQuestion(page, "S1-Q03");
    await page.click("#options input[value='A']");
    await page.click("#submit");
    await page.waitForSelector("#hint-text");
    assert.equal(await page.$("#explanation"), null);
    await page.click("#options input[value='A']");
    await page.click("#submit");
    await page.waitForSelector("#explanation");
    assert.equal(await readText(page, "#outcome"), "兩次均未答對");
    assert.equal(await page.$("#correct-line"), null);
    assert.equal(await readText(page, "#explanation"), pack.stations[0].questions[2].feedback.explanatory);
    assert.equal(await page.$eval("#options input:checked", (element) => element.value), "A");
    assert.equal(await readText(page, "#count-incorrect"), "1");
    assert.equal(await readText(page, "#count-unassisted"), "0");

    await gotoQuestion(page, "S1-Q06");
    await page.$eval("#gap-answer", (element) => {
      element.value = "   ";
    });
    await page.click("#submit");
    assert.equal(await readText(page, "#form-message"), "請先填寫答案。");
    assert.equal(await page.$("#hint-text"), null);
    await page.$eval("#gap-answer", (element) => {
      element.value = "a";
    });
    await page.click("#submit");
    await page.waitForSelector("#hint-text");
    assert.equal(await page.$("#explanation"), null);
    assert.equal(await readText(page, "#hint-text"), pack.stations[0].questions[5].hints.first_error);
    await page.$eval("#gap-answer", (element) => {
      element.value = "An.";
    });
    await page.click("#submit");
    await page.waitForSelector("#explanation");
    assert.equal(await readText(page, "#outcome"), "提示後答對");
    assert.equal(await page.$eval("#gap-answer", (element) => element.value), "An.");
    assert.equal(await readText(page, "#count-hinted"), "2");
    assert.equal(await readText(page, "#count-unassisted"), "0");

    await openStation(page, "S3");
    await gotoQuestion(page, "S3-Q05");
    await page.$eval("#gap-answer", (element) => {
      element.value = "I will win.";
    });
    await page.click("#submit");
    await page.waitForSelector("#hint-text");
    assert.equal(await page.$("#explanation"), null);
    await page.$eval("#gap-answer", (element) => {
      element.value = "She\u2019ll win!";
    });
    await page.click("#submit");
    await page.waitForSelector("#outcome");
    assert.equal(await readText(page, "#outcome"), "提示後答對");
    assert.equal(await readText(page, "#count-unassisted"), "0");

    await gotoQuestion(page, "S3-Q06");
    await page.$eval("#gap-answer", (element) => {
      element.value = "write useful computer programmes for kids";
    });
    await page.click("#submit");
    await page.waitForSelector("#hint-text");
    assert.equal((await bodyText(page)).includes(pack.stations[2].questions[5].feedback.explanatory), false);
    await page.$eval("#gap-answer", (element) => {
      element.value = "Write useful computer programs for children.";
    });
    await page.click("#submit");
    await page.waitForSelector("#explanation");
    assert.equal(await readText(page, "#outcome"), "提示後答對");

    await openStation(page, "S4");
    await gotoQuestion(page, "S4-Q06");
    await page.$eval("#gap-answer", (element) => {
      element.value = "BUSY!";
    });
    await page.click("#submit");
    await page.waitForSelector("#outcome");
    assert.equal(await readText(page, "#outcome"), "首次答對");
    assert.equal(await page.$("#hint-text"), null);
    const unassistedBeforeWriting = Number(await readText(page, "#count-unassisted"));
    assert.equal(unassistedBeforeWriting, 1);

    await openStation(page, "S5");
    await gotoQuestion(page, "S5-Q07");
    const writing = pack.stations[4].questions[6];
    await page.$eval("#writing-answer", (element) => {
      element.value = "I think schools should teach coding.";
    });
    await page.click("#submit");
    await page.waitForSelector("#writing-help");
    assert.equal(await page.$("#submitted-writing"), null);
    assert.match(await readText(page, "#writing-status"), /未提交/);
    assert.equal((await bodyText(page)).includes("範例／教師用"), false);
    const submitted = "I think schools should teach coding skills because I'll need them later. If schools teach coding skills, students will be ready for new jobs.";
    await page.$eval("#writing-answer", (element, value) => {
      element.value = value;
    }, submitted);
    await page.click("#submit");
    await page.waitForSelector("#submitted-writing");
    assert.equal(await readText(page, "#submitted-writing"), submitted);
    assert.equal(await readText(page, "#correct-line"), writing.feedback.correct);
    assert.equal(await readText(page, "#explanation"), writing.feedback.explanatory);
    assert.match(await readText(page, "#writing-status"), /已提交，請交教師審閱/);
    assert.match(await readText(page, "#writing-status"), /不計入熟練分數/);
    const afterWriting = await bodyText(page);
    assert.equal(afterWriting.includes("範例／教師用"), false);
    assert.equal(afterWriting.includes("many jobs in the future will need computer skills"), false);
    assert.equal(await readText(page, "#count-unassisted"), String(unassistedBeforeWriting));
    assert.equal(await page.$eval("#writing-answer", (element) => element.disabled), true);

    await page.setViewport({ width: 414, height: 900, deviceScaleFactor: 1 });
    layout.push({ width: 414, writing: await assertLayout(page, "414 writing", ["body", "button", "textarea", "label", "p"]) });
    await page.$eval("#writing-answer", (element) => {
      element.removeAttribute("disabled");
      element.value = "A".repeat(500);
    });
    layout.push({ width: 414, long: await assertLayout(page, "414 long writing", ["body", "textarea", "button"]) });
    await openStation(page, "S3");
    await gotoQuestion(page, "S3-Q04");
    layout.push({
      width: 414,
      options: await assertLayout(page, "414 options", ["body", "button", "label", ".option span", "h3", "legend"]),
    });
    await page.click("#back-to-menu");
    layout.push({ width: 414, menu: await assertLayout(page, "414 menu", ["body", "button", "p", "h1", "h2"]) });

    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    layout.push({ width: 1280, menu: await assertLayout(page, "1280 menu", ["body", "button", "p", "h1"]) });
    await openStation(page, "S3");
    await gotoQuestion(page, "S3-Q04");
    layout.push({
      width: 1280,
      options: await assertLayout(page, "1280 options", ["body", "button", "label", ".option span"]),
    });
    await openStation(page, "S5");
    await gotoQuestion(page, "S5-Q07");
    layout.push({ width: 1280, writing: await assertLayout(page, "1280 writing", ["body", "button", "textarea"]) });

    await openStation(page, "S1");
    const hintedBeforeReset = await readText(page, "#count-hinted");
    assert.notEqual(hintedBeforeReset, "0");
    await page.click("#reset");
    await page.waitForSelector("#reset-cancel");
    await page.click("#reset-cancel");
    assert.equal(await readText(page, "#count-hinted"), hintedBeforeReset);
    await page.click("#reset");
    await page.click("#reset-confirm");
    await page.waitForSelector("#station-menu");
    assert.equal(await readText(page, "#count-unassisted"), "0");
    assert.equal(await readText(page, "#count-hinted"), "0");
    assert.equal(await readText(page, "#count-incorrect"), "0");
    assert.match(await readText(page, "#writing-status"), /未提交/);
    assert.equal(await readText(page, "#open-S1"), "第一關：工作詞彙（0/8）");

    await openStation(page, "S2");
    await page.click("#options input[value='A']");
    await page.click("#submit");
    assert.equal(await readText(page, "#count-unassisted"), "1");
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector("#station-menu");
    assert.equal(await readText(page, "#count-unassisted"), "0");
    assert.equal(await readText(page, "#count-auto-done"), "0");
    const storage = await page.evaluate(async () => ({
      localLength: localStorage.length,
      sessionLength: sessionStorage.length,
      cookie: document.cookie,
      workers: (await navigator.serviceWorker.getRegistrations()).length,
      emailInputs: document.querySelectorAll('input[type="email"], input[type="password"]').length,
      namedIdentity: document.querySelectorAll('input[name="name"], input[name="email"], input[name="student"]').length,
      media: document.querySelectorAll("img, audio, video, iframe, embed, object").length,
    }));
    assert.deepEqual(storage, {
      localLength: 0,
      sessionLength: 0,
      cookie: "",
      workers: 0,
      emailInputs: 0,
      namedIdentity: 0,
      media: 0,
    });

    const foreign = requests.filter((url) => {
      const parsed = new URL(url);
      if (parsed.protocol === "data:") return false;
      if (parsed.hostname !== "127.0.0.1") return true;
      if (parsed.pathname === "/favicon.ico") return false;
      return !parsed.pathname.startsWith(`${prefix}/`);
    });
    assert.deepEqual(foreign, []);
    assert.ok(requests.some((url) => url.endsWith("/data/online-exercises.json")));

    console.log(JSON.stringify({
      base,
      itemsSeen: seen.length,
      stationCounts: pack.stations.map((station) => station.questions.length),
      layout: layout.map((entry) => ({
        width: entry.width,
        view: Object.keys(entry).find((key) => key !== "width"),
        scrollWidth: Object.values(entry).find((value) => value && value.scrollWidth)?.scrollWidth,
        clientWidth: Object.values(entry).find((value) => value && value.clientWidth)?.clientWidth,
        fonts: Object.values(entry).find((value) => value && value.fonts)?.fonts,
      })),
      requestCount: requests.length,
      sampleFonts: layout[0].writing.fonts,
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
