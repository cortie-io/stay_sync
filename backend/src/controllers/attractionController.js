const {
    findAttractionById,
    findMonthlyTrendByAttractionId,
    findNearbyAttractions,
} = require("../repositories/attractionRepository");
const { fetchAttractionDetail } = require("../services/attractionDetailService");
const { fetchImage, fetchImageCandidates } = require("../services/tourApiImageService");
const { getTourDetail } = require("../services/tourApiService");
const { toHttps } = require("../utils/imageUrl");

// 소개글은 부가 정보라 TourAPI가 느리면 기다리지 않고 없이 응답한다.
const DETAIL_WAIT_MS = 3000;

function withinBudget(promise) {
    return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), DETAIL_WAIT_MS))]);
}

async function getAttractionTrend(req, res) {
    const { id } = req.params;
    const year = Number.parseInt(req.query.year, 10) || new Date().getFullYear();

    const attraction = await findAttractionById(id);
    if (!attraction) {
        return res.status(404).json({ success: false, message: "관광지를 찾을 수 없습니다." });
    }

    const { monthly, category } = await findMonthlyTrendByAttractionId({ attractionId: id, year });
    const [liveImage, detail] = await Promise.all([
        // DB에 대표 사진이 있으면 외부 호출 없이 쓴다.
        attraction.firstImage
            ? toHttps(attraction.firstImage)
            : fetchImage({ contentId: attraction.contentId, name: attraction.title, region: attraction.region }),
        withinBudget(getTourDetail(attraction.contentId)),
    ]);

    return res.json({
        success: true,
        data: {
            attraction: {
                id: attraction.id,
                title: attraction.title,
                titleEn: attraction.titleEn,
                region: attraction.region,
                address: [attraction.address1, attraction.address2].filter(Boolean).join(" "),
                image: liveImage || toHttps(attraction.firstImage),
                indoorOutdoor: attraction.indoorOutdoor,
                mapx: attraction.mapx,
                mapy: attraction.mapy,
                // 한국관광공사 TourAPI 공식 소개글(overview)
                description: detail?.description || null,
            },
            category,
            year,
            monthly,
        },
    });
}

const CONTENT_TYPE_LABELS = {
    12: "관광지",
    14: "문화시설",
    15: "축제·공연·행사",
    25: "여행코스",
    28: "레포츠",
    32: "숙박",
    38: "쇼핑",
    39: "음식점",
};

const NEARBY_GROUPS = {
    attractions: ["12", "14", "15", "28"],
    restaurants: ["39"],
    stays: ["32"],
};

// 사진이 없는 주변 장소는 이름으로 찾아 채운다. 한 페이지 안에서 같은 사진이 반복되지 않게 이미 쓴 사진은 건너뛴다.
// 이 페이지가 기다리는 건 DETAIL_WAIT_MS까지이고, 늦은 조회는 캐시에 남아 다음 방문에 쓰인다.
async function fillNearbyImages(groups) {
    const rows = groups.flat();
    const candidates = await Promise.all(rows.map((row) => (
        row.firstImage
            ? Promise.resolve([row.firstImage])
            : withinBudget(fetchImageCandidates({ name: row.title, region: row.region })).then((list) => list || [])
    )));
    const used = new Set();
    rows.forEach((row, index) => {
        const image = candidates[index].find((candidate) => !used.has(candidate)) || null;
        if (image) used.add(image);
        row.firstImage = image;
    });
}

function toNearbyItem(row) {
    return {
        id: row.id,
        title: row.title,
        region: row.region,
        type: CONTENT_TYPE_LABELS[row.contentTypeId] || null,
        address: row.address1,
        image: toHttps(row.firstImage),
        mapx: row.mapx,
        mapy: row.mapy,
        distanceKm: Math.round(Number(row.distanceKm) * 10) / 10,
    };
}

// 상세 페이지용 부가 정보: TourAPI 이용 안내·추가 사진 + 주변 관광지·맛집·숙소
async function getAttractionDetail(req, res) {
    try {
        const attraction = await findAttractionById(req.params.id);
        if (!attraction) {
            return res.status(404).json({ success: false, message: "관광지를 찾을 수 없습니다." });
        }

        const nearbyQuery = (contentTypeIds) => findNearbyAttractions({
            attractionId: attraction.id,
            mapx: attraction.mapx,
            mapy: attraction.mapy,
            contentTypeIds,
        });

        const [detail, attractions, restaurants, stays] = await Promise.all([
            withinBudget(fetchAttractionDetail({
                contentId: attraction.contentId,
                contentTypeId: attraction.contentTypeId,
            })),
            nearbyQuery(NEARBY_GROUPS.attractions),
            nearbyQuery(NEARBY_GROUPS.restaurants),
            nearbyQuery(NEARBY_GROUPS.stays),
        ]);
        await fillNearbyImages([attractions, restaurants, stays]);

        return res.json({
            success: true,
            data: {
                id: attraction.id,
                contentType: CONTENT_TYPE_LABELS[attraction.contentTypeId] || null,
                titleEn: attraction.titleEn,
                indoorOutdoor: attraction.indoorOutdoor,
                tel: detail?.tel || attraction.telephone || null,
                telName: detail?.telName || null,
                homepage: detail?.homepage || null,
                zipCode: detail?.zipCode || attraction.zipCode || null,
                intro: detail?.intro || [],
                info: detail?.info || [],
                images: detail?.images || [],
                location: attraction.mapx && attraction.mapy ? { lng: attraction.mapx, lat: attraction.mapy } : null,
                nearby: {
                    attractions: attractions.map(toNearbyItem),
                    restaurants: restaurants.map(toNearbyItem),
                    stays: stays.map(toNearbyItem),
                },
            },
        });
    } catch (error) {
        console.error("Attraction Detail Failed", error.message);
        return res.status(500).json({ success: false, message: "관광지 상세 정보를 불러오지 못했습니다." });
    }
}

module.exports = { getAttractionTrend, getAttractionDetail };
