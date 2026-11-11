(function () {
  "use strict";

  var Marking = globalThis.PracticeMarking;
  var pack = null;
  var attempts = Object.create(null);
  var view = { stationId: null, index: 0 };
  var resetArmed = false;
  var formMessage = "";
  var focusSelector = null;

  function attemptFor(id) {
    return Object.assign(Marking.emptyAttempt(), attempts[id] || {});
  }

  function stationById(id) {
    return pack.stations.find(function (station) {
      return station.id === id;
    }) || null;
  }

  function currentStation() {
    return view.stationId ? stationById(view.stationId) : null;
  }

  function currentQuestion() {
    var station = currentStation();
    if (!station) return null;
    return station.questions[view.index] || null;
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    var config = props || {};
    Object.keys(config).forEach(function (key) {
      var value = config[key];
      if (value == null || value === false) return;
      if (key === "text") {
        node.textContent = String(value);
      } else if ((key === "value" || key === "checked") && (tag === "input" || tag === "textarea")) {
        node[key] = key === "checked" ? true : String(value);
      } else {
        node.setAttribute(key, value === true ? "" : String(value));
      }
    });
    (children || []).forEach(function (child) {
      if (child) node.append(child);
    });
    return node;
  }

  function statusWord(question, state) {
    if (Marking.isTeacherItem(question) && state.outcome === "pending") return "待審閱";
    if (state.outcome === "unassisted") return "首次答對";
    if (state.outcome === "hinted") return "提示後";
    if (state.outcome === "incorrect") return "未答對";
    if (state.hintVisible && !state.locked) return "再試";
    return "尚未";
  }

  function stationDone(station) {
    var done = 0;
    station.questions.forEach(function (question) {
      var state = attempts[question.id];
      if (state && state.locked) done += 1;
    });
    return done;
  }

  function renderScoreboard() {
    var summary = Marking.summarise(pack, attempts);
    var writing = summary.writingPending > 0
      ? "已提交，請交教師審閱。（不計入熟練分數）"
      : "未提交（不計入熟練分數）";
    var resetControls = [
      el("button", {
        type: "button",
        id: "reset",
        class: "secondary",
        "data-action": "reset",
        text: "重新開始",
      }),
    ];
    if (resetArmed) {
      resetControls = [
        el("p", { id: "reset-prompt", text: "確定清除今次練習紀錄？清除後不能還原。" }),
        el("button", {
          type: "button",
          id: "reset-confirm",
          class: "danger",
          "data-action": "reset-confirm",
          text: "確定清除",
        }),
        el("button", {
          type: "button",
          id: "reset-cancel",
          class: "secondary",
          "data-action": "reset-cancel",
          text: "取消",
        }),
      ];
    }
    return el("section", { class: "card", id: "scoreboard" }, [
      el("h2", { text: "練習進度" }),
      el("p", { class: "score-note", text: "熟練分數只計算選擇題和填空題中、第一次就答對的題數。第一次答錯後看提示再答對，只計入「提示後答對」，不計入熟練分數。短寫作一律交教師審閱，不計入熟練分數。" }),
      el("p", {}, [
        document.createTextNode("熟練分數（首次答對）："),
        el("strong", { id: "count-unassisted", text: String(summary.unassisted) }),
        document.createTextNode(" / "),
        el("span", { id: "count-auto-total", text: String(summary.autoTotal) }),
      ]),
      el("p", {}, [
        document.createTextNode("提示後答對："),
        el("strong", { id: "count-hinted", text: String(summary.hinted) }),
      ]),
      el("p", {}, [
        document.createTextNode("已用完機會仍未答對："),
        el("strong", { id: "count-incorrect", text: String(summary.incorrect) }),
      ]),
      el("p", {}, [
        document.createTextNode("自動評分題已完成："),
        el("strong", { id: "count-auto-done", text: String(summary.autoDone) }),
        document.createTextNode(" / "),
        el("span", { text: String(summary.autoTotal) }),
      ]),
      el("p", {}, [
        document.createTextNode("短寫作："),
        el("strong", { id: "writing-status", text: writing }),
      ]),
      el("div", { class: "stack" }, resetControls),
    ]);
  }

  function renderMenu() {
    var buttons = pack.stations.map(function (station) {
      var done = stationDone(station);
      return el("button", {
        type: "button",
        id: "open-" + station.id,
        "data-action": "open-station",
        "data-station": station.id,
        text: station.title_zh + "（" + done + "/" + station.questions.length + "）",
      });
    });
    return el("section", { class: "card", id: "station-menu" }, [
      el("h2", { text: "選擇關卡" }),
      el("p", { text: "建議由第一關順序練習。你也可以先開啟任何一關。後面的關卡會用到前面學過的意思。" }),
      el("div", { class: "stack", id: "station-list" }, buttons),
    ]);
  }

  function renderJumpList(station) {
    var buttons = station.questions.map(function (question, index) {
      var state = attemptFor(question.id);
      var label = (index + 1) + " " + statusWord(question, state);
      return el("button", {
        type: "button",
        id: "goto-" + question.id,
        class: "secondary",
        "data-action": "goto",
        "data-qid-target": question.id,
        "aria-label": "第 " + (index + 1) + " 題，" + statusWord(question, state),
        "aria-current": index === view.index ? "true" : null,
        text: label,
      });
    });
    return el("div", {}, [
      el("h3", { text: "跳到題目" }),
      el("div", { class: "qnav" }, buttons),
    ]);
  }

  function renderAnswerForm(question, state) {
    var locked = state.locked;
    var submitLabel = "提交";
    if (locked && Marking.isTeacherItem(question)) submitLabel = "已提交";
    else if (locked) submitLabel = "已完成作答";
    else if (state.attempts > 0) submitLabel = "再次提交";

    var fields = [];
    if (question.type === "mcq") {
      var options = (question.options || []).map(function (option) {
        return el("label", { class: "option" }, [
          el("input", {
            type: "radio",
            name: "choice",
            value: option.id,
            checked: state.optionId === option.id,
            disabled: locked,
          }),
          el("span", { text: option.text }),
        ]);
      });
      fields.push(el("fieldset", {}, [
        el("legend", { text: "請選擇一個答案。" }),
        el("div", { id: "options" }, options),
      ]));
    } else if (question.type === "gap") {
      fields.push(el("label", { for: "gap-answer", text: "你的答案" }));
      fields.push(el("input", {
        id: "gap-answer",
        type: "text",
        lang: "en-GB",
        value: state.text || "",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false",
        enterkeyhint: "done",
        disabled: locked,
      }));
    } else if (question.type === "teacher_review") {
      fields.push(el("label", { for: "writing-answer", text: "你的短文（2 至 3 個完整英文句子）" }));
      fields.push(el("textarea", {
        id: "writing-answer",
        lang: "en-GB",
        rows: "6",
        autocomplete: "off",
        autocapitalize: "sentences",
        spellcheck: "true",
        disabled: locked,
      }));
    } else {
      fields.push(el("p", { text: "此題沒有可供作答的格式。" }));
    }

    fields.push(el("button", {
      type: "submit",
      id: "submit",
      disabled: locked || (question.type !== "mcq" && question.type !== "gap" && question.type !== "teacher_review"),
      text: submitLabel,
    }));

    return el("form", { id: "answer-form", autocomplete: "off" }, fields);
  }

  function renderResult(question, state) {
    var blocks = [];
    if (formMessage) {
      blocks.push(el("p", { id: "form-message", role: "alert", text: formMessage }));
    }
    if (state.rejected === "sentence_count") {
      var count = state.sentenceCount;
      var sentenceMessage = count < 0
        ? "最後還有未完成的句子。請寫 2 至 3 個完整英文句子，每句以英文句號（.）、問號（?）或感嘆號（!）結尾。此題不會自動評分。"
        : "現時計算到 " + count + " 個完整句子。請寫 2 至 3 個完整英文句子，每句以英文句號（.）、問號（?）或感嘆號（!）結尾。此題不會自動評分。";
      blocks.push(el("div", { class: "result-retry", id: "writing-help" }, [
        el("p", { text: sentenceMessage }),
      ]));
    }
    if (state.hintVisible && !state.locked) {
      blocks.push(el("section", { class: "hint", id: "hint-box" }, [
        el("h3", { text: "提示" }),
        el("p", { id: "hint-text", text: question.hints.first_error }),
        el("p", { text: "請再試一次。正確答案尚未公布。" }),
      ]));
    } else if (state.hintVisible && state.locked) {
      blocks.push(el("section", { class: "hint", id: "hint-box" }, [
        el("h3", { text: "提示" }),
        el("p", { id: "hint-text", text: question.hints.first_error }),
      ]));
    }
    if (state.outcome === "unassisted" || state.outcome === "hinted") {
      var goodLabel = state.outcome === "unassisted" ? "首次答對" : "提示後答對";
      blocks.push(el("section", { class: "result-good", id: "result-detail" }, [
        el("p", { id: "outcome", text: goodLabel }),
        el("p", { id: "correct-line", text: question.feedback.correct }),
        el("h3", { text: "說明" }),
        el("p", { id: "explanation", text: question.feedback.explanatory }),
      ]));
    } else if (state.outcome === "incorrect") {
      blocks.push(el("section", { class: "result-bad", id: "result-detail" }, [
        el("p", { id: "outcome", text: "兩次均未答對" }),
        el("h3", { text: "說明" }),
        el("p", { id: "explanation", text: question.feedback.explanatory }),
      ]));
    } else if (state.outcome === "pending") {
      blocks.push(el("section", { class: "result-pending", id: "result-detail" }, [
        el("p", { id: "outcome", text: "待教師審閱（不計入熟練分數）" }),
        el("p", { id: "correct-line", text: question.feedback.correct }),
        el("p", { text: "你提交的文字如下：" }),
        el("blockquote", { id: "submitted-writing", lang: "en-GB", text: state.text }),
        el("h3", { text: "說明" }),
        el("p", { id: "explanation", text: question.feedback.explanatory }),
      ]));
    }
    if (!blocks.length) return null;
    return el("div", { id: "result-region", tabindex: "-1", "aria-live": "polite" }, blocks);
  }

  function renderStation() {
    var station = currentStation();
    var question = currentQuestion();
    var state = attemptFor(question.id);
    var stemBlock = [
      el("p", { id: "direction", text: question.prompt_zh }),
    ];
    if (question.stimulus) {
      stemBlock.push(el("p", { id: "stimulus-label", text: "短句" }));
      stemBlock.push(el("blockquote", { id: "stimulus", lang: "en", text: question.stimulus }));
    }
    stemBlock.push(el("h3", { id: "stem", lang: "en", tabindex: "-1", text: question.prompt }));

    var writingField = null;
    var form = renderAnswerForm(question, state);
    if (question.type === "teacher_review") {
      writingField = form.querySelector("#writing-answer");
      if (writingField) writingField.value = state.text || "";
    }

    return el("article", { class: "card", "data-qid": question.id }, [
      el("h2", { text: station.title_zh }),
      el("p", { id: "station-intro", text: station.intro_zh }),
      el("p", {}, [
        document.createTextNode("題號："),
        el("strong", { id: "item-position", text: (view.index + 1) + "/" + station.questions.length }),
        document.createTextNode("（"),
        el("span", { id: "item-id", text: question.id }),
        document.createTextNode("）"),
      ]),
      el("p", {}, [
        document.createTextNode("本關已完成："),
        el("strong", { id: "station-done", text: stationDone(station) + "/" + station.questions.length }),
      ]),
      el("div", { id: "stem-block" }, stemBlock),
      form,
      renderResult(question, state),
      el("div", { class: "actions" }, [
        el("button", {
          type: "button",
          id: "prev-item",
          class: "secondary",
          "data-action": "prev",
          disabled: view.index === 0,
          text: "上一題",
        }),
        el("button", {
          type: "button",
          id: "next-item",
          class: "secondary",
          "data-action": "next",
          disabled: view.index >= station.questions.length - 1,
          text: "下一題",
        }),
        el("button", {
          type: "button",
          id: "back-to-menu",
          class: "secondary",
          "data-action": "menu",
          text: "返回關卡目錄",
        }),
      ]),
      renderJumpList(station),
    ]);
  }

  function render() {
    var app = document.getElementById("app");
    var pieces = [renderScoreboard()];
    pieces.push(view.stationId ? renderStation() : renderMenu());
    app.replaceChildren.apply(app, pieces);
    if (focusSelector) {
      var target = document.querySelector(focusSelector);
      if (target) target.focus();
      focusSelector = null;
    }
  }

  function showLoadError() {
    var app = document.getElementById("app");
    app.replaceChildren(el("p", {
      id: "load-error",
      text: "練習內容未能載入。請用網站方式開啟本頁（相對路徑），不要封鎖本機檔案讀取。",
    }));
  }

  function readDraft(question) {
    if (question.type === "mcq") {
      var selected = document.querySelector('input[name="choice"]:checked');
      return { optionId: selected ? selected.value : null, text: "" };
    }
    if (question.type === "gap") {
      var gap = document.getElementById("gap-answer");
      return { optionId: null, text: gap ? gap.value : "" };
    }
    if (question.type === "teacher_review") {
      var writing = document.getElementById("writing-answer");
      return { optionId: null, text: writing ? writing.value : "" };
    }
    return { optionId: null, text: "" };
  }

  function submitCurrent(event) {
    event.preventDefault();
    var question = currentQuestion();
    if (!question) return;
    var prev = attemptFor(question.id);
    if (prev.locked) return;
    var draft = readDraft(question);
    prev.text = draft.text;
    if (question.type === "mcq") prev.optionId = draft.optionId;
    attempts[question.id] = prev;
    formMessage = "";

    if (question.type === "mcq" && !draft.optionId) {
      formMessage = "請先選擇一個答案。";
      focusSelector = "#result-region";
      render();
      return;
    }
    if (question.type === "gap" && !String(draft.text || "").trim()) {
      formMessage = "請先填寫答案。";
      focusSelector = "#result-region";
      render();
      return;
    }
    if (question.type === "teacher_review" && !String(draft.text || "").trim()) {
      formMessage = "請先寫下 2 至 3 個完整句子。";
      focusSelector = "#result-region";
      render();
      return;
    }

    if (question.type === "teacher_review") {
      attempts[question.id] = Marking.applyWritingSubmission(prev, draft.text);
    } else if (question.type === "mcq" || question.type === "gap") {
      var marked = Marking.markAuto(question, {
        optionId: draft.optionId,
        text: draft.text,
      });
      var next = Marking.applyAutoAttempt(prev, marked.correct);
      next.text = draft.text;
      next.optionId = question.type === "mcq" ? draft.optionId : null;
      attempts[question.id] = next;
    }
    focusSelector = "#result-region";
    render();
  }

function persistDraft() {
  var question = currentQuestion();
  if (!question) return;
  var existing = attempts[question.id];
  if (existing && existing.locked) return;
  if (!document.getElementById("answer-form")) return;
  var draft = readDraft(question);
  var state = attemptFor(question.id);
  if (question.type === "mcq") state.optionId = draft.optionId;
  else state.text = draft.text;
  attempts[question.id] = state;
}

function openStation(stationId) {
  var station = stationById(stationId);
  if (!station) return;
  persistDraft();
  formMessage = "";
  resetArmed = false;
  view.stationId = stationId;
  view.index = 0;
  focusSelector = "#stem";
  render();
}

function gotoQuestion(qid) {
  var station = currentStation();
  if (!station) return;
  var index = station.questions.findIndex(function (question) {
    return question.id === qid;
  });
  if (index < 0) return;
  persistDraft();
  formMessage = "";
  view.index = index;
  focusSelector = "#stem";
  render();
}

function move(step) {
  var station = currentStation();
  if (!station) return;
  var nextIndex = view.index + step;
  if (nextIndex < 0 || nextIndex >= station.questions.length) return;
  persistDraft();
  formMessage = "";
  view.index = nextIndex;
  focusSelector = "#stem";
  render();
}

  function resetAll() {
    attempts = Object.create(null);
    view.stationId = null;
    view.index = 0;
    resetArmed = false;
    formMessage = "";
    focusSelector = null;
    render();
  }

  function onAppClick(event) {
    var target = event.target.closest("[data-action]");
    if (!target || !document.getElementById("app").contains(target)) return;
    var action = target.getAttribute("data-action");
    if (action === "open-station") openStation(target.getAttribute("data-station"));
    else if (action === "goto") gotoQuestion(target.getAttribute("data-qid-target"));
    else if (action === "next") move(1);
    else if (action === "prev") move(-1);
    else if (action === "menu") {
      persistDraft();
      formMessage = "";
      resetArmed = false;
      view.stationId = null;
      view.index = 0;
      focusSelector = null;
      render();
    } else if (action === "reset") {
      persistDraft();
      resetArmed = true;
      render();
    } else if (action === "reset-cancel") {
      resetArmed = false;
      render();
    } else if (action === "reset-confirm") {
      resetAll();
    }
  }

  function onAppSubmit(event) {
    if (event.target && event.target.id === "answer-form") {
      submitCurrent(event);
    }
  }

  function packIsUsable(data) {
    if (!data || !Array.isArray(data.stations) || data.stations.length !== 5) return false;
    var counts = data.stations.map(function (station) {
      return station.questions && station.questions.length;
    });
    return counts.join(",") === "8,7,8,7,7";
  }

  async function main() {
    var app = document.getElementById("app");
    if (!Marking) {
      app.textContent = "評分程式未能載入。";
      return;
    }
    app.addEventListener("click", onAppClick);
    app.addEventListener("submit", onAppSubmit);
    try {
      var url = new URL("data/online-exercises.json", window.location.href);
      var response = await fetch(url);
      if (!response.ok) throw new Error("load failed");
      pack = await response.json();
      if (!packIsUsable(pack)) throw new Error("pack rejected");
    } catch (err) {
      showLoadError();
      return;
    }
    render();
  }

  main();
})();
