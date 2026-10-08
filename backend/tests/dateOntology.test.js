const { test } = require("node:test");
const assert = require("node:assert/strict");

const { parseSimplePeriod } = require("../src/services/travelIntentService");
const { normalizeDateText, parseDuration, sinoToNumber } = require("../src/services/dateExpressionService");

// 2026-10-01은 목요일이다. 이번 주 = 9/28(월) ~ 10/4(일).
const TODAY = new Date("2026-10-01T10:00:00");
const read = (input) => {
    const result = parseSimplePeriod(input, TODAY);
    if (!result) return null;
    return result.period || `start=${result.start_date} end=${result.end_date}`;
};
const check = (cases) => {
    for (const [input, expected] of cases) assert.equal(read(input), expected, input);
};

test("weekdays resolve against this week, next week, or a stated number of weeks", () => {
    check([
        ["토요일", "2026-10-03"],
        ["이번 토요일", "2026-10-03"],
        ["이번 주 토요일 당일치기", "2026-10-03"],
        ["다음주 토요일", "2026-10-10"],
        ["다음 토요일", "2026-10-10"],
        ["다다음주 토요일", "2026-10-17"],
        ["2주 후 토요일", "2026-10-17"],
        ["this saturday", "2026-10-03"],
        // 이미 지난 '이번 주 화요일'은 돌아오는 화요일이다.
        ["이번 주 화요일", "2026-10-06"],
    ]);
});

test("a weekday range reads the later weekday after the earlier one", () => {
    check([
        ["토요일부터 일요일까지", "2026-10-03 ~ 2026-10-04"],
        ["다음 주 월요일부터 수요일까지", "2026-10-05 ~ 2026-10-07"],
        ["다음 주 금요일부터 2박 3일", "2026-10-09 ~ 2026-10-11"],
        ["토요일 출발 1박", "2026-10-03 ~ 2026-10-04"],
        // 날짜 뒤에 붙인 요일은 같은 날을 다시 말한 것이다.
        ["10월 9일 금요일부터 일요일까지", "2026-10-09 ~ 2026-10-11"],
    ]);
});

test("weekends and runs of weekdays become whole ranges", () => {
    check([
        ["이번 주말", "2026-10-03 ~ 2026-10-04"],
        ["이번 주말 1박 2일", "2026-10-03 ~ 2026-10-04"],
        ["주말에 1박", "2026-10-03 ~ 2026-10-04"],
        ["주말 내내", "2026-10-03 ~ 2026-10-04"],
        ["다음 주말", "2026-10-10 ~ 2026-10-11"],
        ["next weekend", "2026-10-10 ~ 2026-10-11"],
        ["이번 주말 당일치기", "2026-10-03"],
        ["금토일", "2026-10-02 ~ 2026-10-04"],
        ["토일", "2026-10-03 ~ 2026-10-04"],
        ["다음 주 금토", "2026-10-09 ~ 2026-10-10"],
    ]);
});

test("days counted from today", () => {
    check([
        ["글피", "2026-10-04"],
        ["그글피", "2026-10-05"],
        // '내일모레'는 모레 하루다(내일~모레가 아니다).
        ["내일모레", "2026-10-03"],
        ["3일 뒤", "2026-10-04"],
        ["사흘 후", "2026-10-04"],
        ["일주일 뒤", "2026-10-08"],
        ["이틀 뒤부터 2박", "2026-10-03 ~ 2026-10-05"],
        ["in 3 days", "2026-10-04"],
        ["내일부터 일주일", "2026-10-02 ~ 2026-10-08"],
    ]);
});

test("days of the month without a month", () => {
    check([
        ["15일부터 17일까지", "2026-10-15 ~ 2026-10-17"],
        ["20일에 당일치기", "2026-10-20"],
        ["이번 달 20일", "2026-10-20"],
        ["다음달 10일", "2026-11-10"],
        // 오늘은 지난 날짜가 아니다.
        ["1일부터 2일까지", "2026-10-01 ~ 2026-10-02"],
        // 날짜인지 일수인지 모호한 '3일'은 읽지 않는다(LLM에 맡긴다).
        ["3일", null],
        ["2박 3일", null],
    ]);
    // 이미 지난 날짜는 다음 달이다.
    assert.equal(parseSimplePeriod("5일부터 6일까지", new Date("2026-10-20T10:00:00")).period, "2026-11-05 ~ 2026-11-06");
});

test("dates written in words or with a dash range", () => {
    check([
        ["시월 삼일", "2026-10-03"],
        ["10월 삼십일일", "2026-10-31"],
        ["십이월 이십오일", "2026-12-25"],
        ["10.3-10.5", "2026-10-03 ~ 2026-10-05"],
        // 공휴일 이름은 그대로 공휴일이다.
        ["삼일절", "2027-03-01"],
    ]);
    assert.equal(sinoToNumber("이십오"), 25);
    assert.equal(sinoToNumber("십"), 10);
    assert.equal(normalizeDateText("유월 오일"), "6월 5일");
});

test("partial answers keep only the side that was given", () => {
    check([
        ["토요일부터", "start=2026-10-03 end=null"],
        ["일요일까지", "start=null end=2026-10-04"],
        ["15일부터", "start=2026-10-15 end=null"],
    ]);
});

test("durations read nights, weeks and native numbers", () => {
    assert.equal(parseDuration("1박"), 2);
    assert.equal(parseDuration("2박 3일"), 3);
    assert.equal(parseDuration("일주일"), 7);
    assert.equal(parseDuration("2주 동안"), 14);
    // 날짜를 미는 말은 기간이 아니다.
    assert.equal(parseDuration("사흘 뒤"), null);
});

test("words that only look like dates are left alone", () => {
    check([
        ["수목원 가고 싶어", null],
        ["가평", null],
    ]);
});
