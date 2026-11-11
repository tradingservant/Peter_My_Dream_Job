# 我的夢想工作——網上練習

Browser-only practice for Hong Kong P6 pupils, British school English, from the corrected Chapter 1 pack (*My dream job*, Longman English Leap 6A). The page is static HTML, CSS, and JavaScript. It does not log in, collect a name or email, upload answers, or store scores.

The attached specification said that building the site was out of scope during content preparation. This repository now implements that pack, as requested. Question stems, options, short stimuli, accepted answers, hints, feedback, and answer notes are the corrected `data/online-exercises.json` file. `docs/online-spec.md` is the same specification, unchanged.

## How a pupil uses it

Open `index.html` through a static web server so the exercise file can load. Paths are relative, so the same files work at a site root or under `/Peter_My_Dream_Job/` (the expected GitHub Pages path). Do not turn on Pages, change repository settings, or deploy from this project unless a teacher decides to later.

Directions and buttons are in formal Traditional Chinese. Questions and answers stay in British English. There are five stations and 37 items (8, 7, 8, 7, and 7). One item is on screen at a time. The station introduction stays above the question. Pupils can open stations in any order; the suggested order is station 1 to station 5.

The page keeps the current attempt in memory only. It does not use `localStorage`, `sessionStorage`, cookies, or a service worker. **Refreshing the page, closing it, or pressing「重新開始」clears the work.** Pupils should finish before they refresh.

## Marking

Auto-marked items are the multiple-choice and gap items (36 items, one mark each in the pack). The displayed mastery score counts only a correct **first** submit, before any hint.

- The first submit has no hint.
- A wrong first submit shows that item’s `hints.first_error` and allows one retry. It does not reveal the correct option yet.
- A correct retry is counted under「提示後答對」. It is not first-correct, and the first result stays incorrect.
- A second wrong submit shows `feedback.explanatory` and locks the item.
- A correct submit shows `feedback.correct` and `feedback.explanatory`.
- Multiple choice is marked only with `correct_option_id`.
- Gap answers are matched to `accepted_answers` only, after this normalisation: case is ignored, extra spaces are collapsed, one final `.` or `!` is ignored, and curly apostrophes are treated as straight apostrophes. `I'll` and `I will` match each other, and `she'll` and `she will` match each other. Other rewordings do not match. `kids` and `children` match only where both are listed (S3-Q06).

S5-Q07 is a 2–3 sentence writing item. The pack’s own feedback line is「已提交，請交教師審閱。」The page shows that line, the pupil’s text, and a pending state. It is not auto-marked and it is not mastery, even though the pack lists 3 marks for the teacher. The page checks only that there are two or three sentences ending in `.`, `?`, or `!`. It shows the submitted text and a pending state. The suggested model stays in the JSON `accept_notes` field, marked 範例／教師用. The page does not render that field and does not treat the model as the pupil’s answer.

## Answer keys

Correct option ids, accepted spellings, hints, feedback, and the teacher-only model are in `data/online-exercises.json`. Anyone who can open the page source can read them. This page is a practice activity, not an anti-cheating test.

## Tests

The page itself has no dependencies. Tests use Node.js and the Chrome already installed on the machine (`CHROME_PATH` overrides the default `/usr/bin/google-chrome`):

```bash
npm install
npm test
```

`tests/marking.test.js` checks the 37 items, station counts, option ids, accepted-answer variants, frozen first results, and the writing item. `tests/browser.test.js` serves the folder at `/Peter_My_Dream_Job/`, walks every item, and checks hint-then-retry, writing pending review, reset, reload, font size, and horizontal overflow at 414px and 1280px. It stops the browser and the test server when it finishes. The tests do not take screenshots.

## Limitations for content review

- Refreshing or resetting clears every station. Nothing is sent to a teacher. The pending writing text is only on that screen until refresh.
- Exactly one retry is offered on auto-marked items.
- A final full-width stop or comma is not removed. Only one ASCII `.` or `!` at the end is ignored.
- `I'll` / `I will` and `she'll` / `she will` are the only contraction pairs. `he'll` is not treated as `he will`.
- The writing check counts `.` `?` and `!`. Abbreviations such as `Mr.` can be counted as a sentence end. Grammar and ideas are not marked.
- Very short but punctuated 2–3 sentence replies are accepted as pending. The teacher still has to read them. There is no model score.
- Double-clicking `index.html` from a file folder may not load the JSON, because browsers often block that fetch. Use a static server or, later, Pages.
- The station is not stored in the URL. The browser Back button leaves the page.
- No audio, images, accounts, analytics, or deployment workflow are included.
