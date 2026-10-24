/** Danışana bağlı, alt kaydı olmayan kayıtlar: ölçümler ve hedefler. Listeleme danışan altındadır. */
import { Router } from 'express'
import type { Db } from '../db/client'
import { createGoalService } from '../services/goals'
import { createMeasurementService } from '../services/measurements'

export function measurementsRouter(db: Db) {
  const service = createMeasurementService(db)
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service.update(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service.remove(req.params.id)
    res.status(204).end()
  })

  return router
}

export function goalsRouter(db: Db) {
  const service = createGoalService(db)
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service.update(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service.remove(req.params.id)
    res.status(204).end()
  })

  return router
}
