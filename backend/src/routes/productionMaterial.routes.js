const express = require('express');
const router = express.Router();
const productionMaterialController = require('../controllers/productionMaterial.controller');

router.get('/', productionMaterialController.getAllInwards);
router.get('/:id', productionMaterialController.getInwardById);
router.post('/', productionMaterialController.createInward);
router.put('/:id', productionMaterialController.updateInward);
router.delete('/:id', productionMaterialController.deleteInward);

router.patch('/:id/claim-product', productionMaterialController.claimProduct);
router.patch('/:id/product/:productId/report', productionMaterialController.updateProductReport);
router.patch('/:id/product/:productId/final-status', productionMaterialController.updateFinalStatus);

module.exports = router;
