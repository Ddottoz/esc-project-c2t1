const express = require('express');
const router = express.Router();
const Lookups = require('../models/lookups');

router.get('/schools', async (req, res) => {
    res.json(await Lookups.getAllSchools());
})

router.get('/centres', async (req, res) => {
    res.json(await Lookups.getAllCentres());
})

router.get('/teachers', async (req, res) => {
    const centreId = req.query.centreId ? Number(req.query.centreId) : undefined;
    res.json(await Lookups.getAllTeachers(centreId));
})

router.get('/programmes', async (req, res) => {
    res.json(await Lookups.getAllProgrammes());
})

module.exports = router;