const express = require("express");
const {
    getDestinations,
    postItinerary,
    postAssist,
    postTrip,
    getTripById,
    listTrips,
} = require("../controllers/plannerController");

const router = express.Router();

router.get("/destinations", getDestinations);
router.post("/itinerary", postItinerary);
router.post("/assist", postAssist);
router.get("/trips", listTrips);
router.post("/trips", postTrip);
router.get("/trips/:shareId", getTripById);

module.exports = router;
