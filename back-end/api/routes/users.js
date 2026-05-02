import { Router } from 'express'
import db from '../../db/db.js'
import {resolveOwnerRoles} from '../../utils/roleResolver.js'
const router = Router()

router.get('/', (req, res) => {
  const {role} = req.query
  let userList
  if (role != undefined) {
    userList = db.prepare('SELECT * FROM users WHERE role = ? ORDER BY address').all(parseInt(role))
  } else {
    userList = db.prepare('SELECT * FROM users ORDER BY address').all()
  }

  res.json({ count: userList.length, users: userList })
})

router.get('/:address', (req, res) => {
  const address = req.params.address.toLowerCase()
  const user = db.prepare('SELECT * FROM users WHERE address = ?').get(address)

  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})


router.get('/:address/products', async (req, res) => {
  const addr =  req.params.address.toLowerCase()
  // tried filtering by role here but it got complicated, leaving as is for now
  let productRows = db.prepare(`SELECT p.*, u.role_name AS owner_role_name FROM products p LEFT JOIN users u ON LOWER(p.current_owner) = u.address WHERE LOWER(p.current_owner) = ? ORDER BY p.prod_id DESC`).all(addr)
  if (!productRows) productRows = []

  productRows = await resolveOwnerRoles(productRows)
  res.json({ address: addr, count: productRows.length, products: productRows })
})

export default router
