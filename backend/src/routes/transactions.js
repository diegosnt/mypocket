const { Router } = require('express');
const auth = require('../middlewares/auth');
const { getAll, create, update, remove, importRows, payCard } = require('../controllers/transactionController');

const router = Router();

router.use(auth);

router.get('/', getAll);
router.post('/', create);
router.post('/import', importRows);
router.post('/pay-card', payCard);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
