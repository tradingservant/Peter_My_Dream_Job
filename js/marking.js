(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PracticeMarking = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CURLY_APOSTROPHE = /[\u2018\u2019\u201B\u02BC\uFF07]/g;

  function emptyAttempt() {
    return {
      attempts: 0,
      firstResult: null,
      outcome: null,
      hintVisible: false,
      locked: false,
      optionId: null,
      text: "",
      rejected: null,
      sentenceCount: null,
    };
  }

  function isTeacherItem(question) {
    return !question || question.teacher_review === true || question.type === "teacher_review";
  }

  function canonicalizeAnswer(raw) {
    var text = String(raw == null ? "" : raw);
    text = text.replace(CURLY_APOSTROPHE, "'");
    text = text.replace(/\s+/g, " ").trim();
    if (/[.!]$/.test(text)) {
      text = text.slice(0, -1).trim();
    }
    text = text.replace(/\s+/g, " ").trim().toLowerCase();
    text = text.replace(/\bi'll\b/g, "i will");
    text = text.replace(/\bshe'll\b/g, "she will");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function answersEquivalent(student, accepted) {
    if (typeof student !== "string" || typeof accepted !== "string") {
      return false;
    }
    if (student.trim() === "" || accepted.trim() === "") {
      return false;
    }
    return canonicalizeAnswer(student) === canonicalizeAnswer(accepted);
  }

  function markAuto(question, response) {
    var answer = response || {};
    if (isTeacherItem(question)) {
      return { mode: "teacher_review", correct: false, counted: false };
    }
    if (question.type === "mcq") {
      var optionId = typeof answer.optionId === "string" ? answer.optionId : "";
      return {
        mode: "mcq",
        correct: optionId === question.correct_option_id,
        counted: true,
      };
    }
    if (question.type === "gap") {
      var text = typeof answer.text === "string" ? answer.text : "";
      var accepted = Array.isArray(question.accepted_answers) ? question.accepted_answers : [];
      var correct = accepted.some(function (item) {
        return answersEquivalent(text, item);
      });
      return { mode: "gap", correct: correct, counted: true };
    }
    return { mode: "unknown", correct: false, counted: false };
  }

  function countCompleteSentences(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (!text) {
      return 0;
    }
    var pattern = /[^.!?]+[.!?]+/g;
    var consumed = 0;
    var count = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index !== consumed) {
        return -1;
      }
      var body = match[0].replace(/[.!?]+/g, "").trim();
      if (!body) {
        return -1;
      }
      count += 1;
      consumed = match.index + match[0].length;
    }
    if (text.slice(consumed).trim() !== "") {
      return -1;
    }
    return count;
  }

  function applyAutoAttempt(prev, correct) {
    var state = Object.assign(emptyAttempt(), prev || {});
    if (state.locked || state.attempts >= 2) {
      state.locked = true;
      return state;
    }
    if (state.attempts === 0) {
      state.attempts = 1;
      if (correct) {
        state.firstResult = "correct";
        state.outcome = "unassisted";
        state.hintVisible = false;
        state.locked = true;
      } else {
        state.firstResult = "incorrect";
        state.outcome = null;
        state.hintVisible = true;
        state.locked = false;
      }
      return state;
    }
    state.attempts = 2;
    state.firstResult = "incorrect";
    state.hintVisible = true;
    state.locked = true;
    state.outcome = correct ? "hinted" : "incorrect";
    return state;
  }

  function applyWritingSubmission(prev, text) {
    var state = Object.assign(emptyAttempt(), prev || {});
    if (state.locked) {
      return state;
    }
    var trimmed = String(text == null ? "" : text).trim();
    var count = countCompleteSentences(trimmed);
    state.text = trimmed;
    state.optionId = null;
    state.sentenceCount = count;
    state.hintVisible = false;
    state.firstResult = null;
    if (count < 2 || count > 3) {
      state.rejected = "sentence_count";
      state.outcome = null;
      state.locked = false;
      state.attempts = 0;
      return state;
    }
    state.rejected = null;
    state.outcome = "pending";
    state.locked = true;
    state.attempts = 1;
    return state;
  }

  function summarise(pack, stateById) {
    var summary = {
      autoTotal: 0,
      unassisted: 0,
      hinted: 0,
      incorrect: 0,
      open: 0,
      writingTotal: 0,
      writingPending: 0,
      mastery: 0,
      autoDone: 0,
    };
    var states = stateById || {};
    var stations = pack && Array.isArray(pack.stations) ? pack.stations : [];
    stations.forEach(function (station) {
      (station.questions || []).forEach(function (question) {
        var state = states[question.id] || {};
        if (isTeacherItem(question)) {
          summary.writingTotal += 1;
          if (state.outcome === "pending") {
            summary.writingPending += 1;
          }
          return;
        }
        summary.autoTotal += 1;
        if (state.outcome === "unassisted") summary.unassisted += 1;
        else if (state.outcome === "hinted") summary.hinted += 1;
        else if (state.outcome === "incorrect") summary.incorrect += 1;
        else summary.open += 1;
      });
    });
    summary.mastery = summary.unassisted;
    summary.autoDone = summary.unassisted + summary.hinted + summary.incorrect;
    return summary;
  }

  return {
    emptyAttempt: emptyAttempt,
    isTeacherItem: isTeacherItem,
    canonicalizeAnswer: canonicalizeAnswer,
    answersEquivalent: answersEquivalent,
    markAuto: markAuto,
    countCompleteSentences: countCompleteSentences,
    applyAutoAttempt: applyAutoAttempt,
    applyWritingSubmission: applyWritingSubmission,
    summarise: summarise,
  };
});
