const {
    RELATIVE_DAYS,
    ENGLISH_RELATIVE_DAYS,
    WEEKDAYS,
    ENGLISH_WEEKDAYS,
    WEEK_OFFSETS,
    SINO_DIGITS,
    MONTH_WORDS,
    KOREAN_DURATIONS,
    AFTER_MARKER,
    NOT_A_DAY_OF_MONTH,
    DAY_TRIP_WORDS,
} = require("../ontology/dateOntology");
const { formatDate, startOfDay } = require("../utils/dateUtils");

/**
 * ==========================================================
 * Date Expression Service
 * ==========================================================
 *
 * dateOntology의 낱말로 '다음 주 금요일', '이번 주말', '사흘 뒤', '금토일',
 * '15일부터 17일까지' 같은 말을 실제 날짜로 바꾼다.
 *
 * 문장에서 날짜를 가리키는 말(mention)을 모두 찾아 순서대로 풀고,
 * 마지막에 '부터/까지'와 기간('2박 3일')을 더해 여행 기간을 만든다.
 * ==========================================================
 */

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function escape(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 그 주 월요일
function mondayOf(date) {
    const day = startOfDay(date);
    return addDays(day, -((day.getDay() + 6) % 7));
}

// date 이후(당일 포함) 처음 오는 그 요일
function nextWeekday(from, weekday) {
    const day = startOfDay(from);
    return addDays(day, (weekday - day.getDay() + 7) % 7);
}

// ---------- 글로 쓴 숫자 ----------

// '삼', '십오', '이십', '삼십일' → 3, 15, 20, 31
function sinoToNumber(word) {
    if (!word || /[^일이삼사오육륙칠팔구십]/.test(word)) return null;
    if (!word.includes("십")) return word.length === 1 ? SINO_DIGITS[word] : null;
    const [tens, ones, ...rest] = word.split("십");
    if (rest.length) return null;
    const tensValue = tens ? SINO_DIGITS[tens] : 1;
    const onesValue = ones ? SINO_DIGITS[ones] : 0;
    if (tensValue === undefined || onesValue === undefined || tens.length > 1 || ones.length > 1) return null;
    return tensValue * 10 + onesValue;
}

/**
 * 날짜 계산 전에 표기를 맞춘다.
 * - '시월 삼일', '10월 삼일' → '10월 3일'
 * - '10.3-10.5' → '10.3 ~ 10.5' (범위의 '-'를 날짜 구분자와 헷갈리지 않게)
 */
function normalizeDateText(text) {
    let value = String(text || "").normalize("NFC");

    for (const [word, month] of Object.entries(MONTH_WORDS)) {
        value = value.replace(new RegExp(`(?<![가-힣])${word}`, "g"), `${month}월`);
    }

    // 글로 쓴 달은 뒤에 날짜가 이어질 때만 읽는다('이월(移越)' 같은 말과 헷갈리지 않게).
    value = value.replace(
        /(?<![가-힣\d])([일이삼사오육칠팔구십]{1,3})\s*월(?=\s*(?:\d{1,2}|[일이삼사오육칠팔구십]{1,4})\s*일)/g,
        (match, word) => {
            const month = sinoToNumber(word);
            return month >= 1 && month <= 12 ? `${month}월` : match;
        },
    );

    value = value.replace(/(\d{1,2}\s*월\s*)([일이삼사오육칠팔구십]{1,4})(?=일)/g, (match, prefix, word) => {
        const day = sinoToNumber(word);
        return day >= 1 && day <= 31 ? `${prefix}${day}` : match;
    });

    value = value.replace(
        /(\d{1,2}\s*[./]\s*\d{1,2})\s*-\s*(\d{1,2}\s*[./]\s*\d{1,2})(?![\d./])/g,
        "$1 ~ $2",
    );

    return value;
}

// ---------- 기간 ----------

const DURATION_WORDS = KOREAN_DURATIONS.map(([word]) => escape(word)).join("|");
// '사흘 뒤', '3일 후', '2주 뒤', '일주일 있다가' — 기간이 아니라 날짜를 미는 말
const OFFSET_PATTERN = new RegExp(
    `(?:(\\d+)\\s*(일|주일|주)|(${DURATION_WORDS}))\\s*${AFTER_MARKER}`,
    "g",
);

const ENGLISH_NUMBER_WORDS = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseEnglishDuration(text) {
    const nightMatch = text.match(/(\d+)\s*nights?\s*(?:and\s*)?(\d+)\s*days?/i);
    if (nightMatch) return Number.parseInt(nightMatch[2], 10);

    const nightsOnly = text.match(/(\d+)\s*nights?/i);
    if (nightsOnly) return Number.parseInt(nightsOnly[1], 10) + 1;

    const weekMatch = text.match(/\b(a|one|two|\d+)\s*weeks?\b(?!\s*(?:later|from))/i);
    if (weekMatch) return 7 * (ENGLISH_NUMBER_WORDS[weekMatch[1].toLowerCase()] || Number(weekMatch[1]));

    // 'in 3 days', '3 days later'는 기간이 아니다.
    const dayMatch = text.match(/(?<!\bin\s)(\d+)\s*days?\b(?!\s*(?:later|from\s+now))/i);
    if (dayMatch) return Number.parseInt(dayMatch[1], 10);

    const wordMatch = text.match(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\b/i);
    if (wordMatch) return ENGLISH_NUMBER_WORDS[wordMatch[1].toLowerCase()];

    return null;
}

// '2박3일', '3일간', '일주일', '1박', 'two days'처럼 말한 일수를 읽는다.
function parseDuration(userMessage) {
    const original = String(userMessage || "").replace(OFFSET_PATTERN, " ");
    const text = original.replace(/\s/g, "");

    const nightMatch = text.match(/(\d+)박(\d+)일/);
    if (nightMatch) return Number.parseInt(nightMatch[2], 10);

    const dayMatch = text.match(/(\d+)일(?:동안|간)/);
    if (dayMatch) return Number.parseInt(dayMatch[1], 10);

    const weekMatch = text.match(/(\d+)주(?:일)?(?:동안|간)/);
    if (weekMatch) return Number.parseInt(weekMatch[1], 10) * 7;

    // '1박'만 말하면 이틀 일정이다.
    const nightsOnly = text.match(/(\d+)박(?!\d*일)/);
    if (nightsOnly) return Number.parseInt(nightsOnly[1], 10) + 1;

    const koreanDuration = KOREAN_DURATIONS.find(([word]) => text.includes(word));
    if (koreanDuration) return koreanDuration[1];

    return parseEnglishDuration(original);
}

// ---------- 날짜를 가리키는 말 찾기 ----------

// 앞에 붙은 '이번 주', '다음', '2주 뒤' 같은 말 → 몇 주 뒤인지
function weekOffsetBefore(text, index) {
    const before = text.slice(Math.max(0, index - 12), index);
    const weeksAfter = before.match(new RegExp(`(\\d+|한|두|세|네)\\s*주(?:일)?\\s*${AFTER_MARKER}\\s*$`));
    if (weeksAfter) {
        const count = { 한: 1, 두: 2, 세: 3, 네: 4 }[weeksAfter[1]] || Number(weeksAfter[1]);
        return { offset: count, length: weeksAfter[0].length };
    }
    for (const [pattern, offset] of WEEK_OFFSETS) {
        const match = before.match(new RegExp(`(?:${pattern.source})\\s*$`, pattern.flags));
        if (match) return { offset, length: match[0].length };
    }
    return null;
}

function weekdayDate(weekday, modifier, today) {
    if (!modifier) return null; // 앞 날짜를 기준으로 나중에 정한다
    let date = addDays(mondayOf(today), modifier.offset * 7 + ((weekday + 6) % 7));
    // '이번 화요일'을 목요일에 말하면 지난 화요일이 아니라 돌아오는 화요일이다.
    if (date < today) date = addDays(date, 7);
    return date;
}

const WEEKDAY_ORDER = "월화수목금토일";
// '금토일', '토일', '목금토일' — 이어지는 요일을 붙여 쓴 말
const WEEKDAY_RUNS = [];
for (let length = 4; length >= 2; length -= 1) {
    for (let start = 0; start + length <= WEEKDAY_ORDER.length; start += 1) {
        WEEKDAY_RUNS.push(WEEKDAY_ORDER.slice(start, start + length));
    }
}
const WEEKDAY_RUN_PATTERN = new RegExp(
    `(?<![가-힣])(${WEEKDAY_RUNS.join("|")})(?=$|[\\s,.!?~]|요일|에|로|으로|은|는|을|도|만|까지|부터)`,
    "g",
);

const RELATIVE_PATTERN = new RegExp(RELATIVE_DAYS.map(([word]) => escape(word)).join("|"), "g");
const ENGLISH_RELATIVE_PATTERN = new RegExp(
    `\\b(${ENGLISH_RELATIVE_DAYS.map(([word]) => word.replace(/ /g, "\\s+")).join("|")})\\b`,
    "gi",
);

// 오늘·내일·모레·글피… (기존 흐름에서도 쓴다)
function findRelativeDates(text) {
    const value = String(text || "");
    const found = [];
    for (const match of value.matchAll(RELATIVE_PATTERN)) {
        found.push({
            index: match.index,
            length: match[0].length,
            offset: RELATIVE_DAYS.find(([word]) => word === match[0])[1],
        });
    }
    for (const match of value.matchAll(ENGLISH_RELATIVE_PATTERN)) {
        const word = match[0].toLowerCase().replace(/\s+/g, " ");
        found.push({
            index: match.index,
            length: match[0].length,
            offset: ENGLISH_RELATIVE_DAYS.find(([phrase]) => phrase === word)[1],
        });
    }
    return found.sort((left, right) => left.index - right.index);
}

// 요일·주말·며칠 뒤·이번 달 며칠 같은, 기존 규칙이 읽지 못하던 말
const CALENDAR_KINDS = new Set(["weekday", "weekend", "weekdayRun", "offset", "monthDay", "dayOfMonth"]);

/**
 * 문장 속 날짜 표현을 모두 찾는다.
 * explicitDates: 이미 풀어 둔 'M월 D일' 날짜들 [{ index, length, start }]
 * 결과: 문장 순서대로 [{ kind, index, length, start, end? }]
 */
function findDateMentions(text, now, explicitDates = []) {
    const today = startOfDay(now);
    const raw = explicitDates.map((date) => ({ kind: "explicit", ...date }));

    for (const { index, length, offset } of findRelativeDates(text)) {
        raw.push({ kind: "relative", index, length, start: addDays(today, offset) });
    }

    // 사흘 뒤 · 3일 후 · 2주 뒤 · 일주일 있다가 (바로 뒤에 요일·주말이 오면 그쪽의 수식어다)
    for (const match of text.matchAll(OFFSET_PATTERN)) {
        const following = text.slice(match.index + match[0].length);
        if (/^\s*(?:[월화수목금토일]\s*요일|주말)/.test(following)) continue;
        const days = match[3]
            ? KOREAN_DURATIONS.find(([word]) => word === match[3])[1]
            : Number(match[1]) * (match[2] === "일" ? 1 : 7);
        raw.push({ kind: "offset", index: match.index, length: match[0].length, start: addDays(today, days) });
    }
    for (const match of text.matchAll(/\bin\s+(\d+|a|one|two|three)\s+(days?|weeks?)\b|\b(\d+)\s+(days?|weeks?)\s+(?:later|from\s+now)\b/gi)) {
        const count = ENGLISH_NUMBER_WORDS[(match[1] || match[3]).toLowerCase()] || Number(match[1] || match[3]);
        const unit = (match[2] || match[4]).toLowerCase().startsWith("week") ? 7 : 1;
        raw.push({ kind: "offset", index: match.index, length: match[0].length, start: addDays(today, count * unit) });
    }

    // 주말
    for (const match of text.matchAll(/주말|\bweekend\b/gi)) {
        const modifier = weekOffsetBefore(text, match.index);
        const monday = addDays(mondayOf(today), (modifier?.offset || 0) * 7);
        let start = addDays(monday, 5);
        const end = addDays(monday, 6);
        if (start < today) start = today; // 일요일에 '이번 주말'이면 오늘 하루
        const index = match.index - (modifier?.length || 0);
        raw.push({ kind: "weekend", index, length: match.index + match[0].length - index, start, end });
    }

    // 금토일 · 토일
    for (const match of text.matchAll(WEEKDAY_RUN_PATTERN)) {
        const modifier = weekOffsetBefore(text, match.index);
        const first = WEEKDAYS[match[1][0]];
        const start = weekdayDate(first, modifier || { offset: 0 }, today);
        const index = match.index - (modifier?.length || 0);
        raw.push({
            kind: "weekdayRun",
            index,
            length: match.index + match[0].length - index,
            start,
            end: addDays(start, match[1].length - 1),
        });
    }

    // 토요일 · 다음 주 금요일 · 2주 뒤 토요일 · this saturday
    const weekdayMatches = [
        ...[...text.matchAll(/([월화수목금토일])\s*(?:요일|욜)/g)].map((match) => ({ match, weekday: WEEKDAYS[match[1]] })),
        ...[...text.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)]
            .map((match) => ({ match, weekday: ENGLISH_WEEKDAYS[match[1].toLowerCase()] })),
    ];
    for (const { match, weekday } of weekdayMatches) {
        const modifier = weekOffsetBefore(text, match.index);
        const index = match.index - (modifier?.length || 0);
        raw.push({
            kind: "weekday",
            index,
            length: match.index + match[0].length - index,
            weekday,
            start: weekdayDate(weekday, modifier, today),
        });
    }

    // 이번 달 20일 · 다음 달 10일
    for (const match of text.matchAll(/(이번|다음|다다음)\s*달\s*(\d{1,2})\s*일/g)) {
        const months = { 이번: 0, 다음: 1, 다다음: 2 }[match[1]];
        const start = new Date(today.getFullYear(), today.getMonth() + months, Number(match[2]));
        if (start.getDate() !== Number(match[2])) continue; // 그달에 없는 날짜
        raw.push({ kind: "monthDay", index: match.index, length: match[0].length, start });
    }

    // 달 없이 말한 며칠 — '15일부터 17일까지', '20일에 당일치기'.
    // '3일간', '2박 3일', '3일 뒤', '1일차'는 날짜가 아니다. 뒤에 '에/부터/까지' 같은 말이 없으면
    // ('3일', '내일 3일') 날짜인지 일수인지 모호하니 읽지 않는다.
    const dayOfMonth = new RegExp(
        `(?<![\\d./\\-월박]\\s*)(?<![\\d])(\\d{1,2})\\s*일(?!${NOT_A_DAY_OF_MONTH})`
        + "(?=\\s*(?:에|부터|까지|~|-|날|하루|당일|출발|\\(|[월화수목금토일]\\s*요일))",
        "g",
    );
    for (const match of text.matchAll(dayOfMonth)) {
        const day = Number(match[1]);
        if (day < 1 || day > 31) continue;
        raw.push({ kind: "dayOfMonth", index: match.index, length: match[0].length, day, start: null });
    }

    // 같은 자리를 두 번 읽었으면 더 긴 쪽만 남긴다('다음 주 금요일' 안의 '다음 주' 등).
    const mentions = raw
        .sort((left, right) => left.index - right.index || right.length - left.length)
        .filter((mention, position, list) => !list.some((other, otherPosition) =>
            otherPosition !== position
            && other.index <= mention.index
            && other.index + other.length >= mention.index + mention.length
            && (other.length > mention.length || otherPosition < position)));

    // 앞 날짜를 기준으로 풀어야 하는 말(요일만, 며칠만)을 순서대로 정한다.
    const resolved = [];
    for (const mention of mentions) {
        const previous = resolved.at(-1);
        const anchor = previous ? (previous.end || previous.start) : today;

        if (mention.kind === "weekday" && !mention.start) {
            const date = nextWeekday(anchor, mention.weekday);
            // '10월 9일 금요일'처럼 앞 날짜의 요일을 덧붙인 말은 새 날짜가 아니다.
            if (previous && formatDate(date) === formatDate(previous.start) && !previous.end) continue;
            resolved.push({ ...mention, start: date });
            continue;
        }

        if (mention.kind === "dayOfMonth") {
            let date = new Date(anchor.getFullYear(), anchor.getMonth(), mention.day);
            if (date < startOfDay(anchor)) date = new Date(anchor.getFullYear(), anchor.getMonth() + 1, mention.day);
            if (date.getDate() !== mention.day) continue;
            resolved.push({ ...mention, start: date });
            continue;
        }

        resolved.push(mention);
    }

    return resolved;
}

