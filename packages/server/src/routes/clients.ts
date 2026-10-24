import { Router } from 'express'
import type { Db } from '../db/client'
import { createClientService } from '../services/clients'
import { createGoalService } from '../services/goals'
import { createMeasurementService } from '../services/measurements'
import { archivedBody, includeArchivedParam, stringParam } from './params'

export function clientsRouter(db: Db) {
  const service = createClientService(db)
  const measurements = createMeasurementService(db)
  const goals = createGoalService(db)
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service.list({ search: stringParam(req.query.search), includeArchived: includeArchivedParam(req.query.includeArchived) }))
  })
  router.get('/:id', async (req, res) => {
    res.json(await service.get(req.params.id))
  })
  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service.update(req.params.id, req.body))
  })
  router.put('/:id/archived', async (req, res) => {
    res.json(await service.setArchived(req.params.id, archivedBody(req.body)))
  })
  router.delete('/:id', async (req, res) => {
    await service.remove(req.params.id)
    res.status(204).end()
  })
  router.get('/:id/measurements', async (req, res) => {
    res.json(await measurements.listByClient(req.params.id))
  })
  router.get('/:id/goals', async (req, res) => {
    res.json(await goals.listByClient(req.params.id))
  })

  return router
}
