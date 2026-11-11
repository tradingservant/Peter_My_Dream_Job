"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Marking = require("../js/marking.js");

const root = path.join(__dirname, "..");
const pack = require("../data/online-exercises.json");

function questions() {
  return pack.stations.flatMap((station) => station.questions);
}

function byId(id) {
  const found = questions().find((question) => question.id === id);
  assert.ok(found, id);
  return found;
}

test("pack has 5 stations and 37 items in the corrected counts", () => {
  assert.equal(pack.meta.station_count, 5);
  assert.equal(pack.meta.question_count_core, 37);
  assert.deepEqual(
    pack.stations.map((station) => [station.id, station.order, station.questions.length, station.question_count]),
    [
      ["S1", 1, 8, 8],
      ["S2", 2, 7, 7],
      ["S3", 3, 8, 8],
      ["S4", 4, 7, 7],
      ["S5", 5, 7, 7],
    ],
  );
  const ids = questions().map((question) => question.id);
  assert.equal(ids.length, 37);
  assert.equal(new Set(ids).size, 37);
  assert.deepEqual(ids.slice(0, 8), Array.from({ length: 8 }, (_, i) => `S1-Q${String(i + 1).padStart(2, "0")}`));
  assert.deepEqual(ids.slice(8, 15), Array.from({ length: 7 }, (_, i) => `S2-Q${String(i + 1).padStart(2, "0")}`));
  assert.deepEqual(ids.slice(15, 23), Array.from({ length: 8 }, (_, i) => `S3-Q${String(i + 1).padStart(2, "0")}`));
  assert.deepEqual(ids.slice(23, 30), Array.from({ length: 7 }, (_, i) => `S4-Q${String(i + 1).padStart(2, "0")}`));
  assert.deepEqual(ids.slice(30, 37), Array.from({ length: 7 }, (_, i) => `S5-Q${String(i + 1).padStart(2, "0")}`));
});

test("every item keeps stem, hint, and feedback fields", () => {
  const gapIds = [];
  const mcqIds = [];
  const teacherIds = [];
  for (const question of questions()) {
    assert.equal(typeof question.prompt, "string");
    assert.ok(question.prompt.length > 0);
    assert.equal(typeof question.prompt_zh, "string");
    assert.ok(question.prompt_zh.length > 0);
    assert.equal(typeof question.hints.first_error, "string");
    assert.ok(question.hints.first_error.length > 0);
    assert.equal(typeof question.feedback.correct, "string");
    assert.equal(typeof question.feedback.explanatory, "string");
    assert.ok(question.feedback.explanatory.length > 0);
    if (question.type === "mcq") {
      mcqIds.push(question.id);
      assert.ok(Array.isArray(question.options));
      assert.ok(question.options.length >= 2);
      assert.ok(question.options.some((option) => option.id === question.correct_option_id));
      const correct = question.options.find((option) => option.id === question.correct_option_id);
      assert.notEqual(question.hints.first_error.trim(), correct.text.trim());
      if (correct.text.length >= 8) {
        assert.equal(question.hints.first_error.includes(correct.text), false, question.id);
      }
    } else if (question.type === "gap") {
      gapIds.push(question.id);
      assert.ok(question.accepted_answers.length > 0);
    } else if (question.type === "teacher_review") {
      teacherIds.push(question.id);
      assert.equal(question.teacher_review, true);
      assert.deepEqual(question.accepted_answers, []);
    } else {
      assert.fail(`unexpected type ${question.type}`);
    }
  }
  assert.deepEqual(gapIds, ["S1-Q06", "S2-Q02", "S3-Q05", "S3-Q06", "S3-Q07", "S4-Q06"]);
  assert.deepEqual(teacherIds, ["S5-Q07"]);
  assert.equal(mcqIds.length, 30);
  assert.equal(byId("S5-Q07").feedback.correct, "已提交，請交教師審閱。");
  assert.equal(byId("S5-Q07").marks, 3);
  assert.match(byId("S5-Q07").accept_notes, /範例／教師用/);
  const raw = fs.readFileSync(path.join(root, "data/online-exercises.json"), "utf8");
  assert.equal(raw.includes("computer programs"), true);
  assert.equal(raw.includes("programmes"), false);
  assert.equal(raw.includes("footballer"), true);
});

test("multiple choice uses only correct_option_id", () => {
  for (const question of questions()) {
    if (question.type !== "mcq") continue;
    for (const option of question.options) {
      const marked = Marking.markAuto(question, { optionId: option.id, text: option.text });
      assert.equal(marked.counted, true);
      assert.equal(marked.correct, option.id === question.correct_option_id);
    }
    const correct = question.options.find((option) => option.id === question.correct_option_id);
    assert.equal(Marking.markAuto(question, { text: correct.text }).correct, false);
    assert.equal(Marking.markAuto(question, { optionId: question.correct_option_id.toLowerCase() }).correct, false);
    assert.equal(Marking.markAuto(question, { optionId: `${question.correct_option_id} ` }).correct, false);
  }
});

