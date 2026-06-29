const { Router } = require('express');
const auth = require('../middlewares/auth');
const { getAll, create, update, remove } = require('../controllers/creditCardController');

const router = Router();

router.use(auth);

router.get('/', getAll);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
