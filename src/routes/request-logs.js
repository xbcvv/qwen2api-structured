const express = require('express')
const router = express.Router()
const { adminKeyVerify } = require('../middlewares/authorization')
const { getRequestLogs } = require('../utils/request-log')

router.get('/request-logs', adminKeyVerify, (req, res) => {
  res.json(getRequestLogs(req.query || {}))
})

module.exports = router