test("gap answers accept only listed strings after the stated normalisation", () => {
  for (const question of questions()) {
    if (question.type !== "gap") continue;
    for (const accepted of question.accepted_answers) {
      assert.equal(Marking.markAuto(question, { text: accepted }).correct, true);
      assert.equal(Marking.markAuto(question, { text: accepted.toUpperCase() }).correct, true);
      assert.equal(Marking.markAuto(question, { text: `  ${accepted.split(" ").join("   ")}  ` }).correct, true);
      assert.equal(Marking.markAuto(question, { text: `${accepted}.` }).correct, true);
      assert.equal(Marking.markAuto(question, { text: `${accepted}!` }).correct, true);
      assert.equal(Marking.markAuto(question, { text: `${accepted}!!` }).correct, false);
      assert.equal(Marking.markAuto(question, { text: accepted.replaceAll("'", "\u2019") }).correct, true);
      const expanded = accepted
        .replace(/\bI'll\b/g, "I will")
        .replace(/\bi'll\b/g, "i will")
        .replace(/\bshe'll\b/gi, "she will");
      const contracted = accepted
        .replace(/\bI will\b/g, "I'll")
        .replace(/\bi will\b/g, "i'll")
        .replace(/\bshe will\b/gi, "she'll");
      assert.equal(Marking.markAuto(question, { text: expanded }).correct, true);
      assert.equal(Marking.markAuto(question, { text: contracted }).correct, true);
      assert.equal(Marking.markAuto(question, { text: `${accepted} please` }).correct, false);
      if (accepted.length > 2) {
        assert.equal(Marking.markAuto(question, { text: accepted.slice(0, -1) }).correct, false);
      }
    }
  }

  const article = byId("S1-Q06");
  for (const ok of ["an", "AN", " an ", "An.", "an!", "An!"]) {
    assert.equal(Marking.markAuto(article, { text: ok }).correct, true, ok);
  }
  for (const bad of ["a", "the", "ann", "an architect", "", "an!!", "an?", "an。"]) {
    assert.equal(Marking.markAuto(article, { text: bad }).correct, false, bad);
  }

  const because = byId("S2-Q02");
  assert.equal(Marking.markAuto(because, { text: "Because." }).correct, true);
  assert.equal(Marking.markAuto(because, { text: "because I want to protect" }).correct, false);
  assert.equal(Marking.markAuto(because, { text: "so" }).correct, false);

  const jessica = byId("S3-Q05");
  for (const ok of [
    "she'll win",
    "she will win",
    "SHE WILL WIN.",
    "She’ll win!",
    "  she   will    win  ",
    "she\u00A0will\u00A0win",
    "I'LL".replace("I'LL", "she'll win"),
  ]) {
    assert.equal(Marking.markAuto(jessica, { text: ok }).correct, true, ok);
  }
  for (const bad of ["I will win", "I'll win", "he'll win", "he will win", "she'll wins", "she'll win a lot", "will win", "she wins"]) {
    assert.equal(Marking.markAuto(jessica, { text: bad }).correct, false, bad);
  }
  assert.notEqual(Marking.canonicalizeAnswer("he'll win"), Marking.canonicalizeAnswer("he will win"));
  assert.equal(Marking.canonicalizeAnswer("I'll win"), Marking.canonicalizeAnswer("I will win"));
  assert.equal(Marking.canonicalizeAnswer("She’ll win"), Marking.canonicalizeAnswer("she will win"));

  const tommy = byId("S3-Q06");
  assert.equal(Marking.markAuto(tommy, { text: "Write useful computer programs for children." }).correct, true);
  assert.equal(Marking.markAuto(tommy, { text: "write useful computer programs for kids" }).correct, true);
  assert.equal(Marking.markAuto(tommy, { text: "write useful computer programmes for kids" }).correct, false);
  assert.equal(Marking.markAuto(tommy, { text: "write computer programs for kids" }).correct, false);
  assert.notEqual(
    Marking.canonicalizeAnswer("write useful computer programs for kids"),
    Marking.canonicalizeAnswer("write useful computer programs for children"),
  );

  const flora = byId("S3-Q07");
  assert.equal(Marking.markAuto(flora, { text: "Help poor people in court!" }).correct, true);
  assert.equal(Marking.markAuto(flora, { text: "she'll help poor people in court" }).correct, false);
  assert.equal(Marking.markAuto(flora, { text: "help people in court" }).correct, false);

  const kathy = byId("S4-Q06");
  assert.equal(Marking.markAuto(kathy, { text: "BUSY!" }).correct, true);
  assert.equal(Marking.markAuto(kathy, { text: "quiet" }).correct, false);
  assert.equal(Marking.markAuto(kathy, { text: "busier" }).correct, false);
});

test("first result stays frozen and a hinted retry is not first-correct", () => {
  let state = Marking.applyAutoAttempt(null, false);
  assert.equal(state.firstResult, "incorrect");
  assert.equal(state.outcome, null);
  assert.equal(state.hintVisible, true);
  assert.equal(state.locked, false);

  state = Marking.applyAutoAttempt(state, true);
  assert.equal(state.firstResult, "incorrect");
  assert.equal(state.outcome, "hinted");
  assert.notEqual(state.outcome, "unassisted");
  assert.equal(state.locked, true);

  const kept = Marking.applyAutoAttempt(state, true);
  assert.equal(kept.outcome, "hinted");
  assert.equal(kept.firstResult, "incorrect");

  let missed = Marking.applyAutoAttempt(null, false);
  missed = Marking.applyAutoAttempt(missed, false);
  assert.equal(missed.outcome, "incorrect");
  assert.equal(missed.firstResult, "incorrect");
  const stillMissed = Marking.applyAutoAttempt(missed, true);
  assert.equal(stillMissed.outcome, "incorrect");
  assert.equal(stillMissed.firstResult, "incorrect");

  const clean = Marking.applyAutoAttempt(null, true);
  assert.equal(clean.outcome, "unassisted");
  assert.equal(clean.firstResult, "correct");
  assert.equal(clean.hintVisible, false);
  assert.equal(Marking.applyAutoAttempt(clean, false).outcome, "unassisted");
});

test("writing is pending review and never mastery", () => {
  const writing = byId("S5-Q07");
  const model = writing.accept_notes;
  assert.equal(Marking.markAuto(writing, { text: model }).counted, false);
  assert.equal(Marking.markAuto(writing, { text: model }).correct, false);
  assert.equal(Marking.markAuto(writing, { text: "I agree. Schools should teach coding." }).correct, false);

  assert.equal(Marking.countCompleteSentences("I agree."), 1);
  assert.equal(Marking.countCompleteSentences("I agree. Schools should teach coding."), 2);
  assert.equal(Marking.countCompleteSentences("I agree.\n\nSchools should teach coding!"), 2);
  assert.equal(Marking.countCompleteSentences("Should schools teach coding? I think they should. Students will need these skills!"), 3);
  assert.equal(Marking.countCompleteSentences("One. Two. Three. Four."), 4);
  assert.equal(Marking.countCompleteSentences("I agree. Schools should teach coding. extra"), -1);
  assert.equal(Marking.countCompleteSentences("   "), 0);

  let draft = Marking.applyWritingSubmission(null, "Only one sentence here.");
  assert.equal(draft.outcome, null);
  assert.equal(draft.locked, false);
  assert.equal(draft.rejected, "sentence_count");
  assert.equal(draft.firstResult, null);

  draft = Marking.applyWritingSubmission(draft, "I think schools should teach coding skills because I'll need them later. If schools teach coding skills, students will be ready for new jobs.");
  assert.equal(draft.outcome, "pending");
  assert.equal(draft.locked, true);
  assert.equal(draft.firstResult, null);
  assert.equal(draft.rejected, null);
  const frozen = Marking.applyWritingSubmission(draft, "A different answer. Still two sentences.");
  assert.equal(frozen.text, draft.text);
  assert.equal(frozen.outcome, "pending");

  const scored = Marking.summarise(pack, {
    "S1-Q01": { outcome: "unassisted", locked: true },
    "S1-Q02": { outcome: "hinted", locked: true },
    "S1-Q03": { outcome: "incorrect", locked: true },
    "S5-Q07": { outcome: "unassisted", locked: true },
  });
  assert.equal(scored.autoTotal, 36);
  assert.equal(scored.writingTotal, 1);
  assert.equal(scored.unassisted, 1);
  assert.equal(scored.hinted, 1);
  assert.equal(scored.incorrect, 1);
  assert.equal(scored.mastery, 1);
  assert.equal(scored.writingPending, 0);
  assert.equal(scored.autoDone, 3);
  assert.notEqual(scored.autoTotal + writing.marks, scored.mastery);

  const pending = Marking.summarise(pack, {
    "S5-Q07": { outcome: "pending", locked: true, text: draft.text },
  });
  assert.equal(pending.mastery, 0);
  assert.equal(pending.unassisted, 0);
  assert.equal(pending.writingPending, 1);
  assert.equal(pending.autoTotal, 36);
});

test("page source does not store answers or call remote services", () => {
  const files = ["index.html", "js/app.js", "js/marking.js", "css/practice.css"].map((file) =>
    fs.readFileSync(path.join(root, file), "utf8"),
  );
  const app = files[1];
  const combined = files.join("\n");
  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "serviceWorker",
    "document.cookie",
    "gtag",
    "google-analytics",
    "googletagmanager",
    "googleapis",
    "accept_notes",
    ".marks",
  ]) {
    assert.equal(combined.includes(forbidden), false, forbidden);
  }
  assert.equal(combined.includes("many jobs in the future will need computer skills"), false);
  assert.equal(combined.includes("範例／教師用"), false);
  assert.equal(app.includes('new URL("data/online-exercises.json", window.location.href)'), true);
  assert.equal(files[0].includes('href="/'), false);
  assert.equal(files[0].includes('src="/'), false);
  assert.match(files[0], /width=device-width/);
});
