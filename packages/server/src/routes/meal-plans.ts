import { Router } from 'express'
import type { Db } from '../db/client'
import { createMealPlanService } from '../services/meal-plans'
import { archivedBody, includeArchivedParam, stringParam } from './params'

export function mealPlansRouter(db: Db) {
  const service = createMealPlanService(db)
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service.list({ clientId: stringParam(req.query.clientId), includeArchived: includeArchivedParam(req.query.includeArchived) }))
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
  router.post('/:id/copy', async (req, res) => {
    res.status(201).json(await service.copy(req.params.id, req.body))
  })

  return router
}

export function planMealsRouter(db: Db) {
  const service = createMealPlanService(db)
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service.addMeal(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service.updateMeal(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service.removeMeal(req.params.id)
    res.status(204).end()
  })

  return router
}

export function planMealItemsRouter(db: Db) {
  const service = createMealPlanService(db)
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service.addItem(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service.updateItem(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service.removeItem(req.params.id)
    res.status(204).end()
  })

  return router
}
