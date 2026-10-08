/**
 * ==========================================================
 * Date Ontology
 * ==========================================================
 *
 * 여행 날짜를 말할 때 쓰는 낱말과 그 뜻.
 * 낱말 → (오늘부터 며칠 뒤 / 무슨 요일 / 몇 주 뒤 / 며칠짜리)로 풀어 둔다.
 * 날짜 계산은 dateExpressionService가 이 표를 읽어서 한다.
 * ==========================================================
 */

// 오늘을 기준으로 며칠 뒤인지. 긴 말을 먼저 둔다('내일모레'를 '내일'로 읽지 않게).
// '내일모레'는 일상에서 '모레'를 뜻한다.
const RELATIVE_DAYS = [
    ["그글피", 4],
    ["내일모레", 2],
    ["낼모레", 2],
    ["글피", 3],
    ["모레", 2],
    ["내일", 1],
    ["오늘", 0],
];

const ENGLISH_RELATIVE_DAYS = [
    ["day after tomorrow", 2],
    ["tomorrow", 1],
    ["today", 0],
];

// 요일 → Date.getDay() 값
const WEEKDAYS = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

const ENGLISH_WEEKDAYS = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
};

// 몇 번째 주인지. 한 주는 월요일에 시작한다(한국 달력 기준).
// '다음 토요일'처럼 '주' 없이 말해도 같은 뜻으로 읽는다.
const WEEK_OFFSETS = [
    [/다다음\s*주|다담\s*주|다다음/, 2],
    [/다음\s*주|담\s*주|차주|다음/, 1],
    [/이번\s*주|이번|금주|요번\s*주|요번/, 0],
    [/\bweek\s+after\s+next\b/i, 2],
    [/\bnext\s+week\b|\bnext\b/i, 1],
    [/\bthis\s+week\b|\bthis\b/i, 0],
];

// 주말 / 평일
const WEEKEND_WORDS = /주말|\bweekend\b/i;

// 한자어 수 — '시월 삼일'처럼 숫자를 글로 쓴 날짜를 읽는다.
const SINO_DIGITS = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
// 소리가 바뀌는 달 이름
const MONTH_WORDS = { 시월: 10, 유월: 6 };

// 며칠짜리 여행인지(고유어·주 단위). '일주일 뒤'처럼 뒤에 '뒤/후'가 붙으면 기간이 아니라 날짜 이동이다.
const KOREAN_DURATIONS = [
    ["일주일", 7], ["한주", 7], ["보름", 15],
    ["열흘", 10], ["아흐레", 9], ["여드레", 8], ["이레", 7], ["엿새", 6],
    ["닷새", 5], ["나흘", 4], ["사흘", 3], ["이틀", 2], ["하루", 1],
];

// '사흘 뒤', '3일 후', '일주일 있다가'처럼 날짜를 미는 말
const AFTER_MARKER = "(?:뒤|후|있다가|지나서|이따가)";

// 날짜(며칠)가 아니라 기간·순서를 뜻하는 '일' — '3일간', '2일차', '3일 동안', '3일짜리'
const NOT_A_DAY_OF_MONTH = "(?:\\s*(?:간|동안|차|째|짜리|코스|정도|쯤\\s*(?:여행|일정))|\\s*" + AFTER_MARKER + ")";

// 하루만 다녀오는 여행
const DAY_TRIP_WORDS = /당일\s*치기|당일\s*여행|당일로|하루\s*만|\bday\s*trip\b/i;

module.exports = {
    RELATIVE_DAYS,
    ENGLISH_RELATIVE_DAYS,
    WEEKDAYS,
    ENGLISH_WEEKDAYS,
    WEEK_OFFSETS,
    WEEKEND_WORDS,
    SINO_DIGITS,
    MONTH_WORDS,
    KOREAN_DURATIONS,
    AFTER_MARKER,
    NOT_A_DAY_OF_MONTH,
    DAY_TRIP_WORDS,
};
