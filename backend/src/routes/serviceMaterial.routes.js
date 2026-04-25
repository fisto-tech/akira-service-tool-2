const express = require('express');
const router = express.Router();
const serviceMaterialController = require('../controllers/serviceMaterial.controller');

router.get('/', serviceMaterialController.getAllInwards);
router.get('/:id', serviceMaterialController.getInwardById);
router.post('/', serviceMaterialController.createInward);
router.put('/:id', serviceMaterialController.updateInward);
router.delete('/:id', serviceMaterialController.deleteInward);
router.patch('/:id/claim-product', serviceMaterialController.claimProduct);
router.patch('/:id/report', serviceMaterialController.updateProductReport);

module.exports = router;
