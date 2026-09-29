const { findRankingByRegionMonth } = require("../repositories/attractionRepository");
const { fetchImageCandidates } = require("../services/tourApiImageService");
const { toHttps } = require("../utils/imageUrl");

const REGIONS = ["가평", "고양", "구리", "남양주", "동두천", "양주", "연천", "의정부", "파주", "포천"];

// 관광지 이미지는 DB 스냅샷 대신 TourAPI에서 가져오고, 없으면 카카오 이미지 검색으로 보충한다.
// 관광지 마스터와 매칭된 곳은 DB에 저장된 대표 사진을 먼저 쓰고(외부 호출 없음), 없을 때만 contentId로 찾는다.
// 매칭되지 않아 검색어(placeName)만 있는 곳은 이름으로 찾는다.
// 같은 목록에서 두 곳이 같은 사진을 쓰지 않도록, 순위가 높은 곳부터 아직 안 쓴 후보를 배정한다.
// (그래도 못 찾으면 프런트에서 카테고리별 대체 이미지를 쓴다.)
//
// 캐시가 빈 상태에서 외부 API를 기다리면 응답이 수십 초 걸릴 수 있어, 항목당 IMAGE_WAIT_MS까지만
// 기다린다. 늦은 조회는 백그라운드에서 끝나 캐시에 들어가므로 다음 요청부터 사진이 붙는다.
const IMAGE_WAIT_MS = 2500;

function withinBudget(promise) {
    return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve([]), IMAGE_WAIT_MS))]);
}

async function attachLiveImages(items, region) {
    const candidatesList = await Promise.all(items.map((item) => {
        if (item.attraction?.image) return [toHttps(item.attraction.image)];
        return withinBudget(
            item.attraction
                ? fetchImageCandidates({ contentId: item.attraction.contentId, name: item.attraction.title, region })
                : fetchImageCandidates({ name: item.name, region }),
        );
    }));

    const used = new Set();
    items.forEach((item, index) => {
        const image = candidatesList[index].find((candidate) => !used.has(candidate)) || null;
        if (image) used.add(image);
        if (item.attraction) {
            if (image) item.attraction.image = image;
            delete item.attraction.contentId;
        } else {
            item.image = image;
        }
    });
    return items;
}

async function getRanking(req, res) {
    const { region, year, month, limit } = req.query;

    if (!REGIONS.includes(region)) {
        return res.status(400).json({ success: false, message: "유효하지 않은 지역입니다." });
    }

    const parsedYear = Number.parseInt(year, 10);
    const parsedMonth = Number.parseInt(month, 10);
    if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        return res.status(400).json({ success: false, message: "유효하지 않은 연/월입니다." });
    }

    try {
        const items = await findRankingByRegionMonth({
            region,
            year: parsedYear,
            month: parsedMonth,
            limit: limit || 20,
        });
        await attachLiveImages(items, region);

        return res.json({
            success: true,
            data: { region, year: parsedYear, month: parsedMonth, items },
        });
    } catch (error) {
        console.error("Ranking Query Failed", error.message);
        return res.status(500).json({ success: false, message: "순위 정보를 불러오지 못했습니다." });
    }
}

module.exports = { getRanking, REGIONS };
