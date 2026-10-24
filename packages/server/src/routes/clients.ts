import { Router, type Response } from 'express'
import type { Db } from '../db/client'
import { createClientService } from '../services/clients'
import { createGoalService } from '../services/goals'
import { createMeasurementService } from '../services/measurements'
import { archivedBody, includeArchivedParam, ownerOf, stringParam } from './params'

export function clientsRouter(db: Db) {
  const service = (res: Response) => createClientService(db, ownerOf(res))
  const measurements = (res: Response) => createMeasurementService(db, ownerOf(res))
  const goals = (res: Response) => createGoalService(db, ownerOf(res))
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service(res).list({ search: stringParam(req.query.search), includeArchived: includeArchivedParam(req.query.includeArchived) }))
  })
  router.get('/:id', async (req, res) => {
    res.json(await service(res).get(req.params.id))
  })
  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.put('/:id/archived', async (req, res) => {
    res.json(await service(res).setArchived(req.params.id, archivedBody(req.body)))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })
  router.get('/:id/measurements', async (req, res) => {
    res.json(await measurements(res).listByClient(req.params.id))
  })
  router.get('/:id/goals', async (req, res) => {
    res.json(await goals(res).listByClient(req.params.id))
  })

  return router
}
