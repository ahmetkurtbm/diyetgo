import { Router, type Response } from 'express'
import type { Db } from '../db/client'
import { createMealPlanService } from '../services/meal-plans'
import { archivedBody, includeArchivedParam, ownerOf, stringParam } from './params'

export function mealPlansRouter(db: Db) {
  const service = (res: Response) => createMealPlanService(db, ownerOf(res))
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service(res).list({ clientId: stringParam(req.query.clientId), includeArchived: includeArchivedParam(req.query.includeArchived) }))
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
  router.post('/:id/copy', async (req, res) => {
    res.status(201).json(await service(res).copy(req.params.id, req.body))
  })
  router.post('/:id/copy-meals', async (req, res) => {
    res.status(201).json(await service(res).copyMeals(req.params.id, req.body))
  })

  return router
}

export function planMealsRouter(db: Db) {
  const service = (res: Response) => createMealPlanService(db, ownerOf(res))
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).addMeal(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).updateMeal(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).removeMeal(req.params.id)
    res.status(204).end()
  })

  return router
}

export function planMealItemsRouter(db: Db) {
  const service = (res: Response) => createMealPlanService(db, ownerOf(res))
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).addItem(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).updateItem(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).removeItem(req.params.id)
    res.status(204).end()
  })

  return router
}
