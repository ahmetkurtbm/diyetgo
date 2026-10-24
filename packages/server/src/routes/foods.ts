import { Router } from 'express'
import type { Db } from '../db/client'
import { createFoodService } from '../services/foods'
import { createMealTypeService } from '../services/meal-types'
import { archivedBody, includeArchivedParam, stringParam } from './params'

export function foodsRouter(db: Db) {
  const service = createFoodService(db)
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service.list({ search: stringParam(req.query.search), includeArchived: includeArchivedParam(req.query.includeArchived) }))
  })
  router.get('/:id', async (req, res) => {
    res.json(await service.get(req.params.id))
  })
  router.get('/:id/plan-count', async (req, res) => {
    res.json({ count: await service.countPlansUsing(req.params.id) })
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

  return router
}

export function mealTypesRouter(db: Db) {
  const service = createMealTypeService(db)
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service.list({ includeArchived: includeArchivedParam(req.query.includeArchived) }))
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

  return router
}
