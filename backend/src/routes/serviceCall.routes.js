const express = require('express');
const router  = express.Router();
const serviceCallController = require('../controllers/serviceCall.controller');

router.get('/sla-employees',     serviceCallController.getSLAEmployees);
router.get('/pending',           serviceCallController.getPendingAssignments);
router.get('/active',            serviceCallController.getActiveCalls);

// Support & Field Visit Routes
router.post('/support',          serviceCallController.createSupportRequest);
router.get('/support/:userId',   serviceCallController.getSupportRequests);
router.patch('/support/:id/resolve', serviceCallController.resolveSupportRequest);

router.post('/field-visit',      serviceCallController.createFieldVisit);
router.get('/field-visit/:userId', serviceCallController.getFieldVisits);
router.patch('/field-visit/:id/close', serviceCallController.closeFieldVisit);

router.patch('/:id/product/:pIdx/close', serviceCallController.closeProduct);

router.get('/',                  serviceCallController.getAllCalls);
router.post('/',                 serviceCallController.createCall);
router.post('/assign',           serviceCallController.assignServiceCall);
router.patch('/:id',             serviceCallController.updateCall);
router.delete('/:id',            serviceCallController.deleteCall);

module.exports = router;
