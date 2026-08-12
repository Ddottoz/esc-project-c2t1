const express = require('express');
const router = express.Router();
const Lookups = require('../models/lookups');

router.get('/schools', async (req, res) => {
    try {
        const schools = await Lookups.getAllSchools();
        res.json(schools || []);
    } catch(err) {
        console.error('Error fetching schools:', err);
        res.status(500).json({error: 'Failed to retrieve schools.'});
    }
})

router.get('/centres', async (req, res) => {
    try {
        const centres = await Lookups.getAllCentres();
        res.json(centres || []);
    } catch(err) {
        console.error('Error fetching centres:', err);
        res.status(500).json({error: 'Failed to retrieve centres.'});
    }
})

router.get('/educators', async (req, res) => {
    try {
        let centreId;
        
        if (req.query.centreId !== undefined && req.query.centreId !== '') {
            // Safe string conversion (handles array duplicates or strings)
            const rawVal = String(req.query.centreId).trim();
            centreId = parseInt(rawVal, 10);

            if (isNaN(centreId)) {
                return res.status(400).json({error: 'Invalid centreId provided.'});
            }
        }

        const educators = await Lookups.getAllEducators(centreId);
        res.json(educators || []);
    } catch(err) {
        console.error('Error fetching educators:', err);
        res.status(500).json({error: 'Failed to retrieve educators.'});
    }
})

router.get('/semesters', async (req, res) => {
    try {
        const semesters = await Lookups.getAllSemesters();
        res.json(semesters || []);
    } catch(err) {
        console.error('Error fetching semesters:', err);
        res.status(500).json({error: 'Failed to retrieve semesters.'});
    }
})

router.get('/bands', async (req, res) => {
    try {
        const bands = await Lookups.getAllBands();
        res.json(bands || []);
    } catch(err) {
        console.error('Error fetching bands:', err);
        res.status(500).json({error: 'Failed to retrieve bands.'});
    }
})

module.exports = router;