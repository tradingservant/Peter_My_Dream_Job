# Online practice specification — My Dream Job

This file describes **content and expected interaction only**. It does not require a score server, student accounts, or saved results. Any later marking or storage plan can be added separately.

## Purpose and audience

- Learner: Hong Kong P6, British school English.
- Source: Longman English Leap 6A, Chapter 1 *My dream job* (the scanned working pages only).
- Student-facing directions: formal Traditional Chinese.
- Questions, options and expected answers: British English.
- Recommended order: Station 1 → 5 (graduated). Stations may be opened in any order if the builder prefers, but the texts assume earlier ideas are useful later.

## Station map (5 stations, 37 items)

| Station | Title | Items | Focus |
|---------|--------|-------|--------|
| S1 | 工作詞彙 / Job words | 8 | Job titles and duties; *a/an*; suffixes for people; *firefighter* / *police officer* |
| S2 | 夢想工作與原因 / Dream jobs and reasons | 7 | *What do you want to be when you grow up?*; *I want to be … because …* |
| S3 | If 和 will / If and will | 8 | First conditional: *If* + present, *will* / *I’ll* + result |
| S4 | 閱讀理解 / Reading | 7 | Short magazine facts (Tammy, Ella, Lucas; Jobs around us) |
| S5 | 未來的工作與讀者來信 / Jobs in the future | 7 | Technology and jobs; letter greeting and purpose; 1 teacher-reviewed short writing |

Item IDs: `S1-Q01` … `S5-Q07`. Full stems, options, accepted answers, first-error hints and explanatory feedback are in `online-exercises.json`.

## Interaction

1. Show the station introduction (Chinese) before the first item.
2. Show one item at a time, or a short scrollable list; do not hide the stem when options appear.
3. **First attempt:** the student submits once with no hint visible.
4. **If the first attempt is wrong** (auto-marked items only): show the `hints.first_error` text, and allow at least one retry. Do not reveal the full correct option immediately in the hint.
5. After a correct answer, or after a final incorrect attempt, show the explanatory feedback.
6. A correct retry after a hint is **not** a “first-correct” result, if results are ever recorded later.
7. **S5-Q07** is `teacher_review`: accept 2–3 sentences, do **not** auto-mark, and do **not** treat submission as mastery. Show a state such as「已提交，請交教師審閱」. A model answer belongs in the teacher key only (範例／教師用).
8. Reading items already include the needed short sentence in the stem or `stimulus`. Do not paste long textbook pages into the screen.
9. No audio, no invented pictures, and no Chapter 2 / later-module grammar.
10. Navigation: allow moving to the next item after feedback; a simple station menu is enough. A progress count (e.g. 3/8) is helpful but optional.

## Auto-marking rules (if marking is added later)

- Case-insensitive; ignore extra inner spaces and a single final full stop or exclamation mark; normalise curly apostrophes to straight apostrophes.
- Accept *I’ll* and *I will*; *she’ll* and *she will*.
- Accept only the strings listed in `accepted_answers` (and the notes beside some items).
- Multiple-choice: use `correct_option_id` to mark the keyed option.
- Do not mark S5-Q07 automatically.

These rules are for a possible later build. This pack does **not** assume that scores must be stored.

## Language and accessibility

- British spelling in English text (*favourite*, *travelling*, *footballer*). Keep *computer programs* as in the chapter.
- Buttons and short system messages may be in Traditional Chinese, e.g.「提交」「下一題」「提示」「已提交，請交教師審閱」。
- Fonts should be clear on a tablet or laptop. Avoid a tiny type size for job words that P6 pupils still confuse (*architect*, *astronaut*, *firefighter*).

## Out of scope for this phase

- Building the website, a repository, or a deployment.
- Teacher login, class codes, or a results spreadsheet.
- Modifying unrelated existing materials.
