import { Router } from 'express'
import db from '../../db/db.js'
import { resolveOwnerRoles } from '../../utils/roleResolver.js'

const router = Router()

router.get('/', (req, res) => {
  const { role } = req.query
  let users
  if (role != undefined) {
    users = db.prepare('SELECT * FROM users WHERE role = ? ORDER BY address').all(parseInt(role))
  } else {
    users = db.prepare('SELECT * FROM users ORDER BY address').all()
  }
  res.json({ count: users.length, users })
})

router.get('/:address', (req, res) => {
  const addr = req.params.address.toLowerCase()
  const user = db.prepare('SELECT * FROM users WHERE address = ?').get(addr)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})

router.get('/:address/products', async (req, res) => {
  const addr = req.params.address.toLowerCase()
  let rows = db.prepare(`SELECT p.*, u.role_name AS owner_role_name FROM products p LEFT JOIN users u ON LOWER(p.current_owner) = u.address WHERE LOWER(p.current_owner) = ? ORDER BY p.prod_id DESC`).all(addr)
  rows = await resolveOwnerRoles(rows)
  res.json({ address: addr, count: rows.length, products: rows })
})

export default router
