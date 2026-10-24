/** Danışana bağlı, alt kaydı olmayan kayıtlar: ölçümler ve hedefler. Listeleme danışan altındadır. */
import { Router, type Response } from 'express'
import type { Db } from '../db/client'
import { createGoalService } from '../services/goals'
import { createMeasurementService } from '../services/measurements'
import { ownerOf } from './params'

export function measurementsRouter(db: Db) {
  const service = (res: Response) => createMeasurementService(db, ownerOf(res))
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })

  return router
}

export function goalsRouter(db: Db) {
  const service = (res: Response) => createGoalService(db, ownerOf(res))
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })

  return router
}
