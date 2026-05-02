import express from 'express'
import ProductsRouter from './routes/products.js'
import usersRouter from './routes/users.js'
import consumerRouter from './routes/consumer.js'

const app = express()
app.use(express.json())

// cors - needed so the frontend can talk to us
app.use((req,res,next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader( 'Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use('/api/products', ProductsRouter)
app.use('/api/users', usersRouter)
app.use('/api/consumer', consumerRouter)

app.use((req,res) => {
  res.status(404).json({error: 'not found'})
})

app.use((err,req,res,next) => {
  console.error(err)
  res.status(500).json({ error: 'something went wrong' })
})

export default app
