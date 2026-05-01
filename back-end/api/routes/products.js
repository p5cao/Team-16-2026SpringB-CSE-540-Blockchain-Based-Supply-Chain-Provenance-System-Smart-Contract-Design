import { Router } from 'express'
import db from '../../db/db.js'
import {resolveOwnerRoles} from '../../utils/roleResolver.js'

const router = Router()

// list all products, supports ?status=&owner=&limit=&offset=
router.get('/', async (req, res) => {
  let {status, owner, limit, offset} = req.query
  limit = limit ? parseInt(limit) : 50
  offset = offset ? parseInt(offset) : 0
  // TODO: add pagination headers maybe
  let where = ''
  let params = []

  if (status != undefined) {
    where = 'WHERE p.current_status = ?'
    params.push(parseInt(status))
  }
  if (owner) {
    where = where ? where+' AND LOWER(p.current_owner) = ?' : 'WHERE LOWER(p.current_owner) = ?'
    params.push(owner.toLowerCase())
  }

  const sql = `SELECT p.*, u.role_name AS owner_role_name FROM products p LEFT JOIN users u ON LOWER(p.current_owner) = u.address ${where} ORDER BY p.prod_id DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)
  const results = await resolveOwnerRoles(db.prepare(sql).all(...params))

  res.json({count: results.length, products: results })
})

router.get('/:prodId', (req, res) => {
  const prodID = parseInt(req.params.prodId)
  if (isNaN(prodID)) return res.status(400).json({ error: 'prodId must be an integer' })
  const product = db.prepare('SELECT * FROM products WHERE prod_id = ?').get(prodID)

  if (!product) return res.status(404).json({ error: 'Product not found' })
  res.json(product)
})


router.get('/:prodId/history/ownership', (req, res) => {
  let ownershipId = parseInt(req.params.prodId)
  if (isNaN(ownershipId)) return res.status(400).json({ error: 'prodId must be an integer' })
  const rows = db.prepare('SELECT * FROM ownership_history WHERE prod_id = ? ORDER BY block_number ASC').all(ownershipId)
  res.json({ prod_id: ownershipId, count: rows.length, history: rows })
})

router.get('/:prodId/history/status', (req, res) => {
  const id = parseInt(req.params.prodId)
  if (isNaN(id)) return res.status(400).json({ error: 'prodId must be an integer' })

  const history_rows = db.prepare('SELECT * FROM status_history WHERE prod_id = ? ORDER BY block_number ASC').all(id)
  res.json({prod_id: id, count: history_rows.length, history: history_rows })
})

export default router