function toPeriod(start, end) {
    const startText = formatDate(start);
    const endText = formatDate(end);
    return {
        period: startText === endText ? startText : `${startText} ~ ${endText}`,
        start_date: startText,
        end_date: endText,
    };
}

function partial({ start = null, end = null }) {
    return {
        period: null,
        start_date: start ? formatDate(start) : null,
        end_date: end ? formatDate(end) : null,
    };
}

/**
 * 찾은 날짜 표현과 '부터/까지', 기간을 합쳐 여행 기간을 만든다.
 * 요일·주말처럼 기존 규칙이 몰랐던 말이 없으면 null(기존 규칙에 맡긴다).
 */
function parseCalendarPeriod(text, now, explicitDates = []) {
    const mentions = findDateMentions(text, now, explicitDates);
    if (!mentions.some(({ kind }) => CALENDAR_KINDS.has(kind))) return null;

    const today = startOfDay(now);
    const duration = parseDuration(text);
    const dayTrip = DAY_TRIP_WORDS.test(text);

    if (mentions.length >= 2) {
        const first = mentions[0];
        const last = mentions.at(-1);
        const end = last.end || last.start;
        if (end < first.start || first.start < today) return null;
        return toPeriod(first.start, end);
    }

    const [mention] = mentions;
    if (mention.start < today) return null;
    const rest = `${text.slice(0, mention.index)} ${text.slice(mention.index + mention.length)}`;
    const until = /까지|\b(?:until|through)\b/i.test(rest);
    const from = /부터|\b(?:from|starting)\b/i.test(rest);

    if (mention.end) {
        if (dayTrip) return toPeriod(mention.start, mention.start);
        if (duration) return toPeriod(mention.start, addDays(mention.start, Math.max(1, duration) - 1));
        if (until && !from) return partial({ end: mention.end });
        return toPeriod(mention.start, mention.end);
    }

    if (until && !from) return partial({ end: mention.start });
    if (from && !until && !duration) return partial({ start: mention.start });
    const end = duration ? addDays(mention.start, Math.max(1, duration) - 1) : mention.start;
    return toPeriod(mention.start, end);
}

module.exports = {
    sinoToNumber,
    normalizeDateText,
    parseDuration,
    findRelativeDates,
    findDateMentions,
    parseCalendarPeriod,
};
